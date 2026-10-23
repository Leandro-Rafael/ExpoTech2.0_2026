import type { CategoryCode } from '@/api/types';
import type { CSSProperties } from 'react';
import { categoryFallback } from './labels';

/** Cor hex da categoria (usa a cor da API se houver, senão o fallback local). */
export function categoryColor(code: CategoryCode | null | undefined, apiColor?: string | null): string {
  if (apiColor && /^#[0-9a-f]{3,8}$/i.test(apiColor)) return apiColor;
  return code ? categoryFallback[code].color : '#8fa89a';
}

export function categoryName(code: CategoryCode | null | undefined): string {
  return code ? categoryFallback[code].name : 'Sem categoria';
}

/** Hex → rgba com alpha (para fundos tingidos com a cor da categoria). */
export function hexAlpha(hex: string, alpha: number): string {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h.slice(0, 6), 16);
  if (Number.isNaN(n)) return `rgba(143,168,154,${alpha})`;
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

/** Estilo pronto para "chip" de categoria: fundo tingido + borda + texto. */
export function categoryChipStyle(color: string): CSSProperties {
  return {
    backgroundColor: hexAlpha(color, 0.14),
    borderColor: hexAlpha(color, 0.35),
    color,
  };
}
