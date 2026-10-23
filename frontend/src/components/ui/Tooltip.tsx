import { cloneElement, isValidElement, useId, useState, type ReactElement, type ReactNode } from 'react';
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

/** Dica no hover e no foco do teclado (aria-describedby). Esc oculta. */
export function Tooltip({ content, side = 'top', children, className, delay = 250 }: TooltipProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [timer, setTimer] = useState<number | null>(null);
  const show = () => { if (timer) clearTimeout(timer); setTimer(window.setTimeout(() => setOpen(true), delay)); };
  const hide = () => { if (timer) clearTimeout(timer); setOpen(false); };

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
      <span
        role="tooltip"
        id={id}
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
    </span>
  );
}
