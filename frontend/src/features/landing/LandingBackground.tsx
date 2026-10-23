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

/** Fundo estático (primeira pintura, movimento reduzido e fallback sem WebGL). */
export function StaticBackdrop({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn('absolute inset-0 overflow-hidden', className)}>
      <div className="absolute inset-0 bg-[radial-gradient(70%_60%_at_72%_42%,rgb(16_185_129/0.20),transparent_62%),radial-gradient(50%_40%_at_15%_85%,rgb(190_242_100/0.08),transparent_60%),radial-gradient(60%_50%_at_50%_-10%,rgb(5_150_105/0.18),transparent_60%)]" />
      <svg className="absolute top-[8%] left-1/2 h-[64vmin] w-[64vmin] -translate-x-1/2 opacity-70 sm:top-1/2 sm:left-[70%] sm:h-[78vmin] sm:w-[78vmin] sm:-translate-y-1/2" viewBox="0 0 200 200" fill="none">
        <defs>
          <linearGradient id="sb-ring" x1="20" y1="180" x2="180" y2="20" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#059669" /><stop offset=".55" stopColor="#22c55e" /><stop offset="1" stopColor="#bef264" />
          </linearGradient>
          <filter id="sb-blur" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="6" /></filter>
        </defs>
        <g transform="rotate(-20 100 100)">
          <ellipse cx="100" cy="100" rx="86" ry="34" stroke="url(#sb-ring)" strokeWidth="10" filter="url(#sb-blur)" opacity=".55" />
          <ellipse cx="100" cy="100" rx="86" ry="34" stroke="url(#sb-ring)" strokeWidth="1.6" strokeDasharray="1 3.5" strokeLinecap="round" />
        </g>
        <circle cx="100" cy="100" r="40" fill="url(#sb-ring)" opacity=".08" />
        <circle cx="100" cy="100" r="40" stroke="#34d399" strokeOpacity=".25" strokeDasharray="0.8 3" strokeLinecap="round" />
      </svg>
      <div className="absolute inset-0 grid-bg opacity-40" />
    </div>
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
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 bg-bg">
      <StaticBackdrop className={cn('transition-opacity duration-[1500ms]', ready && showScene ? 'opacity-0' : 'opacity-100')} />
      {showScene && (
        <div className={cn('absolute inset-0 transition-opacity duration-[1500ms]', ready ? 'opacity-100' : 'opacity-0')}>
          <Suspense fallback={null}>
            <HeroScene onReady={() => setReady(true)} onFail={() => setFailed(true)} />
          </Suspense>
        </div>
      )}
      {/* vinheta para legibilidade do texto */}
      <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_50%_40%,transparent_40%,rgb(3_10_7/0.85))]" />
    </div>
  );
}
