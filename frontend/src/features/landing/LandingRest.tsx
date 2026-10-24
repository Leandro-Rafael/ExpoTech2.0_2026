/**
 * Tudo abaixo da dobra (chunk lazy, montado quando o navegador fica ocioso):
 * seções, rodapé e as animações de scroll (GSAP/ScrollTrigger). Só transform/opacity.
 */
import { useLayoutEffect, useRef } from 'react';
import { prefersReducedMotion } from '@/hooks/useReducedMotion';
import { gsap, ScrollTrigger } from './gsap';
import { FinalCta, Features, Footer, HowItWorks, ImpactStats, SmartHome, Timeline } from './sections';

/** Curva única do produto (equivale a cubic-bezier(0.22, 1, 0.36, 1)). */
const EASE = 'power3.out';

export default function LandingRest() {
  const root = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (prefersReducedMotion()) return;
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
  }, []);

  return (
    <div ref={root} className="relative">
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
  );
}

/** Rodapé (mesmo chunk lazy). */
export function LandingFooter() {
  return <div className="relative z-10"><Footer /></div>;
}
