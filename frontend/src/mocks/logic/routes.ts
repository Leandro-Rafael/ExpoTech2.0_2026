/**
 * Otimizador de rotas (CVRP heurístico, como o RouteOptimizer do back-end):
 * 1. matriz de distâncias Haversine (0 = garagem);
 * 2. vizinho mais próximo respeitando a capacidade do caminhão (nova viagem quando nada mais cabe);
 * 3. 2-opt em cada viagem até não haver ganho.
 * Comparação com a rota "ingênua" (ordem de criação das solicitações, dividida por capacidade).
 */
import type { GeoPoint } from '@/api/types';
import { distanciaHaversineKm } from './geo';
import { arredondar } from './random';

export const ALGORITMO = 'Vizinho mais próximo + 2-opt (com capacidade)';
const VELOCIDADE_MEDIA_KMH = 25;
const MINUTOS_POR_PARADA = 5;
export const CAPACIDADE_PADRAO_KG = 1000;
const MAX_PASSADAS_2OPT = 50;

export interface EntradaParada { id: string; latitude: number; longitude: number; kg: number }
interface ViagemPlanejada<S extends EntradaParada> { stops: S[]; distanceKm: number; naiveDistanceKm: number; estimatedMinutes: number; loadKg: number }
export interface Plano<S extends EntradaParada> { trips: ViagemPlanejada<S>[]; totalDistanceKm: number; naiveTotalDistanceKm: number; savingsPercent: number }

export function otimizar<S extends EntradaParada>(deposito: GeoPoint, paradas: S[], capacidadeKg = CAPACIDADE_PADRAO_KG): Plano<S> {
  if (!paradas.length) return { trips: [], totalDistanceKm: 0, naiveTotalDistanceKm: 0, savingsPercent: 0 };
  const pts: GeoPoint[] = [deposito, ...paradas];
  const n = pts.length;
  const distancia: number[][] = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 0 : distanciaHaversineKm(pts[i], pts[j]))));
  const comprimentoViagem = (viagem: number[]) => {
    let total = 0;
    let anterior = 0;
    for (const i of viagem) { total += distancia[anterior][i]; anterior = i; }
    return total + distancia[anterior][0];
  };
  const kgDe = (i: number) => Math.max(0, paradas[i - 1].kg);

  // plano ingênuo: ordem de criação, dividida por capacidade na mesma ordem
  const ingenua: number[][] = [];
  let atual: number[] = [];
  let carga = 0;
  for (let i = 1; i < n; i++) {
    if (atual.length && carga + kgDe(i) > capacidadeKg) { ingenua.push(atual); atual = []; carga = 0; }
    atual.push(i);
    carga += kgDe(i);
  }
  if (atual.length) ingenua.push(atual);

  // vizinho mais próximo com capacidade
  const visitadas = new Set<number>();
  const viagens: number[][] = [];
  while (visitadas.size < n - 1) {
    const viagem: number[] = [];
    let pos = 0;
    let capacidade = 0;
    for (;;) {
      let melhor = -1;
      for (let i = 1; i < n; i++) {
        if (visitadas.has(i)) continue;
        if (viagem.length && capacidade + kgDe(i) > capacidadeKg) continue;
        if (melhor === -1 || distancia[pos][i] < distancia[pos][melhor]) melhor = i;
      }
      if (melhor === -1) break;
      visitadas.add(melhor);
      viagem.push(melhor);
      capacidade += kgDe(melhor);
      pos = melhor;
    }
    viagens.push(doisOpt(viagem, distancia));
  }

  const totalOtimizado = viagens.reduce((s, t) => s + comprimentoViagem(t), 0);
  const totalIngenuo = ingenua.reduce((s, t) => s + comprimentoViagem(t), 0);
  // escolhe sempre o melhor dos dois planos: a economia nunca é negativa
  const escolhido = totalOtimizado <= totalIngenuo ? viagens : ingenua;
  const totalEscolhido = Math.min(totalOtimizado, totalIngenuo);

  const planejadas: ViagemPlanejada<S>[] = escolhido.map((t) => {
    const distanciaKm = comprimentoViagem(t);
    const cargaKg = t.reduce((s, i) => s + kgDe(i), 0);
    return {
      stops: t.map((i) => paradas[i - 1]),
      distanceKm: arredondar(distanciaKm),
      // parcela proporcional da rota ingênua (para comparação por viagem)
      naiveDistanceKm: arredondar(totalEscolhido > 0 ? (totalIngenuo * distanciaKm) / totalEscolhido : 0),
      estimatedMinutes: Math.round((distanciaKm / VELOCIDADE_MEDIA_KMH) * 60 + MINUTOS_POR_PARADA * t.length),
      loadKg: arredondar(cargaKg),
    };
  });
  return {
    trips: planejadas,
    totalDistanceKm: arredondar(totalEscolhido),
    naiveTotalDistanceKm: arredondar(totalIngenuo),
    savingsPercent: totalIngenuo > 0 ? arredondar(((totalIngenuo - totalEscolhido) / totalIngenuo) * 100, 1) : 0,
  };
}

function doisOpt(viagem: number[], distancia: number[][]): number[] {
  if (viagem.length < 3) return viagem;
  let melhor = viagem.slice();
  for (let passada = 0; passada < MAX_PASSADAS_2OPT; passada++) {
    let melhorou = false;
    for (let i = 0; i < melhor.length - 1; i++) {
      for (let k = i + 1; k < melhor.length; k++) {
        const a = i === 0 ? 0 : melhor[i - 1];
        const b = melhor[i];
        const c = melhor[k];
        const e = k === melhor.length - 1 ? 0 : melhor[k + 1];
        const delta = distancia[a][c] + distancia[b][e] - distancia[a][b] - distancia[c][e];
        if (delta < -1e-9) {
          melhor = [...melhor.slice(0, i), ...melhor.slice(i, k + 1).reverse(), ...melhor.slice(k + 1)];
          melhorou = true;
        }
      }
    }
    if (!melhorou) break;
  }
  return melhor;
}
