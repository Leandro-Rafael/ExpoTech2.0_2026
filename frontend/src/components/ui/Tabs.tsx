import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { motion } from 'motion/react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

interface ItemAba<V extends string = string> { value: V; label: ReactNode; icon?: LucideIcon; count?: number; disabled?: boolean }

export interface PropsAbas<V extends string> {
  itens: ItemAba<V>[];
  value: V;
  onChange: (value: V) => void;
  /** Prefixo de id para ligar abas ↔ painéis (use o mesmo em <TabPanel>). */
  idBase: string;
  variant?: 'pills' | 'underline';
  larguraTotal?: boolean;
  className?: string;
  'aria-label'?: string;
}

/**
 * Abas acessíveis (setas ←/→, Home/End). Indicador animado.
 *   <Tabs idBase="rk" items={[...]} value={scope} onChange={setScope} />
 *   <TabPanel idBase="rk" value={scope}>…</TabPanel>
 */
export function Abas<V extends string>({ itens, value, onChange, idBase, variant = 'pills', larguraTotal, className, ...aria }: PropsAbas<V>) {
  const listaRef = useRef<HTMLDivElement>(null);

  const aoTeclar = (e: KeyboardEvent) => {
    const habilitadas = itens.filter((i) => !i.disabled);
    const idx = habilitadas.findIndex((i) => i.value === value);
    let proxima = -1;
    if (e.key === 'ArrowRight') proxima = (idx + 1) % habilitadas.length;
    else if (e.key === 'ArrowLeft') proxima = (idx - 1 + habilitadas.length) % habilitadas.length;
    else if (e.key === 'Home') proxima = 0;
    else if (e.key === 'End') proxima = habilitadas.length - 1;
    if (proxima < 0) return;
    e.preventDefault();
    onChange(habilitadas[proxima].value);
    requestAnimationFrame(() => listaRef.current?.querySelector<HTMLElement>(`#${CSS.escape(`${idBase}-tab-${habilitadas[proxima].value}`)}`)?.focus());
  };

  return (
    <div
      ref={listaRef}
      role="tablist"
      aria-label={aria['aria-label']}
      onKeyDown={aoTeclar}
      className={cn(
        'relative flex max-w-full overflow-x-auto [scrollbar-width:none]',
        variant === 'pills' ? 'gap-1 rounded-xl border border-line bg-bg-deep/50 p-1' : 'gap-5 border-b border-line',
        larguraTotal && 'w-full',
        className,
      )}
    >
      {itens.map((item) => {
        const ativa = item.value === value;
        const Icone = item.icon;
        return (
          <button
            key={item.value}
            id={`${idBase}-tab-${item.value}`}
            role="tab"
            type="button"
            aria-selected={ativa}
            aria-controls={`${idBase}-panel-${item.value}`}
            tabIndex={ativa ? 0 : -1}
            disabled={item.disabled}
            onClick={() => onChange(item.value)}
            className={cn(
              'relative inline-flex shrink-0 items-center justify-center gap-2 text-sm font-medium whitespace-nowrap transition-colors disabled:opacity-40',
              variant === 'pills' ? 'h-9 rounded-lg px-3.5' : 'h-11 px-0.5',
              larguraTotal && 'flex-1',
              ativa ? 'text-fg' : 'text-muted hover:text-fg-soft',
            )}
          >
            {ativa && (
              <motion.span
                layoutId={`${idBase}-indicator`}
                aria-hidden
                transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                className={variant === 'pills'
                  ? 'absolute inset-0 rounded-lg border border-line-strong bg-surface-3 shadow-[0_1px_0_rgb(255_255_255/0.05)_inset]'
                  : 'absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-fg'}
              />
            )}
            <span className="relative z-10 inline-flex items-center gap-2">
              {Icone && <Icone className="size-4" aria-hidden />}
              {item.label}
              {item.count != null && (
                <span className={cn('rounded-full px-1.5 font-mono text-[11px] tabular', ativa ? 'bg-white/10 text-fg' : 'bg-white/5 text-muted')}>{item.count}</span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function PainelAba({ idBase, value, children, className }: { idBase: string; value: string; children: ReactNode; className?: string }) {
  return (
    <div role="tabpanel" id={`${idBase}-panel-${value}`} aria-labelledby={`${idBase}-tab-${value}`} tabIndex={0} className={cn('outline-none', className)}>
      {children}
    </div>
  );
}
