import { useConsultaMidia } from './useMediaQuery';

/** true quando o usuário pediu menos movimento no sistema operacional. */
export function useMovimentoReduzido(): boolean {
  return useConsultaMidia('(prefers-reduced-motion: reduce)');
}

/** Versão síncrona fora de componentes (ex.: dentro de efeitos GSAP / three). */
export function prefereMenosMovimento(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
