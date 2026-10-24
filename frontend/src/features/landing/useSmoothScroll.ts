import { useEffect, useRef } from 'react';
import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { prefersReducedMotion } from '@/hooks/useReducedMotion';

gsap.registerPlugin(ScrollTrigger);

/**
 * Lenis (scroll suave) sincronizado com o ticker do GSAP/ScrollTrigger.
 * Desativado com prefers-reduced-motion e em telas de toque. Destruído ao sair da página.
 * A cena 3D também roda no gsap.ticker: um único requestAnimationFrame para tudo.
 * Retorna `scrollTo(alvo)` para âncoras.
 */
export function useSmoothScroll() {
  const lenisRef = useRef<Lenis | null>(null);

  useEffect(() => {
    // Touch: o scroll nativo é mais fluido que qualquer emulação.
    if (prefersReducedMotion() || window.matchMedia('(pointer: coarse)').matches) return;
    // lerp (e não duração longa): mais leve e estável em CPUs fracas.
    const lenis = new Lenis({ lerp: 0.1, smoothWheel: true, syncTouch: false, wheelMultiplier: 1 });
    lenisRef.current = lenis;
    lenis.on('scroll', ScrollTrigger.update);
    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    return () => {
      gsap.ticker.remove(tick);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, []);

  return (target: string | HTMLElement) => {
    const el = typeof target === 'string' ? document.querySelector<HTMLElement>(target) : target;
    if (!el) return;
    if (lenisRef.current) lenisRef.current.scrollTo(el, { offset: -72 });
    else el.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
  };
}

export { gsap, ScrollTrigger };
