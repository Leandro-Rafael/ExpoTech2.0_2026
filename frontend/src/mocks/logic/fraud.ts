/** Motor antifraude simplificado (mesmas ideias das regras do back-end). score ≥ 40 → descarte sinalizado. */
import type { Category } from '@/api/types';
import type { RegistroDescarte, BancoSimulado, RegistroFoto } from '../db';
import { HORA, dataLocal } from './dates';
import { distanciaHaversineKm } from './geo';

export const LIMIAR_SINALIZACAO = 40;

export interface AvaliacaoFraude { score: number; flags: string[] }

/** Distância de Hamming entre dois aHash (hex). */
function distanciaHash(a: string, b: string): number {
  let distancia = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    let x = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    while (x) { distancia += x & 1; x >>= 1; }
  }
  return distancia;
}

export function fotoParecida(d: BancoSimulado, foto: RegistroFoto): RegistroFoto | null {
  if (!foto.hash) return null;
  return d.photos.find((p) => p.id !== foto.id && p.ownerId && p.hash && distanciaHash(p.hash, foto.hash!) <= 5) ?? null;
}

export function avaliar(d: BancoSimulado, x: RegistroDescarte, categoria: Category, foto: RegistroFoto | null): AvaliacaoFraude {
  const sinais: string[] = [];
  let pontuacao = 0;
  const adicionar = (pontos: number, mensagem: string) => { pontuacao += pontos; sinais.push(mensagem); };
  const meus = d.disposals.filter((o) => o.userId === x.userId && o.id !== x.id);
  const t = Date.parse(x.disposedAt);

  if (!foto && x.quantityKg > 5) adicionar(25, 'Descarte acima de 5 kg sem foto de comprovação.');
  if (foto) {
    const parecida = fotoParecida(d, foto);
    if (parecida) {
      if (parecida.ownerId === x.userId) adicionar(35, 'Foto muito parecida com outra que você já enviou.');
      else adicionar(45, 'Foto muito parecida com uma enviada por outro usuário.');
    }
  }
  const mesmaCategoria = meus.filter((o) => o.categoryId === x.categoryId).map((o) => o.quantityKg).sort((a, b) => a - b);
  if (mesmaCategoria.length >= 5) {
    const mediana = mesmaCategoria[Math.floor(mesmaCategoria.length / 2)];
    if (x.quantityKg > 5 && x.quantityKg > mediana * 4) adicionar(20, `Quantidade muito acima do seu histórico (mediana ${mediana.toFixed(1)} kg).`);
  }
  const ultimaHora = meus.filter((o) => Math.abs(Date.parse(o.createdAt) - Date.parse(x.createdAt)) <= HORA).length;
  if (ultimaHora >= 5) adicionar(30, `${ultimaHora + 1} descartes registrados em menos de 1 hora.`);
  const dia = dataLocal(x.disposedAt);
  const kgDia = meus.filter((o) => dataLocal(o.disposedAt) === dia).reduce((s, o) => s + o.quantityKg, x.quantityKg);
  if (kgDia > 40) adicionar(30, `Total de ${kgDia.toFixed(1)} kg no mesmo dia (limite de referência: 40 kg).`);
  if (x.aiSuggestedCode && x.aiSuggestedCode !== categoria.code && (x.aiConfidence ?? 0) >= 0.7) {
    adicionar(20, `A IA sugeriu ${x.aiSuggestedCode} com ${Math.round((x.aiConfidence ?? 0) * 100)}% de confiança, mas foi informado ${categoria.code}.`);
  }
  if (x.latitude !== null && x.longitude !== null) {
    const anterior = meus.filter((o) => o.latitude !== null && Math.abs(Date.parse(o.disposedAt) - t) <= HORA / 2)[0];
    if (anterior && distanciaHaversineKm({ latitude: anterior.latitude!, longitude: anterior.longitude! }, { latitude: x.latitude, longitude: x.longitude }) > 20) {
      adicionar(25, 'Localização muito distante do descarte anterior em poucos minutos.');
    }
  }
  return { score: Math.min(100, pontuacao), flags: sinais };
}
