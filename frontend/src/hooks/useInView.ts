import { useEffect, useRef, useState } from 'react';

/** true quando o elemento entra na viewport (uma vez, por padrão). */
export function useNaTela<T extends Element>(opcoes: IntersectionObserverInit & { once?: boolean } = {}) {
  const { once = true, ...io } = opcoes;
  const ref = useRef<T | null>(null);
  const [naTela, setNaTela] = useState(false);
  useEffect(() => {
    const elemento = ref.current;
    if (!elemento) return;
    if (typeof IntersectionObserver === 'undefined') { setNaTela(true); return; }
    const observador = new IntersectionObserver(([entrada]) => {
      if (entrada.isIntersecting) { setNaTela(true); if (once) observador.disconnect(); }
      else if (!once) setNaTela(false);
    }, { threshold: 0.2, ...io });
    observador.observe(elemento);
    return () => observador.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [once]);
  return [ref, naTela] as const;
}
