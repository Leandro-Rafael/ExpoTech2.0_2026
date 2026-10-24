import { lazy, Suspense, useEffect, useState } from 'react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { prefersReducedMotion } from '@/hooks/useReducedMotion';
import { LandingBackground } from '@/features/landing/LandingBackground';
import { Hero, LandingNav } from '@/features/landing/hero';
import { useSmoothScroll } from '@/features/landing/useSmoothScroll';

const LandingRest = lazy(() => import('@/features/landing/LandingRest'));
const LandingFooter = lazy(() => import('@/features/landing/LandingRest').then((m) => ({ default: m.LandingFooter })));

type IdleWindow = Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };

/**
 * Landing page — vitrine do projeto (cena 3D + scroll storytelling).
 * Desempenho: nav + hero entram no bundle da rota (pintura instantânea, sem GSAP);
 * a cena 3D (three), o scroll suave (lenis/gsap) e as seções abaixo da dobra são lazy.
 */
export default function LandingPage() {
  useDocumentTitle(null);
  const smoothScrollTo = useSmoothScroll();
  const [rest, setRest] = useState(() => prefersReducedMotion());

  useEffect(() => {
    if (rest) return;
    const w = window as IdleWindow;
    const id = w.requestIdleCallback ? w.requestIdleCallback(() => setRest(true), { timeout: 900 }) : window.setTimeout(() => setRest(true), 200);
    return () => { if (w.cancelIdleCallback) w.cancelIdleCallback(id); else clearTimeout(id); };
  }, [rest]);

  // Âncora clicada antes das seções montarem: monta e rola assim que o alvo existir.
  const scrollTo = (target: string) => {
    if (document.querySelector(target)) return smoothScrollTo(target);
    setRest(true);
    let tries = 0;
    const wait = () => {
      if (document.querySelector(target)) smoothScrollTo(target);
      else if (tries++ < 60) requestAnimationFrame(wait);
    };
    requestAnimationFrame(wait);
  };

  return (
    <div className="relative overflow-x-clip">
      <LandingBackground />
      <a href="#como-funciona" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:rounded-lg focus:bg-lime-300 focus:px-4 focus:py-2 focus:text-bg-deep">
        Pular para o conteúdo
      </a>
      <LandingNav scrollTo={scrollTo} />
      <main className="relative z-10">
        <Hero scrollTo={scrollTo} />
        {rest ? (
          <Suspense fallback={<div aria-hidden className="h-[400vh]" />}>
            <LandingRest />
          </Suspense>
        ) : (
          <div aria-hidden className="h-[400vh]" />
        )}
      </main>
      {rest && <Suspense fallback={null}><LandingFooter /></Suspense>}
    </div>
  );
}
