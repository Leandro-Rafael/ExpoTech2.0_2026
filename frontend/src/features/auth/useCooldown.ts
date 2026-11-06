import { useEffect, useState } from 'react';

/** Contagem regressiva em segundos (ex.: Retry-After de um 429). */
export function useEspera() {
  const [ate, setAte] = useState<number | null>(null);
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    if (!ate) return;
    const t = setInterval(() => {
      const n = Date.now();
      setAgora(n);
      if (n >= ate) { setAte(null); clearInterval(t); }
    }, 250);
    return () => clearInterval(t);
  }, [ate]);
  const restante = ate ? Math.max(0, Math.ceil((ate - agora) / 1000)) : 0;
  return {
    remaining: restante,
    active: restante > 0,
    start: (segundos: number) => { setAgora(Date.now()); setAte(Date.now() + segundos * 1000); },
  };
}
