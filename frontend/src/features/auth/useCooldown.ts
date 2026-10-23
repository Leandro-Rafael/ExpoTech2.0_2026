import { useEffect, useState } from 'react';

/** Contagem regressiva em segundos (ex.: Retry-After de um 429). */
export function useCooldown() {
  const [until, setUntil] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!until) return;
    const t = setInterval(() => {
      const n = Date.now();
      setNow(n);
      if (n >= until) { setUntil(null); clearInterval(t); }
    }, 250);
    return () => clearInterval(t);
  }, [until]);
  const remaining = until ? Math.max(0, Math.ceil((until - now) / 1000)) : 0;
  return {
    remaining,
    active: remaining > 0,
    start: (seconds: number) => { setNow(Date.now()); setUntil(Date.now() + seconds * 1000); },
  };
}
