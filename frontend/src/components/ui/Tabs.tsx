import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { motion } from 'motion/react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface TabItem<V extends string = string> { value: V; label: ReactNode; icon?: LucideIcon; count?: number; disabled?: boolean }

export interface TabsProps<V extends string> {
  items: TabItem<V>[];
  value: V;
  onChange: (value: V) => void;
  /** Prefixo de id para ligar abas ↔ painéis (use o mesmo em <TabPanel>). */
  idBase: string;
  variant?: 'pills' | 'underline';
  fullWidth?: boolean;
  className?: string;
  'aria-label'?: string;
}

/**
 * Abas acessíveis (setas ←/→, Home/End). Indicador animado.
 *   <Tabs idBase="rk" items={[...]} value={scope} onChange={setScope} />
 *   <TabPanel idBase="rk" value={scope}>…</TabPanel>
 */
export function Tabs<V extends string>({ items, value, onChange, idBase, variant = 'pills', fullWidth, className, ...aria }: TabsProps<V>) {
  const listRef = useRef<HTMLDivElement>(null);

  const onKeyDown = (e: KeyboardEvent) => {
    const enabled = items.filter((i) => !i.disabled);
    const idx = enabled.findIndex((i) => i.value === value);
    let next = -1;
    if (e.key === 'ArrowRight') next = (idx + 1) % enabled.length;
    else if (e.key === 'ArrowLeft') next = (idx - 1 + enabled.length) % enabled.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = enabled.length - 1;
    if (next < 0) return;
    e.preventDefault();
    onChange(enabled[next].value);
    requestAnimationFrame(() => listRef.current?.querySelector<HTMLElement>(`#${CSS.escape(`${idBase}-tab-${enabled[next].value}`)}`)?.focus());
  };

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={aria['aria-label']}
      onKeyDown={onKeyDown}
      className={cn(
        'relative flex max-w-full overflow-x-auto [scrollbar-width:none]',
        variant === 'pills' ? 'gap-1 rounded-xl border border-line bg-bg-deep/50 p-1' : 'gap-5 border-b border-line',
        fullWidth && 'w-full',
        className,
      )}
    >
      {items.map((item) => {
        const active = item.value === value;
        const Icon = item.icon;
        return (
          <button
            key={item.value}
            id={`${idBase}-tab-${item.value}`}
            role="tab"
            type="button"
            aria-selected={active}
            aria-controls={`${idBase}-panel-${item.value}`}
            tabIndex={active ? 0 : -1}
            disabled={item.disabled}
            onClick={() => onChange(item.value)}
            className={cn(
              'relative inline-flex shrink-0 items-center justify-center gap-2 text-sm font-medium whitespace-nowrap transition-colors disabled:opacity-40',
              variant === 'pills' ? 'h-9 rounded-lg px-3.5' : 'h-11 px-0.5',
              fullWidth && 'flex-1',
              active ? 'text-fg' : 'text-muted hover:text-fg-soft',
            )}
          >
            {active && (
              <motion.span
                layoutId={`${idBase}-indicator`}
                aria-hidden
                transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                className={variant === 'pills'
                  ? 'absolute inset-0 rounded-lg border border-line-strong bg-surface-3 shadow-[0_1px_0_rgb(255_255_255/0.05)_inset]'
                  : 'absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-brand-gradient'}
              />
            )}
            <span className="relative z-10 inline-flex items-center gap-2">
              {Icon && <Icon className="size-4" aria-hidden />}
              {item.label}
              {item.count != null && (
                <span className={cn('rounded-full px-1.5 text-[11px] tabular', active ? 'bg-brand-400/20 text-brand-300' : 'bg-white/5 text-muted')}>{item.count}</span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function TabPanel({ idBase, value, children, className }: { idBase: string; value: string; children: ReactNode; className?: string }) {
  return (
    <div role="tabpanel" id={`${idBase}-panel-${value}`} aria-labelledby={`${idBase}-tab-${value}`} tabIndex={0} className={cn('outline-none', className)}>
      {children}
    </div>
  );
}
