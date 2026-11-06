import { useEffect, useRef } from 'react';
import type Lenis from 'lenis';
import { prefereMenosMovimento } from '@/hooks/useReducedMotion';

/**
 * Lenis (scroll suave, modo lerp) sincronizado com o gsap.ticker/ScrollTrigger.
 * Carregado sob demanda (chunk "scroll"), então não pesa na primeira pintura.
 * Desligado com prefers-reduced-motion e em telas de toque. Destruído ao sair da página.
 * A cena 3D também roda no gsap.ticker: um único requestAnimationFrame para tudo.
 * Retorna `scrollTo(alvo)` para âncoras (usa scroll nativo enquanto o Lenis não carregou).
 */
let atual: Lenis | null = null;
/** Instância ativa do Lenis (ou null: toque, movimento reduzido ou ainda carregando). */
export function obterLenis(): Lenis | null { return atual; }

/** Rola até uma posição absoluta: Lenis se ativo; senão scroll nativo (instantâneo com movimento reduzido). */
export function rolarAteY(y: number) {
  if (atual) atual.scrollTo(y, { duration: 1.1, easing: (t) => 1 - Math.pow(1 - t, 3) });
  else window.scrollTo({ top: y, behavior: prefereMenosMovimento() ? 'auto' : 'smooth' });
}

export function useRolagemSuave() {
  const refLenis = useRef<Lenis | null>(null);

  useEffect(() => {
    if (prefereMenosMovimento() || window.matchMedia('(pointer: coarse)').matches) return;
    let descartado = false;
    let limpar = () => {};
    void Promise.all([import('lenis'), import('./gsap')]).then(([{ default: ConstrutorLenis }, { gsap, ScrollTrigger }]) => {
      if (descartado) return;
      const lenis = new ConstrutorLenis({ lerp: 0.1, smoothWheel: true, syncTouch: false, wheelMultiplier: 1 });
      refLenis.current = lenis;
      atual = lenis;
      lenis.on('scroll', ScrollTrigger.update);
      const tique = (tempo: number) => lenis.raf(tempo * 1000);
      gsap.ticker.add(tique);
      gsap.ticker.lagSmoothing(0);
      limpar = () => { gsap.ticker.remove(tique); lenis.destroy(); refLenis.current = null; atual = null; };
    });
    return () => { descartado = true; limpar(); };
  }, []);

  return (alvo: string | HTMLElement) => {
    const el = typeof alvo === 'string' ? document.querySelector<HTMLElement>(alvo) : alvo;
    if (!el) return;
    if (refLenis.current) refLenis.current.scrollTo(el, { offset: -72 });
    else el.scrollIntoView({ behavior: prefereMenosMovimento() ? 'auto' : 'smooth', block: 'start' });
  };
}
