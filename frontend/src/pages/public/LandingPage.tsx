import { lazy, Suspense, useEffect, useState } from 'react';
import { useTituloDocumento } from '@/hooks/useDocumentTitle';
import { prefereMenosMovimento } from '@/hooks/useReducedMotion';
import { FundoLanding } from '@/features/landing/LandingBackground';
import { Abertura, NavegacaoLanding } from '@/features/landing/hero';
import { useRolagemSuave } from '@/features/landing/useSmoothScroll';

const RestoLanding = lazy(() => import('@/features/landing/LandingRest'));
const RodapeLanding = lazy(() => import('@/features/landing/LandingRest').then((m) => ({ default: m.RodapeLanding })));

type JanelaOciosa = Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };

/**
 * Landing page — vitrine do projeto (cena 3D + scroll storytelling).
 * Desempenho: nav + hero entram no bundle da rota (pintura instantânea, sem GSAP);
 * a cena 3D (three), o scroll suave (lenis/gsap) e as seções abaixo da dobra são lazy.
 */
export default function PaginaInicial() {
  useTituloDocumento(null);
  const rolarSuave = useRolagemSuave();
  const [restoLiberado, setRestoLiberado] = useState(() => prefereMenosMovimento());

  useEffect(() => {
    if (restoLiberado) return;
    const janela = window as JanelaOciosa;
    const id = janela.requestIdleCallback ? janela.requestIdleCallback(() => setRestoLiberado(true), { timeout: 900 }) : window.setTimeout(() => setRestoLiberado(true), 200);
    return () => { if (janela.cancelIdleCallback) janela.cancelIdleCallback(id); else clearTimeout(id); };
  }, [restoLiberado]);

  // Âncora clicada antes das seções montarem: monta e rola assim que o alvo existir.
  const rolarAte = (alvo: string) => {
    if (document.querySelector(alvo)) return rolarSuave(alvo);
    setRestoLiberado(true);
    let tentativas = 0;
    const esperar = () => {
      if (document.querySelector(alvo)) rolarSuave(alvo);
      else if (tentativas++ < 60) requestAnimationFrame(esperar);
    };
    requestAnimationFrame(esperar);
  };

  return (
    <div className="relative overflow-x-clip">
      <FundoLanding />
      <a href="#como-funciona" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:rounded-lg focus:bg-lime-300 focus:px-4 focus:py-2 focus:text-bg-deep">
        Pular para o conteúdo
      </a>
      <NavegacaoLanding rolarPara={rolarAte} />
      <main className="relative z-10">
        <Abertura rolarPara={rolarAte} />
        {restoLiberado ? (
          <Suspense fallback={<div aria-hidden className="h-[400vh]" />}>
            <RestoLanding />
          </Suspense>
        ) : (
          <div aria-hidden className="h-[400vh]" />
        )}
      </main>
      {restoLiberado && <Suspense fallback={null}><RodapeLanding /></Suspense>}
    </div>
  );
}
