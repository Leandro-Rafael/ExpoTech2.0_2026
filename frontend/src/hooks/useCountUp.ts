import { useEffect, useLayoutEffect, useRef } from 'react';
import { prefereMenosMovimento } from './useReducedMotion';

/**
 * Igual ao useCountUp, mas escreve direto no `textContent` do elemento (zero re-render
 * do React por quadro). Preferível em listas de KPIs e na landing.
 *   const ref = useCountUpText<HTMLSpanElement>(value, formatNumber, { start: inView });
 *   <span ref={ref} />   // sem filhos: o texto é controlado pelo hook
 */
export function useContagemTexto<T extends HTMLElement>(
  alvo: number,
  formatar: (v: number) => string,
  { duration = 1600, start = true }: { duration?: number; start?: boolean } = {},
) {
  const ref = useRef<T | null>(null);
  const valorAnterior = useRef(0);
  const formatoRef = useRef(formatar);
  formatoRef.current = formatar;
  // Texto inicial antes da primeira pintura (sem layout shift).
  useLayoutEffect(() => {
    if (ref.current && !ref.current.textContent) ref.current.textContent = formatoRef.current(valorAnterior.current);
  });
  useEffect(() => {
    const elemento = ref.current;
    if (!elemento || !start) return;
    if (prefereMenosMovimento() || !Number.isFinite(alvo)) { elemento.textContent = formatoRef.current(alvo); valorAnterior.current = alvo; return; }
    const comeco = performance.now();
    const inicial = valorAnterior.current;
    let raf = 0;
    const quadro = (agora: number) => {
      const t = Math.min(1, (agora - comeco) / duration);
      const v = inicial + (alvo - inicial) * (1 - Math.pow(1 - t, 4));
      elemento.textContent = formatoRef.current(v);
      if (t < 1) raf = requestAnimationFrame(quadro);
      else valorAnterior.current = alvo;
    };
    raf = requestAnimationFrame(quadro);
    return () => cancelAnimationFrame(raf);
  }, [alvo, duration, start]);
  return ref;
}
