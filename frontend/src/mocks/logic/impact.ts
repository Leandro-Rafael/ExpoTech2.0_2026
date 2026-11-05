/**
 * Indicadores ambientais calculados a partir dos descartes APROVADOS (fatores iguais ao back-end, ImpactFactors):
 * CO2 = kg × co2FactorKg da categoria; árvores = CO2 / 22 kg por árvore/ano; energia e água por kg reciclado.
 */
import type { CategoryCode, Goal, ImpactSummary, PublicStats } from '@/api/types';
import type { GoalRec, MockDb } from '../db';
import { DAY, localDate, localMonth } from './dates';
import { round } from './random';

export const CO2_KG_PER_TREE_YEAR = 22;
const ENERGY_KWH_PER_KG: Record<CategoryCode, number> = { PAPEL: 4.1, PLASTICO: 5.8, VIDRO: 0.42, METAL: 4.5, ELETRONICO: 3.0, ORGANICO: 0.1, REJEITO: 0 };
const WATER_L_PER_KG: Record<CategoryCode, number> = { PAPEL: 26, PLASTICO: 2.5, VIDRO: 1.5, METAL: 6, ELETRONICO: 3, ORGANICO: 0, REJEITO: 0 };

const trees = (co2Kg: number) => co2Kg / CO2_KG_PER_TREE_YEAR;

interface CategoryTotal { code: CategoryCode; name: string; color: string; recyclable: boolean; kg: number; co2: number; count: number }

function totals(d: MockDb, userId: string | null, from = 0, to = Number.MAX_SAFE_INTEGER): CategoryTotal[] {
  const map = new Map<string, CategoryTotal & { factor: number }>();
  for (const c of d.categories) {
    map.set(c.id, { code: c.code, name: c.name, color: c.color, recyclable: c.recyclable, kg: 0, co2: 0, count: 0, factor: c.co2FactorKg });
  }
  for (const x of d.disposals) {
    if (x.status !== 'APPROVED' || (userId && x.userId !== userId)) continue;
    const t = Date.parse(x.disposedAt);
    if (t < from || t >= to) continue;
    const row = map.get(x.categoryId);
    if (!row) continue;
    row.kg += x.quantityKg;
    row.co2 += x.quantityKg * row.factor;
    row.count++;
  }
  return [...map.values()].sort((a, b) => b.kg - a.kg || a.name.localeCompare(b.name, 'pt-BR'));
}

const sum = (rows: CategoryTotal[], f: (r: CategoryTotal) => number) => rows.reduce((s, r) => s + f(r), 0);
const ratio = (a: number, b: number) => (b > 0 ? a / b : 0);

export function publicStats(d: MockDb): PublicStats {
  const all = totals(d, null);
  const co2 = sum(all, (r) => r.co2);
  return {
    totalKg: round(sum(all, (r) => r.kg)),
    recycledKg: round(sum(all, (r) => (r.recyclable ? r.kg : 0))),
    co2AvoidedKg: round(co2),
    treesEquivalent: round(trees(co2), 1),
    users: d.users.filter((u) => u.role === 'USER' && u.enabled).length,
    households: d.households.length,
    disposals: sum(all, (r) => r.count),
    collectionPoints: d.collectionPoints.filter((p) => p.active).length,
  };
}

/** Progresso da meta: dados do ano da meta; para metas futuras, os últimos 12 meses. */
export function goalDto(d: MockDb, g: GoalRec, now = Date.now()): Goal {
  const currentYear = Number(localDate(new Date(now)).slice(0, 4));
  let from: number;
  let to: number;
  if (g.year <= currentYear) {
    from = Date.parse(`${g.year}-01-01T03:00:00Z`);
    to = Date.parse(`${g.year + 1}-01-01T03:00:00Z`);
  } else {
    to = now;
    from = now - 365 * DAY;
  }
  const t = totals(d, null, from, to);
  const kg = sum(t, (r) => r.kg);
  const rate = ratio(sum(t, (r) => (r.recyclable ? r.kg : 0)), kg);
  const rateProgress = g.targetRecyclingRate <= 0 ? 1 : Math.min(1, rate / g.targetRecyclingRate);
  const kgProgress = g.targetKg <= 0 ? 1 : Math.min(1, kg / g.targetKg);
  return {
    id: g.id, year: g.year, title: g.title, targetRecyclingRate: g.targetRecyclingRate, targetKg: round(g.targetKg),
    currentRate: round(rate, 4), currentKg: round(kg), progress: round((rateProgress + kgProgress) / 2, 4),
  };
}

function goalDtos(d: MockDb): Goal[] {
  return [...d.goals].sort((a, b) => a.year - b.year || a.title.localeCompare(b.title)).map((g) => goalDto(d, g));
}

export function impactSummary(d: MockDb, scope: 'ME' | 'COMMUNITY', userId: string, months: number): ImpactSummary {
  const uid = scope === 'ME' ? userId : null;
  const all = totals(d, uid);
  const total = sum(all, (r) => r.kg);
  const recycled = sum(all, (r) => (r.recyclable ? r.kg : 0));
  const co2 = sum(all, (r) => r.co2);

  // série mensal dos últimos N meses (meses sem descarte aparecem com zero)
  const [y, m] = localMonth(new Date()).split('-').map(Number);
  const keys: string[] = [];
  for (let i = months - 1; i >= 0; i--) keys.push(new Date(Date.UTC(y, m - 1 - i, 15)).toISOString().slice(0, 7));
  const series = new Map(keys.map((k) => [k, { month: k, kg: 0, recycledKg: 0, co2AvoidedKg: 0 }]));
  const catById = new Map(d.categories.map((c) => [c.id, c]));
  for (const x of d.disposals) {
    if (x.status !== 'APPROVED' || (uid && x.userId !== uid)) continue;
    const p = series.get(localMonth(x.disposedAt));
    const cat = catById.get(x.categoryId);
    if (!p || !cat) continue;
    p.kg += x.quantityKg;
    if (cat.recyclable) p.recycledKg += x.quantityKg;
    p.co2AvoidedKg += x.quantityKg * cat.co2FactorKg;
  }

  return {
    scope,
    totalKg: round(total),
    recycledKg: round(recycled),
    recyclingRate: round(ratio(recycled, total), 4),
    co2AvoidedKg: round(co2),
    treesEquivalent: round(trees(co2), 1),
    energySavedKwh: round(sum(all, (r) => ENERGY_KWH_PER_KG[r.code] * r.kg), 1),
    waterSavedLiters: Math.round(sum(all, (r) => WATER_L_PER_KG[r.code] * r.kg)),
    disposalsCount: sum(all, (r) => r.count),
    byCategory: all.map((r) => ({ code: r.code, name: r.name, color: r.color, kg: round(r.kg), percent: round(ratio(r.kg, total) * 100, 1) })),
    byMonth: [...series.values()].map((p) => ({ month: p.month, kg: round(p.kg), recycledKg: round(p.recycledKg), co2AvoidedKg: round(p.co2AvoidedKg) })),
    goals: goalDtos(d),
  };
}
