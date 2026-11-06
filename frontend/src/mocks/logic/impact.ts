/**
 * Indicadores ambientais calculados a partir dos descartes APROVADOS (fatores iguais ao back-end, ImpactFactors):
 * CO2 = kg × co2FactorKg da categoria; árvores = CO2 / 22 kg por árvore/ano; energia e água por kg reciclado.
 */
import type { CategoryCode, Goal, ImpactSummary, PublicStats } from '@/api/types';
import type { RegistroMeta, BancoSimulado } from '../db';
import { DIA, dataLocal, mesLocal } from './dates';
import { arredondar } from './random';

export const CO2_KG_POR_ARVORE_ANO = 22;
const ENERGIA_KWH_POR_KG: Record<CategoryCode, number> = { PAPEL: 4.1, PLASTICO: 5.8, VIDRO: 0.42, METAL: 4.5, ELETRONICO: 3.0, ORGANICO: 0.1, REJEITO: 0 };
const AGUA_L_POR_KG: Record<CategoryCode, number> = { PAPEL: 26, PLASTICO: 2.5, VIDRO: 1.5, METAL: 6, ELETRONICO: 3, ORGANICO: 0, REJEITO: 0 };

const arvores = (co2Kg: number) => co2Kg / CO2_KG_POR_ARVORE_ANO;

interface TotalCategoria { code: CategoryCode; name: string; color: string; recyclable: boolean; kg: number; co2: number; count: number }

function totais(d: BancoSimulado, idUsuario: string | null, desde = 0, ate = Number.MAX_SAFE_INTEGER): TotalCategoria[] {
  const mapa = new Map<string, TotalCategoria & { factor: number }>();
  for (const c of d.categories) {
    mapa.set(c.id, { code: c.code, name: c.name, color: c.color, recyclable: c.recyclable, kg: 0, co2: 0, count: 0, factor: c.co2FactorKg });
  }
  for (const x of d.disposals) {
    if (x.status !== 'APPROVED' || (idUsuario && x.userId !== idUsuario)) continue;
    const t = Date.parse(x.disposedAt);
    if (t < desde || t >= ate) continue;
    const linha = mapa.get(x.categoryId);
    if (!linha) continue;
    linha.kg += x.quantityKg;
    linha.co2 += x.quantityKg * linha.factor;
    linha.count++;
  }
  return [...mapa.values()].sort((a, b) => b.kg - a.kg || a.name.localeCompare(b.name, 'pt-BR'));
}

const soma = (linhas: TotalCategoria[], f: (r: TotalCategoria) => number) => linhas.reduce((s, r) => s + f(r), 0);
const proporcao = (a: number, b: number) => (b > 0 ? a / b : 0);

export function estatisticasPublicas(d: BancoSimulado): PublicStats {
  const todos = totais(d, null);
  const co2 = soma(todos, (r) => r.co2);
  return {
    totalKg: arredondar(soma(todos, (r) => r.kg)),
    recycledKg: arredondar(soma(todos, (r) => (r.recyclable ? r.kg : 0))),
    co2AvoidedKg: arredondar(co2),
    treesEquivalent: arredondar(arvores(co2), 1),
    users: d.users.filter((u) => u.role === 'USER' && u.enabled).length,
    households: d.households.length,
    disposals: soma(todos, (r) => r.count),
    collectionPoints: d.collectionPoints.filter((p) => p.active).length,
  };
}

/** Progresso da meta: dados do ano da meta; para metas futuras, os últimos 12 meses. */
export function dtoMeta(d: BancoSimulado, g: RegistroMeta, agora = Date.now()): Goal {
  const anoAtual = Number(dataLocal(new Date(agora)).slice(0, 4));
  let desde: number;
  let ate: number;
  if (g.year <= anoAtual) {
    desde = Date.parse(`${g.year}-01-01T03:00:00Z`);
    ate = Date.parse(`${g.year + 1}-01-01T03:00:00Z`);
  } else {
    ate = agora;
    desde = agora - 365 * DIA;
  }
  const t = totais(d, null, desde, ate);
  const kg = soma(t, (r) => r.kg);
  const taxa = proporcao(soma(t, (r) => (r.recyclable ? r.kg : 0)), kg);
  const progressoTaxa = g.targetRecyclingRate <= 0 ? 1 : Math.min(1, taxa / g.targetRecyclingRate);
  const progressoKg = g.targetKg <= 0 ? 1 : Math.min(1, kg / g.targetKg);
  return {
    id: g.id, year: g.year, title: g.title, targetRecyclingRate: g.targetRecyclingRate, targetKg: arredondar(g.targetKg),
    currentRate: arredondar(taxa, 4), currentKg: arredondar(kg), progress: arredondar((progressoTaxa + progressoKg) / 2, 4),
  };
}

function dtosMetas(d: BancoSimulado): Goal[] {
  return [...d.goals].sort((a, b) => a.year - b.year || a.title.localeCompare(b.title)).map((g) => dtoMeta(d, g));
}

export function resumoImpacto(d: BancoSimulado, escopo: 'ME' | 'COMMUNITY', idUsuario: string, meses: number): ImpactSummary {
  const uid = escopo === 'ME' ? idUsuario : null;
  const todos = totais(d, uid);
  const total = soma(todos, (r) => r.kg);
  const reciclado = soma(todos, (r) => (r.recyclable ? r.kg : 0));
  const co2 = soma(todos, (r) => r.co2);

  // série mensal dos últimos N meses (meses sem descarte aparecem com zero)
  const [y, m] = mesLocal(new Date()).split('-').map(Number);
  const chaves: string[] = [];
  for (let i = meses - 1; i >= 0; i--) chaves.push(new Date(Date.UTC(y, m - 1 - i, 15)).toISOString().slice(0, 7));
  const serie = new Map(chaves.map((k) => [k, { month: k, kg: 0, recycledKg: 0, co2AvoidedKg: 0 }]));
  const categoriaPorId = new Map(d.categories.map((c) => [c.id, c]));
  for (const x of d.disposals) {
    if (x.status !== 'APPROVED' || (uid && x.userId !== uid)) continue;
    const p = serie.get(mesLocal(x.disposedAt));
    const cat = categoriaPorId.get(x.categoryId);
    if (!p || !cat) continue;
    p.kg += x.quantityKg;
    if (cat.recyclable) p.recycledKg += x.quantityKg;
    p.co2AvoidedKg += x.quantityKg * cat.co2FactorKg;
  }

  return {
    scope: escopo,
    totalKg: arredondar(total),
    recycledKg: arredondar(reciclado),
    recyclingRate: arredondar(proporcao(reciclado, total), 4),
    co2AvoidedKg: arredondar(co2),
    treesEquivalent: arredondar(arvores(co2), 1),
    energySavedKwh: arredondar(soma(todos, (r) => ENERGIA_KWH_POR_KG[r.code] * r.kg), 1),
    waterSavedLiters: Math.round(soma(todos, (r) => AGUA_L_POR_KG[r.code] * r.kg)),
    disposalsCount: soma(todos, (r) => r.count),
    byCategory: todos.map((r) => ({ code: r.code, name: r.name, color: r.color, kg: arredondar(r.kg), percent: arredondar(proporcao(r.kg, total) * 100, 1) })),
    byMonth: [...serie.values()].map((p) => ({ month: p.month, kg: arredondar(p.kg), recycledKg: arredondar(p.recycledKg), co2AvoidedKg: arredondar(p.co2AvoidedKg) })),
    goals: dtosMetas(d),
  };
}
