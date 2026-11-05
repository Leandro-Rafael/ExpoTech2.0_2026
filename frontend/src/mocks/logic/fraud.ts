/** Motor antifraude simplificado (mesmas ideias das regras do back-end). score ≥ 40 → descarte sinalizado. */
import type { Category } from '@/api/types';
import type { DisposalRec, MockDb, PhotoRec } from '../db';
import { HOUR, localDate } from './dates';
import { haversineKm } from './geo';

export const FLAG_THRESHOLD = 40;

export interface FraudAssessment { score: number; flags: string[] }

/** Distância de Hamming entre dois aHash (hex). */
function hashDistance(a: string, b: string): number {
  let dist = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    let x = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    while (x) { dist += x & 1; x >>= 1; }
  }
  return dist;
}

export function similarPhoto(d: MockDb, photo: PhotoRec): PhotoRec | null {
  if (!photo.hash) return null;
  return d.photos.find((p) => p.id !== photo.id && p.ownerId && p.hash && hashDistance(p.hash, photo.hash!) <= 5) ?? null;
}

export function assess(d: MockDb, x: DisposalRec, category: Category, photo: PhotoRec | null): FraudAssessment {
  const flags: string[] = [];
  let score = 0;
  const add = (points: number, message: string) => { score += points; flags.push(message); };
  const mine = d.disposals.filter((o) => o.userId === x.userId && o.id !== x.id);
  const t = Date.parse(x.disposedAt);

  if (!photo && x.quantityKg > 5) add(25, 'Descarte acima de 5 kg sem foto de comprovação.');
  if (photo) {
    const similar = similarPhoto(d, photo);
    if (similar) {
      if (similar.ownerId === x.userId) add(35, 'Foto muito parecida com outra que você já enviou.');
      else add(45, 'Foto muito parecida com uma enviada por outro usuário.');
    }
  }
  const sameCat = mine.filter((o) => o.categoryId === x.categoryId).map((o) => o.quantityKg).sort((a, b) => a - b);
  if (sameCat.length >= 5) {
    const median = sameCat[Math.floor(sameCat.length / 2)];
    if (x.quantityKg > 5 && x.quantityKg > median * 4) add(20, `Quantidade muito acima do seu histórico (mediana ${median.toFixed(1)} kg).`);
  }
  const lastHour = mine.filter((o) => Math.abs(Date.parse(o.createdAt) - Date.parse(x.createdAt)) <= HOUR).length;
  if (lastHour >= 5) add(30, `${lastHour + 1} descartes registrados em menos de 1 hora.`);
  const day = localDate(x.disposedAt);
  const dayKg = mine.filter((o) => localDate(o.disposedAt) === day).reduce((s, o) => s + o.quantityKg, x.quantityKg);
  if (dayKg > 40) add(30, `Total de ${dayKg.toFixed(1)} kg no mesmo dia (limite de referência: 40 kg).`);
  if (x.aiSuggestedCode && x.aiSuggestedCode !== category.code && (x.aiConfidence ?? 0) >= 0.7) {
    add(20, `A IA sugeriu ${x.aiSuggestedCode} com ${Math.round((x.aiConfidence ?? 0) * 100)}% de confiança, mas foi informado ${category.code}.`);
  }
  if (x.latitude !== null && x.longitude !== null) {
    const prev = mine.filter((o) => o.latitude !== null && Math.abs(Date.parse(o.disposedAt) - t) <= HOUR / 2)[0];
    if (prev && haversineKm({ latitude: prev.latitude!, longitude: prev.longitude! }, { latitude: x.latitude, longitude: x.longitude }) > 20) {
      add(25, 'Localização muito distante do descarte anterior em poucos minutos.');
    }
  }
  return { score: Math.min(100, score), flags };
}
