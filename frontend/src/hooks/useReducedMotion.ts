import { useMediaQuery } from './useMediaQuery';

/** true quando o usuário pediu menos movimento no sistema operacional. */
export function useReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)');
}

/** Versão síncrona fora de componentes (ex.: dentro de efeitos GSAP / three). */
export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
