import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { prefersReducedMotion } from '@/hooks/useReducedMotion';
import { LandingBackground } from '@/features/landing/LandingBackground';
import { FinalCta, Features, Footer, Hero, HowItWorks, ImpactStats, LandingNav, SmartHome, Timeline } from '@/features/landing/sections';
import { gsap, ScrollTrigger, useSmoothScroll } from '@/features/landing/useSmoothScroll';

/** Curva única do produto (equivale a cubic-bezier(0.22, 1, 0.36, 1)). */
const EASE = 'power3.out';

type IdleWindow = Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };

/**
 * Landing page — vitrine do projeto (cena 3D + scroll storytelling).
 * Desempenho: o hero pinta primeiro; as seções abaixo da dobra montam quando o navegador
 * fica ocioso (mesmo visual, tarefa inicial do React muito menor).
 */
export default function LandingPage() {
  useDocumentTitle(null);
  const root = useRef<HTMLDivElement>(null);
  const smoothScrollTo = useSmoothScroll();
  const [rest, setRest] = useState(() => prefersReducedMotion());

  useEffect(() => {
    if (rest) return;
    const w = window as IdleWindow;
    const id = w.requestIdleCallback ? w.requestIdleCallback(() => setRest(true), { timeout: 900 }) : window.setTimeout(() => setRest(true), 200);
    return () => { if (w.cancelIdleCallback) w.cancelIdleCallback(id); else clearTimeout(id); };
  }, [rest]);

  // Âncora clicada antes das seções montarem: monta e rola no quadro seguinte.
  const scrollTo = (target: string) => {
    if (document.querySelector(target)) return smoothScrollTo(target);
    setRest(true);
    requestAnimationFrame(() => requestAnimationFrame(() => smoothScrollTo(target)));
  };

  // Entrada do hero (fromTo com valores finais explícitos: imune a transições CSS e ao StrictMode).
  useLayoutEffect(() => {
    if (prefersReducedMotion()) return;
    const ctx = gsap.context(() => {
      // Uma só linguagem de movimento: opacidade + 14px, 0.6s, mesma curva, escalonamento sutil.
      const tl = gsap.timeline({ defaults: { ease: EASE, duration: 0.6 } });
      tl.fromTo('[data-hero="label"]', { y: 14, autoAlpha: 0 }, { y: 0, autoAlpha: 1 })
        .fromTo('[data-hero="word"]', { y: 14, autoAlpha: 0 }, { y: 0, autoAlpha: 1, stagger: 0.05 }, '-=0.4')
        .fromTo('[data-hero="sub"]', { y: 14, autoAlpha: 0 }, { y: 0, autoAlpha: 1 }, '-=0.35')
        .fromTo('[data-hero="cta"]', { y: 14, autoAlpha: 0 }, { y: 0, autoAlpha: 1 }, '-=0.45')
        .fromTo('[data-hero="ticker"]', { y: 14, autoAlpha: 0 }, { y: 0, autoAlpha: 1 }, '-=0.3');
    }, root);
    return () => ctx.revert();
  }, []);

  // Animações das seções (após montarem). Só transform/opacity.
  useLayoutEffect(() => {
    if (!rest || prefersReducedMotion()) return;
    const ctx = gsap.context(() => {
      gsap.set('[data-reveal]', { y: 14, autoAlpha: 0 });
      ScrollTrigger.batch('[data-reveal]', {
        start: 'top 88%',
        once: true,
        onEnter: (els) => gsap.to(els, { y: 0, autoAlpha: 1, duration: 0.6, ease: EASE, stagger: 0.06, overwrite: true }),
      });
      gsap.fromTo('[data-timeline-line]', { scaleX: 0, scaleY: 0 }, {
        scaleX: 1, scaleY: 1, ease: 'none',
        scrollTrigger: { trigger: '[data-timeline]', start: 'top 70%', end: 'bottom 70%', scrub: 0.6 },
      });
    }, root);
    // Recalcula após fontes/imagens (posições do pin)
    const refresh = () => ScrollTrigger.refresh();
    const raf = requestAnimationFrame(refresh);
    document.fonts?.ready.then(refresh);
    window.addEventListener('load', refresh);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('load', refresh); ctx.revert(); };
  }, [rest]);

  return (
    <div ref={root} className="relative overflow-x-clip">
      <LandingBackground />
      <a href="#como-funciona" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:rounded-lg focus:bg-lime-300 focus:px-4 focus:py-2 focus:text-bg-deep">
        Pular para o conteúdo
      </a>
      <LandingNav scrollTo={scrollTo} />
      <main className="relative z-10">
        <Hero scrollTo={scrollTo} />
        {rest ? (
          <div className="relative">
            {/* véu para dar contraste às seções sobre a cena 3D */}
            <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-bg/70 to-bg/90" />
            <div className="relative">
              <HowItWorks />
              <SmartHome />
              <ImpactStats />
              <Features />
              <Timeline />
              <FinalCta />
            </div>
          </div>
        ) : (
          <div aria-hidden className="h-[400vh]" />
        )}
      </main>
      {rest && <div className="relative z-10"><Footer /></div>}
    </div>
  );
}
