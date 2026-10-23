import { useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { IconButton } from './IconButton';
import { useFocusTrap, useScrollLock } from './useFocusTrap';

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  side?: 'right' | 'left' | 'bottom';
  children?: ReactNode;
  footer?: ReactNode;
  /** Largura (lados) ou altura máx. (bottom). */
  className?: string;
  /** Esconde o cabeçalho padrão (título + X). */
  bare?: boolean;
}

const motionBySide = {
  right: { initial: { x: '100%' }, animate: { x: 0 }, exit: { x: '100%' } },
  left: { initial: { x: '-100%' }, animate: { x: 0 }, exit: { x: '-100%' } },
  bottom: { initial: { y: '100%' }, animate: { y: 0 }, exit: { y: '100%' } },
};
const placement = {
  right: 'inset-y-0 right-0 h-dvh w-[min(440px,92vw)] rounded-l-3xl border-l',
  left: 'inset-y-0 left-0 h-dvh w-[min(320px,86vw)] rounded-r-3xl border-r',
  bottom: 'inset-x-0 bottom-0 max-h-[88dvh] w-full rounded-t-3xl border-t pb-[env(safe-area-inset-bottom)]',
};

/** Painel lateral / inferior com foco preso. Ideal para detalhes e filtros no celular. */
export function Drawer({ open, onClose, title, description, side = 'right', children, footer, className, bare }: DrawerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useFocusTrap(ref, open, { onEscape: onClose });
  useScrollLock(open);

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[70]">
          <motion.div className="absolute inset-0 bg-[#010403]/65 backdrop-blur-[3px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} aria-hidden />
          <motion.div
            ref={ref}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            aria-label={title ? undefined : 'Painel'}
            tabIndex={-1}
            {...motionBySide[side]}
            transition={{ type: 'spring', damping: 34, stiffness: 340 }}
            className={cn('glass-strong absolute flex flex-col border-line-strong outline-none', placement[side], className)}
          >
            {side === 'bottom' && <div aria-hidden className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-white/15" />}
            {!bare && (
              <div className="flex items-start justify-between gap-4 px-5 pt-4 pb-2">
                <div className="min-w-0">
                  {title && <h2 id={titleId} className="font-display text-lg font-semibold">{title}</h2>}
                  {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
                </div>
                <IconButton icon={X} label="Fechar" size="sm" onClick={onClose} />
              </div>
            )}
            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5" data-lenis-prevent>{children}</div>
            {footer && <div className="flex gap-2 border-t border-line px-5 py-4">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
