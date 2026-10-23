import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { prefersReducedMotion } from '@/hooks/useReducedMotion';
import { LandingBackground } from '@/features/landing/LandingBackground';
import { FinalCta, Features, Footer, Hero, HowItWorks, ImpactStats, LandingNav, SmartHome, STEPS, Timeline } from '@/features/landing/sections';
import { gsap, ScrollTrigger, useSmoothScroll } from '@/features/landing/useSmoothScroll';

/** Landing page — vitrine do projeto (cena 3D + scroll storytelling). */
export default function LandingPage() {
  useDocumentTitle(null);
  const root = useRef<HTMLDivElement>(null);
  const scrollTo = useSmoothScroll();
  const [scrolled, setScrolled] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useLayoutEffect(() => {
    if (prefersReducedMotion()) return;
    const ctx = gsap.context(() => {
      // Entrada do hero
      // fromTo com valores finais explícitos: imune a transições CSS e ao duplo efeito do StrictMode.
      const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
      tl.fromTo('[data-hero="eyebrow"]', { y: 20, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.8 })
        .fromTo('[data-hero="word"]', { yPercent: 110 }, { yPercent: 0, duration: 1.1, stagger: 0.06 }, '-=0.5')
        .fromTo('[data-hero="sub"]', { y: 24, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.9 }, '-=0.8')
        .fromTo('[data-hero="cta"]', { y: 20, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.8 }, '-=0.7')
        .fromTo('[data-hero="chips"]', { y: 12, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.6 }, '-=0.6')
        .fromTo('[data-hero="float"]', { autoAlpha: 0 }, { autoAlpha: 1, duration: 1.2, stagger: 0.15 }, '-=0.9');

      // Revelação ao rolar
      gsap.set('[data-reveal]', { y: 36, autoAlpha: 0 });
      ScrollTrigger.batch('[data-reveal]', {
        start: 'top 90%',
        once: true,
        onEnter: (els) => gsap.to(els, { y: 0, autoAlpha: 1, duration: 0.9, ease: 'expo.out', stagger: 0.08, overwrite: true }),
      });

      // Linha do tempo desenhando conforme o scroll
      gsap.fromTo('[data-timeline-line]', { scaleX: 0, scaleY: 0 }, {
        scaleX: 1, scaleY: 1, ease: 'none',
        scrollTrigger: { trigger: '[data-timeline]', start: 'top 70%', end: 'bottom 70%', scrub: 0.6 },
      });

      // "Como funciona" fixado (desktop)
      const mm = gsap.matchMedia();
      mm.add('(min-width: 1024px)', () => {
        let last = -1;
        ScrollTrigger.create({
          trigger: '[data-pin="how"]',
          start: 'top top',
          end: () => `+=${window.innerHeight * (STEPS.length - 0.4)}`,
          pin: true,
          anticipatePin: 1,
          onUpdate: (self) => {
            const idx = Math.min(STEPS.length - 1, Math.floor(self.progress * STEPS.length));
            if (idx !== last) { last = idx; setStep(idx); }
          },
        });
      });
    }, root);

    // Recalcula após fontes/imagens carregarem (evita posições erradas do pin)
    const refresh = () => ScrollTrigger.refresh();
    document.fonts?.ready.then(refresh);
    window.addEventListener('load', refresh);
    return () => { window.removeEventListener('load', refresh); ctx.revert(); };
  }, []);

  return (
    <div ref={root} className="relative overflow-x-clip">
      <LandingBackground />
      <a href="#como-funciona" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:rounded-lg focus:bg-lime-300 focus:px-4 focus:py-2 focus:text-bg-deep">
        Pular para o conteúdo
      </a>
      <LandingNav scrolled={scrolled} scrollTo={scrollTo} />
      <main className="relative z-10">
        <Hero scrollTo={scrollTo} />
        <div className="relative">
          {/* véu para dar contraste às seções sobre a cena 3D */}
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-bg/70 to-bg/90" />
          <div className="relative">
            <HowItWorks active={step} />
            <SmartHome />
            <ImpactStats />
            <Features />
            <Timeline />
            <FinalCta />
          </div>
        </div>
      </main>
      <div className="relative z-10"><Footer /></div>
    </div>
  );
}
