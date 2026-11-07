import { lazy, Suspense, useEffect, useState } from 'react';
import { useMovimentoReduzido } from '@/hooks/useReducedMotion';
import { cn } from '@/lib/cn';

export const CenaAbertura = lazy(() => import('./HeroScene'));

function temWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

/** Único brilho ambiente (estático), atrás do anel. Funciona como "bloom" barato. */
function BrilhoAmbiente() {
  return (
    <div aria-hidden className="absolute inset-0 bg-[radial-gradient(42%_50%_at_74%_50%,rgb(16_185_129/0.13),transparent_70%)] max-sm:bg-[radial-gradient(80%_38%_at_50%_24%,rgb(16_185_129/0.15),transparent_70%)]" />
  );
}

/**
 * Fundo estático = um quadro real da própria cena 3D (public/scene/*.webp, ~40 KB).
 * Usado na primeira pintura, com movimento reduzido e como fallback sem WebGL/GPU fraca:
 * o visual é o mesmo da cena animada.
 */
function FundoEstatico({ className }: { className?: string }) {
  return (
    <picture aria-hidden className={cn('absolute inset-0', className)}>
      <source media="(max-width: 767px)" srcSet="/scene/ring-mobile.webp" type="image/webp" />
      <img
        src="/scene/ring-desktop.webp"
        alt=""
        decoding="async"
        fetchPriority="low"
        className="size-full object-cover object-[right_center] max-md:object-top"
      />
    </picture>
  );
}

/**
 * Liga a cena 3D quando o navegador fica ocioso (só com WebGL e sem "reduzir movimento").
 * `visivel` diz quando a cena já desenhou e pode substituir o quadro estático (crossfade).
 * Usado pela landing e pelo painel das telas de login/cadastro.
 */
export function useCena3D(ativo = true) {
  const reduzido = useMovimentoReduzido();
  const [montar, setMontar] = useState(false);
  const [pronta, setPronta] = useState(false);
  const [falhou, setFalhou] = useState(false);
  const [sumindo, setSumindo] = useState(false);
  // Falha/desempenho ruim: crossfade para o estático e só então desmonta a cena.
  const aoFalhar = () => { setSumindo(true); window.setTimeout(() => setFalhou(true), 1600); };

  useEffect(() => {
    if (!ativo || reduzido || !temWebGL()) return;
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
    let id: number;
    if (w.requestIdleCallback) id = w.requestIdleCallback(() => setMontar(true), { timeout: 1200 });
    else id = window.setTimeout(() => setMontar(true), 300);
    return () => { if (w.cancelIdleCallback) w.cancelIdleCallback(id); else clearTimeout(id); };
  }, [ativo, reduzido]);

  const mostrarCena = ativo && montar && !falhou && !reduzido;
  return { mostrarCena, visivel: mostrarCena && pronta && !sumindo, aoFicarPronta: () => setPronta(true), aoFalhar };
}

/**
 * Fundo fixo da landing. Pinta o estático imediatamente e, quando o navegador
 * fica ocioso, carrega a cena WebGL (chunk "three") e faz crossfade.
 */
export function FundoLanding() {
  const cena = useCena3D();
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 bg-bg [contain:strict] [will-change:transform]">
      <BrilhoAmbiente />
      <FundoEstatico className={cn('transition-opacity duration-[1500ms]', cena.visivel ? 'opacity-0' : 'opacity-100')} />
      {cena.mostrarCena && (
        <div className={cn('absolute inset-0 transition-opacity duration-[1500ms]', cena.visivel ? 'opacity-100' : 'opacity-0')}>
          <Suspense fallback={null}>
            <CenaAbertura onReady={cena.aoFicarPronta} onFail={cena.aoFalhar} />
          </Suspense>
        </div>
      )}
      {/* vinheta sutil para legibilidade */}
      <div className="absolute inset-0 bg-[radial-gradient(130%_100%_at_60%_45%,transparent_55%,rgb(10_14_12/0.7))]" />
    </div>
  );
}
