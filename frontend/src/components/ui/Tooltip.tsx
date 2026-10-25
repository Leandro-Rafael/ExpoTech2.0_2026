import { cloneElement, isValidElement, useEffect, useId, useLayoutEffect, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface TooltipProps {
  content: ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
  /** Um único elemento focável (botão, link...). */
  children: ReactElement;
  className?: string;
  delay?: number;
}

const pos = {
  top: 'bottom-full left-1/2 mb-2 -translate-x-1/2',
  bottom: 'top-full left-1/2 mt-2 -translate-x-1/2',
  left: 'right-full top-1/2 mr-2 -translate-y-1/2',
  right: 'left-full top-1/2 ml-2 -translate-y-1/2',
};

/** Distância mínima do balão até a borda da janela. */
const EDGE = 8;
/** Igual ao duration-150 da transição: depois disso o balão sai do DOM. */
const FADE_MS = 150;

/**
 * Dica no hover e no foco do teclado (aria-describedby). Esc oculta.
 * O balão só existe no DOM enquanto visível (fechado ele alargaria a página
 * com rolagem horizontal) e é empurrado para dentro da janela perto das bordas.
 */
export function Tooltip({ content, side = 'top', children, className, delay = 250 }: TooltipProps) {
  const id = useId();
  const ref = useRef<HTMLSpanElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [shift, setShift] = useState(0);

  const show = () => { clearTimeout(timer.current); timer.current = window.setTimeout(() => setMounted(true), mounted ? 0 : delay); };
  const hide = () => { clearTimeout(timer.current); setOpen(false); timer.current = window.setTimeout(() => setMounted(false), FADE_MS); };

  useEffect(() => () => clearTimeout(timer.current), []);

  // Ao montar: mede, corrige a posição horizontal e só então dispara o fade de entrada.
  useLayoutEffect(() => {
    if (!mounted) { setShift(0); return; }
    const r = ref.current?.getBoundingClientRect();
    const w = document.documentElement.clientWidth;
    if (r) setShift(r.right > w - EDGE ? w - EDGE - r.right : r.left < EDGE ? EDGE - r.left : 0);
    const raf = requestAnimationFrame(() => setOpen(true));
    return () => cancelAnimationFrame(raf);
  }, [mounted]);

  const child = isValidElement(children)
    ? cloneElement(children as ReactElement<Record<string, unknown>>, { 'aria-describedby': open ? id : undefined })
    : children;

  return (
    <span
      className="relative inline-flex"
      onPointerEnter={show}
      onPointerLeave={hide}
      onFocus={show}
      onBlur={hide}
      onKeyDown={(e) => e.key === 'Escape' && hide()}
    >
      {child}
      {mounted && (
        <span
          ref={ref}
          role="tooltip"
          id={id}
          style={shift ? (side === 'left' ? { marginRight: -shift } : { marginLeft: shift }) : undefined}
          className={cn(
            'pointer-events-none absolute z-[90] w-max max-w-64 rounded-lg border border-line-strong bg-elevated px-2.5 py-1.5 text-xs leading-snug text-fg-soft shadow-pop',
            'transition-[opacity,transform] duration-150',
            open ? 'scale-100 opacity-100' : 'scale-95 opacity-0',
            pos[side], className,
          )}
          aria-hidden={!open}
        >
          {content}
        </span>
      )}
    </span>
  );
}
