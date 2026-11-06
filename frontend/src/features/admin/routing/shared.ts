import type { CollectionRequest, GeoPoint } from '@/api/types';

/** Central de coleta padrão (Taboão da Serra) — a mesma do back-end. */
export const CENTRAL_PADRAO: GeoPoint = { latitude: -23.6019, longitude: -46.7526 };
export const CAPACIDADE_PADRAO_KG = 1000;

/** Paleta de dados para distinguir viagens no mapa (contraste sobre tiles escuros). */
const CORES_ROTAS = ['#34d399', '#7cc4f0', '#f5b544', '#c4a7f5', '#f28b82', '#5eead4'];
export const corDaRota = (i: number) => CORES_ROTAS[i % CORES_ROTAS.length];

export type Coordenada = [number, number];
export const paraCoordenada = (p: GeoPoint): Coordenada => [p.latitude, p.longitude];

/** Tom da prioridade (0..100). */
export function tomDaPrioridade(p: number): 'danger' | 'warning' | 'neutral' {
  if (p >= 70) return 'danger';
  if (p >= 40) return 'warning';
  return 'neutral';
}
export const corDaPrioridade = (p: number) => (p >= 70 ? '#f28b82' : p >= 40 ? '#f5b544' : '#a3aca6');

/**
 * Plano "ingênuo" para comparação visual: atende na ordem de chegada das solicitações,
 * abrindo nova viagem quando a capacidade acaba (mesma regra do back-end).
 */
export function caminhosIngenuos(solicitacoes: CollectionRequest[], central: GeoPoint, capacidadeKg: number): Coordenada[][] {
  const ordenadas = [...solicitacoes].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const viagens: CollectionRequest[][] = [];
  let atual: CollectionRequest[] = [];
  let carga = 0;
  for (const r of ordenadas) {
    const kg = Math.max(0, r.estimatedKg);
    if (atual.length && carga + kg > capacidadeKg) { viagens.push(atual); atual = []; carga = 0; }
    atual.push(r);
    carga += kg;
  }
  if (atual.length) viagens.push(atual);
  const d = paraCoordenada(central);
  return viagens.map((t) => [d, ...t.map(paraCoordenada), d]);
}

export function linkGoogleMaps(p: GeoPoint) {
  return `https://www.google.com/maps/dir/?api=1&destination=${p.latitude},${p.longitude}&travelmode=driving`;
}
