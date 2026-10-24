import { useEffect, useRef } from 'react';
import type Lenis from 'lenis';
import { prefersReducedMotion } from '@/hooks/useReducedMotion';

/**
 * Lenis (scroll suave, modo lerp) sincronizado com o gsap.ticker/ScrollTrigger.
 * Carregado sob demanda (chunk "scroll"), então não pesa na primeira pintura.
 * Desligado com prefers-reduced-motion e em telas de toque. Destruído ao sair da página.
 * A cena 3D também roda no gsap.ticker: um único requestAnimationFrame para tudo.
 * Retorna `scrollTo(alvo)` para âncoras (usa scroll nativo enquanto o Lenis não carregou).
 */
export function useSmoothScroll() {
  const lenisRef = useRef<Lenis | null>(null);

  useEffect(() => {
    if (prefersReducedMotion() || window.matchMedia('(pointer: coarse)').matches) return;
    let disposed = false;
    let cleanup = () => {};
    void Promise.all([import('lenis'), import('./gsap')]).then(([{ default: LenisCtor }, { gsap, ScrollTrigger }]) => {
      if (disposed) return;
      const lenis = new LenisCtor({ lerp: 0.1, smoothWheel: true, syncTouch: false, wheelMultiplier: 1 });
      lenisRef.current = lenis;
      lenis.on('scroll', ScrollTrigger.update);
      const tick = (time: number) => lenis.raf(time * 1000);
      gsap.ticker.add(tick);
      gsap.ticker.lagSmoothing(0);
      cleanup = () => { gsap.ticker.remove(tick); lenis.destroy(); lenisRef.current = null; };
    });
    return () => { disposed = true; cleanup(); };
  }, []);

  return (target: string | HTMLElement) => {
    const el = typeof target === 'string' ? document.querySelector<HTMLElement>(target) : target;
    if (!el) return;
    if (lenisRef.current) lenisRef.current.scrollTo(el, { offset: -72 });
    else el.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
  };
}
