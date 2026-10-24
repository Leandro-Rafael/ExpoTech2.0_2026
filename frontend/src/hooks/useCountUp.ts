import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { prefersReducedMotion } from './useReducedMotion';

/**
 * Anima um número de 0 (ou do valor anterior) até `target` quando `start` é true.
 * Respeita prefers-reduced-motion (salta direto para o valor).
 */
export function useCountUp(target: number, { duration = 1600, start = true }: { duration?: number; start?: boolean } = {}) {
  const [value, setValue] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    if (!start) return;
    if (prefersReducedMotion() || !Number.isFinite(target)) { setValue(target); from.current = target; return; }
    const begin = performance.now();
    const initial = from.current;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - begin) / duration);
      const eased = 1 - Math.pow(1 - t, 4);
      setValue(initial + (target - initial) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
      else from.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, start]);
  return value;
}

/**
 * Igual ao useCountUp, mas escreve direto no `textContent` do elemento (zero re-render
 * do React por quadro). Preferível em listas de KPIs e na landing.
 *   const ref = useCountUpText<HTMLSpanElement>(value, formatNumber, { start: inView });
 *   <span ref={ref} />   // sem filhos: o texto é controlado pelo hook
 */
export function useCountUpText<T extends HTMLElement>(
  target: number,
  format: (v: number) => string,
  { duration = 1600, start = true }: { duration?: number; start?: boolean } = {},
) {
  const ref = useRef<T | null>(null);
  const from = useRef(0);
  const fmt = useRef(format);
  fmt.current = format;
  // Texto inicial antes da primeira pintura (sem layout shift).
  useLayoutEffect(() => {
    if (ref.current && !ref.current.textContent) ref.current.textContent = fmt.current(from.current);
  });
  useEffect(() => {
    const el = ref.current;
    if (!el || !start) return;
    if (prefersReducedMotion() || !Number.isFinite(target)) { el.textContent = fmt.current(target); from.current = target; return; }
    const begin = performance.now();
    const initial = from.current;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - begin) / duration);
      const v = initial + (target - initial) * (1 - Math.pow(1 - t, 4));
      el.textContent = fmt.current(v);
      if (t < 1) raf = requestAnimationFrame(tick);
      else from.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, start]);
  return ref;
}
