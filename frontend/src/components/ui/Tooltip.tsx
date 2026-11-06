import { cloneElement, isValidElement, useEffect, useId, useLayoutEffect, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface PropsDica {
  conteudo: ReactNode;
  lado?: 'top' | 'bottom' | 'left' | 'right';
  /** Um único elemento focável (botão, link...). */
  children: ReactElement;
  className?: string;
  atraso?: number;
}

const posicoes = {
  top: 'bottom-full left-1/2 mb-2 -translate-x-1/2',
  bottom: 'top-full left-1/2 mt-2 -translate-x-1/2',
  left: 'right-full top-1/2 mr-2 -translate-y-1/2',
  right: 'left-full top-1/2 ml-2 -translate-y-1/2',
};

/** Distância mínima do balão até a borda da janela. */
const MARGEM_BORDA = 8;
/** Igual ao duration-150 da transição: depois disso o balão sai do DOM. */
const SUMIR_MS = 150;

/**
 * Dica no hover e no foco do teclado (aria-describedby). Esc oculta.
 * O balão só existe no DOM enquanto visível (fechado ele alargaria a página
 * com rolagem horizontal) e é empurrado para dentro da janela perto das bordas.
 */
export function Dica({ conteudo, lado = 'top', children, className, atraso = 250 }: PropsDica) {
  const id = useId();
  const ref = useRef<HTMLSpanElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const [montado, setMontado] = useState(false);
  const [aberto, setAberto] = useState(false);
  const [deslocamento, setDeslocamento] = useState(0);

  const mostrar = () => { clearTimeout(timer.current); timer.current = window.setTimeout(() => setMontado(true), montado ? 0 : atraso); };
  const esconder = () => { clearTimeout(timer.current); setAberto(false); timer.current = window.setTimeout(() => setMontado(false), SUMIR_MS); };

  useEffect(() => () => clearTimeout(timer.current), []);

  // Ao montar: mede, corrige a posição horizontal e só então dispara o fade de entrada.
  useLayoutEffect(() => {
    if (!montado) { setDeslocamento(0); return; }
    const r = ref.current?.getBoundingClientRect();
    const w = document.documentElement.clientWidth;
    if (r) setDeslocamento(r.right > w - MARGEM_BORDA ? w - MARGEM_BORDA - r.right : r.left < MARGEM_BORDA ? MARGEM_BORDA - r.left : 0);
    const raf = requestAnimationFrame(() => setAberto(true));
    return () => cancelAnimationFrame(raf);
  }, [montado]);

  const filho = isValidElement(children)
    ? cloneElement(children as ReactElement<Record<string, unknown>>, { 'aria-describedby': aberto ? id : undefined })
    : children;

  return (
    <span
      className="relative inline-flex"
      onPointerEnter={mostrar}
      onPointerLeave={esconder}
      onFocus={mostrar}
      onBlur={esconder}
      onKeyDown={(e) => e.key === 'Escape' && esconder()}
    >
      {filho}
      {montado && (
        <span
          ref={ref}
          role="tooltip"
          id={id}
          style={deslocamento ? (lado === 'left' ? { marginRight: -deslocamento } : { marginLeft: deslocamento }) : undefined}
          className={cn(
            'pointer-events-none absolute z-[90] w-max max-w-64 rounded-lg border border-line-strong bg-elevated px-2.5 py-1.5 text-xs leading-snug text-fg-soft shadow-pop',
            'transition-[opacity,transform] duration-150',
            aberto ? 'scale-100 opacity-100' : 'scale-95 opacity-0',
            posicoes[lado], className,
          )}
          aria-hidden={!aberto}
        >
          {conteudo}
        </span>
      )}
    </span>
  );
}
