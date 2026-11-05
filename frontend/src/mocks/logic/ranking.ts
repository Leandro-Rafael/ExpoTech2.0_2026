/** Ranking por pessoa, residência, bairro ou organização, calculado a partir das transações e descartes. */
import type { OrganizationType, Ranking, RankingEntry, RankingPeriod, RankingScope } from '@/api/types';
import type { MockDb, UserRec } from '../db';
import { DAY } from './dates';
import { round } from './random';

const ORG_LABEL: Record<OrganizationType, string> = { TURMA: 'Turma', EMPRESA: 'Empresa', CONDOMINIO: 'Condomínio', ESCOLA: 'Escola' };

function periodStart(period: RankingPeriod, now: number): number {
  switch (period) {
    case 'WEEK': return now - 7 * DAY;
    case 'MONTH': return now - 30 * DAY;
    case 'YEAR': return now - 365 * DAY;
    default: return 0;
  }
}

interface Row { id: string; name: string; subtitle: string | null; points: number; kg: number }

export function computeRanking(d: MockDb, me: UserRec, scope: RankingScope, period: RankingPeriod, now = Date.now()): Ranking {
  const from = periodStart(period, now);
  const pointsByUser = new Map<string, number>();
  for (const t of d.transactions) {
    if ((t.type === 'EARN' || t.type === 'BONUS') && Date.parse(t.createdAt) >= from) {
      pointsByUser.set(t.userId, (pointsByUser.get(t.userId) ?? 0) + t.amount);
    }
  }
  const kgByUser = new Map<string, number>();
  for (const x of d.disposals) {
    if (x.status === 'APPROVED' && Date.parse(x.disposedAt) >= from) kgByUser.set(x.userId, (kgByUser.get(x.userId) ?? 0) + x.quantityKg);
  }
  const participants = d.users.filter((u) => u.enabled && u.role === 'USER');
  const household = (u: UserRec) => d.households.find((h) => h.id === u.householdId) ?? null;

  const groups = new Map<string, Row & { homes?: Set<string> }>();
  const keyOf = (u: UserRec): string | null => {
    switch (scope) {
      case 'USER': return u.id;
      case 'HOUSEHOLD': return u.householdId;
      case 'NEIGHBORHOOD': return household(u)?.neighborhood ?? null;
      case 'ORGANIZATION': return u.organizationId;
    }
  };
  for (const u of participants) {
    const key = keyOf(u);
    if (!key) continue;
    let row = groups.get(key);
    if (!row) {
      const h = household(u);
      const org = d.organizations.find((o) => o.id === u.organizationId);
      row = scope === 'USER' ? { id: u.id, name: u.name, subtitle: h?.neighborhood ?? null, points: 0, kg: 0 }
        : scope === 'HOUSEHOLD' ? { id: h!.id, name: h!.name, subtitle: h!.neighborhood, points: 0, kg: 0 }
          : scope === 'NEIGHBORHOOD' ? { id: key, name: key, subtitle: null, points: 0, kg: 0, homes: new Set() }
            : { id: org!.id, name: org!.name, subtitle: ORG_LABEL[org!.type], points: 0, kg: 0 };
      groups.set(key, row);
    }
    row.points += pointsByUser.get(u.id) ?? 0;
    row.kg += kgByUser.get(u.id) ?? 0;
    if (row.homes && u.householdId) row.homes.add(u.householdId);
  }

  const rows = [...groups.values()]
    .filter((r) => r.points > 0 || r.kg > 0)
    .map((r) => ({ ...r, subtitle: r.homes ? `${r.homes.size} residência(s)` : r.subtitle, kg: round(r.kg, 2) }))
    .sort((a, b) => b.points - a.points || b.kg - a.kg || a.name.localeCompare(b.name, 'pt-BR'));

  const myKey = keyOf(me);
  const toEntry = (r: Row, i: number): RankingEntry => ({
    position: i + 1, id: r.id, name: r.name, subtitle: r.subtitle, points: r.points, kg: r.kg, isMe: r.id === myKey,
  });
  const entries = rows.slice(0, 10).map(toEntry);
  let mine: RankingEntry | null = null;
  if (myKey) {
    const idx = rows.findIndex((r) => r.id === myKey);
    if (idx >= 0) mine = toEntry(rows[idx], idx);
    else {
      const name = scope === 'USER' ? me.name
        : scope === 'HOUSEHOLD' ? household(me)?.name ?? ''
          : scope === 'NEIGHBORHOOD' ? myKey
            : d.organizations.find((o) => o.id === me.organizationId)?.name ?? '';
      mine = { position: rows.length + 1, id: myKey, name, subtitle: null, points: 0, kg: 0, isMe: true };
    }
  }
  return { scope, period, entries, me: mine };
}
