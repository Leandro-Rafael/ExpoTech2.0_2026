/**
 * Otimizador de rotas (CVRP heurístico, como o RouteOptimizer do back-end):
 * 1. matriz de distâncias Haversine (0 = garagem);
 * 2. vizinho mais próximo respeitando a capacidade do caminhão (nova viagem quando nada mais cabe);
 * 3. 2-opt em cada viagem até não haver ganho.
 * Comparação com a rota "ingênua" (ordem de criação das solicitações, dividida por capacidade).
 */
import type { GeoPoint } from '@/api/types';
import { haversineKm } from './geo';
import { round } from './random';

export const ALGORITHM = 'Vizinho mais próximo + 2-opt (com capacidade)';
const AVERAGE_SPEED_KMH = 25;
const SERVICE_MINUTES_PER_STOP = 5;
export const DEFAULT_CAPACITY_KG = 1000;
const MAX_TWO_OPT_PASSES = 50;

export interface StopInput { id: string; latitude: number; longitude: number; kg: number }
interface PlannedTrip<S extends StopInput> { stops: S[]; distanceKm: number; naiveDistanceKm: number; estimatedMinutes: number; loadKg: number }
export interface Plan<S extends StopInput> { trips: PlannedTrip<S>[]; totalDistanceKm: number; naiveTotalDistanceKm: number; savingsPercent: number }

export function optimize<S extends StopInput>(depot: GeoPoint, stops: S[], capacityKg = DEFAULT_CAPACITY_KG): Plan<S> {
  if (!stops.length) return { trips: [], totalDistanceKm: 0, naiveTotalDistanceKm: 0, savingsPercent: 0 };
  const pts: GeoPoint[] = [depot, ...stops];
  const n = pts.length;
  const dist: number[][] = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 0 : haversineKm(pts[i], pts[j]))));
  const tripLength = (trip: number[]) => {
    let total = 0;
    let prev = 0;
    for (const i of trip) { total += dist[prev][i]; prev = i; }
    return total + dist[prev][0];
  };
  const kgOf = (i: number) => Math.max(0, stops[i - 1].kg);

  // plano ingênuo: ordem de criação, dividida por capacidade na mesma ordem
  const naive: number[][] = [];
  let cur: number[] = [];
  let load = 0;
  for (let i = 1; i < n; i++) {
    if (cur.length && load + kgOf(i) > capacityKg) { naive.push(cur); cur = []; load = 0; }
    cur.push(i);
    load += kgOf(i);
  }
  if (cur.length) naive.push(cur);

  // vizinho mais próximo com capacidade
  const visited = new Set<number>();
  const trips: number[][] = [];
  while (visited.size < n - 1) {
    const trip: number[] = [];
    let pos = 0;
    let cap = 0;
    for (;;) {
      let best = -1;
      for (let i = 1; i < n; i++) {
        if (visited.has(i)) continue;
        if (trip.length && cap + kgOf(i) > capacityKg) continue;
        if (best === -1 || dist[pos][i] < dist[pos][best]) best = i;
      }
      if (best === -1) break;
      visited.add(best);
      trip.push(best);
      cap += kgOf(best);
      pos = best;
    }
    trips.push(twoOpt(trip, dist));
  }

  const optimizedTotal = trips.reduce((s, t) => s + tripLength(t), 0);
  const naiveTotal = naive.reduce((s, t) => s + tripLength(t), 0);
  // escolhe sempre o melhor dos dois planos: a economia nunca é negativa
  const chosen = optimizedTotal <= naiveTotal ? trips : naive;
  const chosenTotal = Math.min(optimizedTotal, naiveTotal);

  const planned: PlannedTrip<S>[] = chosen.map((t) => {
    const distanceKm = tripLength(t);
    const loadKg = t.reduce((s, i) => s + kgOf(i), 0);
    return {
      stops: t.map((i) => stops[i - 1]),
      distanceKm: round(distanceKm),
      // parcela proporcional da rota ingênua (para comparação por viagem)
      naiveDistanceKm: round(chosenTotal > 0 ? (naiveTotal * distanceKm) / chosenTotal : 0),
      estimatedMinutes: Math.round((distanceKm / AVERAGE_SPEED_KMH) * 60 + SERVICE_MINUTES_PER_STOP * t.length),
      loadKg: round(loadKg),
    };
  });
  return {
    trips: planned,
    totalDistanceKm: round(chosenTotal),
    naiveTotalDistanceKm: round(naiveTotal),
    savingsPercent: naiveTotal > 0 ? round(((naiveTotal - chosenTotal) / naiveTotal) * 100, 1) : 0,
  };
}

function twoOpt(trip: number[], dist: number[][]): number[] {
  if (trip.length < 3) return trip;
  let best = trip.slice();
  for (let pass = 0; pass < MAX_TWO_OPT_PASSES; pass++) {
    let improved = false;
    for (let i = 0; i < best.length - 1; i++) {
      for (let k = i + 1; k < best.length; k++) {
        const a = i === 0 ? 0 : best[i - 1];
        const b = best[i];
        const c = best[k];
        const e = k === best.length - 1 ? 0 : best[k + 1];
        const delta = dist[a][c] + dist[b][e] - dist[a][b] - dist[c][e];
        if (delta < -1e-9) {
          best = [...best.slice(0, i), ...best.slice(i, k + 1).reverse(), ...best.slice(k + 1)];
          improved = true;
        }
      }
    }
    if (!improved) break;
  }
  return best;
}
