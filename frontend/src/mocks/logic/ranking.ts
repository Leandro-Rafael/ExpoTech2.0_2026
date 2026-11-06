/** Ranking por pessoa, residência, bairro ou organização, calculado a partir das transações e descartes. */
import type { OrganizationType, Ranking, RankingEntry, RankingPeriod, RankingScope } from '@/api/types';
import type { BancoSimulado, RegistroUsuario } from '../db';
import { DIA } from './dates';
import { arredondar } from './random';

const ROTULO_ORG: Record<OrganizationType, string> = { TURMA: 'Turma', EMPRESA: 'Empresa', CONDOMINIO: 'Condomínio', ESCOLA: 'Escola' };

function inicioPeriodo(periodo: RankingPeriod, agora: number): number {
  switch (periodo) {
    case 'WEEK': return agora - 7 * DIA;
    case 'MONTH': return agora - 30 * DIA;
    case 'YEAR': return agora - 365 * DIA;
    default: return 0;
  }
}

interface Linha { id: string; name: string; subtitle: string | null; points: number; kg: number }

export function calcularRanking(d: BancoSimulado, me: RegistroUsuario, escopo: RankingScope, periodo: RankingPeriod, agora = Date.now()): Ranking {
  const desde = inicioPeriodo(periodo, agora);
  const pontosPorUsuario = new Map<string, number>();
  for (const t of d.transactions) {
    if ((t.type === 'EARN' || t.type === 'BONUS') && Date.parse(t.createdAt) >= desde) {
      pontosPorUsuario.set(t.userId, (pontosPorUsuario.get(t.userId) ?? 0) + t.amount);
    }
  }
  const kgPorUsuario = new Map<string, number>();
  for (const x of d.disposals) {
    if (x.status === 'APPROVED' && Date.parse(x.disposedAt) >= desde) kgPorUsuario.set(x.userId, (kgPorUsuario.get(x.userId) ?? 0) + x.quantityKg);
  }
  const participantes = d.users.filter((u) => u.enabled && u.role === 'USER');
  const residencia = (u: RegistroUsuario) => d.households.find((h) => h.id === u.householdId) ?? null;

  const grupos = new Map<string, Linha & { homes?: Set<string> }>();
  const chaveDe = (u: RegistroUsuario): string | null => {
    switch (escopo) {
      case 'USER': return u.id;
      case 'HOUSEHOLD': return u.householdId;
      case 'NEIGHBORHOOD': return residencia(u)?.neighborhood ?? null;
      case 'ORGANIZATION': return u.organizationId;
    }
  };
  for (const u of participantes) {
    const chave = chaveDe(u);
    if (!chave) continue;
    let linha = grupos.get(chave);
    if (!linha) {
      const h = residencia(u);
      const organizacao = d.organizations.find((o) => o.id === u.organizationId);
      linha = escopo === 'USER' ? { id: u.id, name: u.name, subtitle: h?.neighborhood ?? null, points: 0, kg: 0 }
        : escopo === 'HOUSEHOLD' ? { id: h!.id, name: h!.name, subtitle: h!.neighborhood, points: 0, kg: 0 }
          : escopo === 'NEIGHBORHOOD' ? { id: chave, name: chave, subtitle: null, points: 0, kg: 0, homes: new Set() }
            : { id: organizacao!.id, name: organizacao!.name, subtitle: ROTULO_ORG[organizacao!.type], points: 0, kg: 0 };
      grupos.set(chave, linha);
    }
    linha.points += pontosPorUsuario.get(u.id) ?? 0;
    linha.kg += kgPorUsuario.get(u.id) ?? 0;
    if (linha.homes && u.householdId) linha.homes.add(u.householdId);
  }

  const linhas = [...grupos.values()]
    .filter((r) => r.points > 0 || r.kg > 0)
    .map((r) => ({ ...r, subtitle: r.homes ? `${r.homes.size} residência(s)` : r.subtitle, kg: arredondar(r.kg, 2) }))
    .sort((a, b) => b.points - a.points || b.kg - a.kg || a.name.localeCompare(b.name, 'pt-BR'));

  const minhaChave = chaveDe(me);
  const paraEntrada = (r: Linha, i: number): RankingEntry => ({
    position: i + 1, id: r.id, name: r.name, subtitle: r.subtitle, points: r.points, kg: r.kg, isMe: r.id === minhaChave,
  });
  const entradas = linhas.slice(0, 10).map(paraEntrada);
  let meu: RankingEntry | null = null;
  if (minhaChave) {
    const idx = linhas.findIndex((r) => r.id === minhaChave);
    if (idx >= 0) meu = paraEntrada(linhas[idx], idx);
    else {
      const nome = escopo === 'USER' ? me.name
        : escopo === 'HOUSEHOLD' ? residencia(me)?.name ?? ''
          : escopo === 'NEIGHBORHOOD' ? minhaChave
            : d.organizations.find((o) => o.id === me.organizationId)?.name ?? '';
      meu = { position: linhas.length + 1, id: minhaChave, name: nome, subtitle: null, points: 0, kg: 0, isMe: true };
    }
  }
  return { scope: escopo, period: periodo, entries: entradas, me: meu };
}
