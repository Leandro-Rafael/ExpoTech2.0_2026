import { useId, useRef, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { BotaoIcone } from './IconButton';
import { usePrenderFoco, useTravarRolagem } from './useFocusTrap';

export interface PropsModal {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  /** Rodapé fixo (botões). */
  rodape?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Fecha ao clicar fora (padrão true). Desative em formulários longos. */
  fecharAoClicarFora?: boolean;
  /** Elemento a focar ao abrir (padrão: [data-autofocus] ou o primeiro focável). */
  focoInicial?: RefObject<HTMLElement | null>;
  /** Esconde o botão X. */
  esconderFechar?: boolean;
  className?: string;
}

const larguras = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };

/**
 * Diálogo modal acessível: portal, foco preso, Esc fecha, scroll travado, foco devolvido.
 * No celular vira um "sheet" ancorado embaixo.
 *
 *   <Modal open={open} onClose={() => setOpen(false)} title="Novo ecoponto" footer={<Button>Salvar</Button>}>…</Modal>
 */
export function Modal({ open, onClose, title, description, children, rodape, size = 'md', fecharAoClicarFora = true, focoInicial, esconderFechar, className }: PropsModal) {
  const ref = useRef<HTMLDivElement>(null);
  const idTitulo = useId();
  const idDescricao = useId();
  usePrenderFoco(ref, open, { onEscape: onClose, focoInicial });
  useTravarRolagem(open);

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-6">
          <motion.div
            className="absolute inset-0 bg-[#010403]/70 backdrop-blur-sm"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={fecharAoClicarFora ? onClose : undefined}
            aria-hidden
          />
          <motion.div
            ref={ref}
            role="dialog"
            aria-modal="true"
            aria-labelledby={idTitulo}
            aria-describedby={description ? idDescricao : undefined}
            tabIndex={-1}
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ type: 'spring', damping: 30, stiffness: 380 }}
            className={cn(
              'glass-strong relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl outline-none sm:rounded-3xl',
              larguras[size], className,
            )}
          >
            <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-3 sm:px-6 sm:pt-6">
              <div className="min-w-0">
                <h2 id={idTitulo} className="font-sans text-lg font-semibold tracking-tight text-fg">{title}</h2>
                {description && <p id={idDescricao} className="mt-1 text-sm text-muted">{description}</p>}
              </div>
              {!esconderFechar && <BotaoIcone icon={X} label="Fechar" size="sm" onClick={onClose} className="-mt-1 -mr-1" />}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 sm:px-6 sm:pb-6" data-lenis-prevent>{children}</div>
            {rodape && (
              <div className="flex flex-col-reverse gap-2 border-t border-line bg-bg-deep/40 px-5 py-4 sm:flex-row sm:justify-end sm:px-6 pb-[max(1rem,env(safe-area-inset-bottom))]">
                {rodape}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

