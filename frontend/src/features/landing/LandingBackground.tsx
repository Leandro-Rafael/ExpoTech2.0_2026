import { lazy, Suspense, useEffect, useState } from 'react';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { cn } from '@/lib/cn';

const HeroScene = lazy(() => import('./HeroScene'));

function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

/** Único brilho ambiente (estático), atrás do anel. Funciona como "bloom" barato. */
function AmbientGlow() {
  return (
    <div aria-hidden className="absolute inset-0 bg-[radial-gradient(42%_50%_at_74%_50%,rgb(16_185_129/0.13),transparent_70%)] max-sm:bg-[radial-gradient(80%_38%_at_50%_24%,rgb(16_185_129/0.15),transparent_70%)]" />
  );
}

/**
 * Fundo estático = um quadro real da própria cena 3D (public/scene/*.webp, ~40 KB).
 * Usado na primeira pintura, com movimento reduzido e como fallback sem WebGL/GPU fraca:
 * o visual é o mesmo da cena animada.
 */
function StaticBackdrop({ className }: { className?: string }) {
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
 * Fundo fixo da landing. Pinta o estático imediatamente e, quando o navegador
 * fica ocioso, carrega a cena WebGL (chunk "three") e faz crossfade.
 */
export function LandingBackground() {
  const reduced = useReducedMotion();
  const [mount, setMount] = useState(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [fading, setFading] = useState(false);
  // Falha/desempenho ruim: crossfade para o estático e só então desmonta a cena.
  const handleFail = () => { setFading(true); window.setTimeout(() => setFailed(true), 1600); };

  useEffect(() => {
    if (reduced || !hasWebGL()) return;
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
    let id: number;
    if (w.requestIdleCallback) id = w.requestIdleCallback(() => setMount(true), { timeout: 1200 });
    else id = window.setTimeout(() => setMount(true), 300);
    return () => { if (w.cancelIdleCallback) w.cancelIdleCallback(id); else clearTimeout(id); };
  }, [reduced]);

  const showScene = mount && !failed && !reduced;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 bg-bg [contain:strict] [will-change:transform]">
      <AmbientGlow />
      <StaticBackdrop className={cn('transition-opacity duration-[1500ms]', ready && showScene && !fading ? 'opacity-0' : 'opacity-100')} />
      {showScene && (
        <div className={cn('absolute inset-0 transition-opacity duration-[1500ms]', ready && !fading ? 'opacity-100' : 'opacity-0')}>
          <Suspense fallback={null}>
            <HeroScene onReady={() => setReady(true)} onFail={handleFail} />
          </Suspense>
        </div>
      )}
      {/* vinheta sutil para legibilidade */}
      <div className="absolute inset-0 bg-[radial-gradient(130%_100%_at_60%_45%,transparent_55%,rgb(10_14_12/0.7))]" />
    </div>
  );
}
