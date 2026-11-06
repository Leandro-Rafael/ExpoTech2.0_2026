import type { CategoryCode } from '@/api/types';
import { categoriaPadrao } from './labels';

/** Cor hex da categoria (usa a cor da API se houver, senão o fallback local). */
export function corDaCategoria(codigo: CategoryCode | null | undefined, corApi?: string | null): string {
  if (corApi && /^#[0-9a-f]{3,8}$/i.test(corApi)) return corApi;
  return codigo ? categoriaPadrao[codigo].color : '#8fa89a';
}

export function nomeDaCategoria(codigo: CategoryCode | null | undefined): string {
  return codigo ? categoriaPadrao[codigo].name : 'Sem categoria';
}

/** Hex → rgba com alpha (para fundos tingidos com a cor da categoria). */
export function hexComAlfa(hex: string, alfa: number): string {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h.slice(0, 6), 16);
  if (Number.isNaN(n)) return `rgba(143,168,154,${alfa})`;
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alfa})`;
}

