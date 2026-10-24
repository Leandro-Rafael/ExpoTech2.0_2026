import type { CollectionRequest, GeoPoint } from '@/api/types';

/** Central de coleta padrão (Taboão da Serra) — a mesma do back-end. */
export const DEFAULT_DEPOT: GeoPoint = { latitude: -23.6019, longitude: -46.7526 };
export const DEFAULT_CAPACITY_KG = 1000;

/** Paleta de dados para distinguir viagens no mapa (contraste sobre tiles escuros). */
export const ROUTE_COLORS = ['#34d399', '#7cc4f0', '#f5b544', '#c4a7f5', '#f28b82', '#5eead4'];
export const routeColor = (i: number) => ROUTE_COLORS[i % ROUTE_COLORS.length];

export type Tuple = [number, number];
export const tuple = (p: GeoPoint): Tuple => [p.latitude, p.longitude];

/** Tom da prioridade (0..100). */
export function priorityTone(p: number): 'danger' | 'warning' | 'neutral' {
  if (p >= 70) return 'danger';
  if (p >= 40) return 'warning';
  return 'neutral';
}
export const priorityColor = (p: number) => (p >= 70 ? '#f28b82' : p >= 40 ? '#f5b544' : '#a3aca6');

/**
 * Plano "ingênuo" para comparação visual: atende na ordem de chegada das solicitações,
 * abrindo nova viagem quando a capacidade acaba (mesma regra do back-end).
 */
export function naivePaths(requests: CollectionRequest[], depot: GeoPoint, capacityKg: number): Tuple[][] {
  const ordered = [...requests].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const trips: CollectionRequest[][] = [];
  let cur: CollectionRequest[] = [];
  let load = 0;
  for (const r of ordered) {
    const kg = Math.max(0, r.estimatedKg);
    if (cur.length && load + kg > capacityKg) { trips.push(cur); cur = []; load = 0; }
    cur.push(r);
    load += kg;
  }
  if (cur.length) trips.push(cur);
  const d = tuple(depot);
  return trips.map((t) => [d, ...t.map(tuple), d]);
}

export function googleMapsDir(p: GeoPoint) {
  return `https://www.google.com/maps/dir/?api=1&destination=${p.latitude},${p.longitude}&travelmode=driving`;
}
