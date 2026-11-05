import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { formatPercent } from '@/lib/format';

export interface ProgressBarProps {
  /** Fração 0..1 (mesma convenção da API: Level.progress, Goal.progress). */
  value: number;
  label?: ReactNode;
  /** Texto à direita (padrão: porcentagem). Passe null para ocultar. */
  valueLabel?: ReactNode | null;
  size?: 'xs' | 'sm' | 'md';
  /** Cor sólida custom (ex.: cor da categoria). Padrão: gradiente da marca. */
  color?: string;
  className?: string;
}

const heights = { xs: 'h-1', sm: 'h-1.5', md: 'h-2.5' };

/** Barra de progresso acessível. `<ProgressBar value={level.progress} label="Próximo nível" />` */
export function ProgressBar({ value, label, valueLabel, size = 'sm', color, className }: ProgressBarProps) {
  const v = Math.max(0, Math.min(1, value || 0));
  return (
    <div className={cn('w-full', className)}>
      {(label || valueLabel !== null) && (label || valueLabel) && (
        <div className="mb-1.5 flex items-center justify-between gap-2 text-xs">
          {label && <span className="text-muted">{label}</span>}
          {valueLabel !== null && <span className="font-medium text-fg-soft tabular">{valueLabel ?? formatPercent(v)}</span>}
        </div>
      )}
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(v * 100)}
        aria-label={typeof label === 'string' ? label : undefined}
        className={cn('relative w-full overflow-hidden rounded-full bg-white/6', heights[size])}
      >
        <div
          className={cn('h-full rounded-full transition-[width] duration-700 ease-[var(--ease-out-expo)]', !color && 'bg-brand-500')}
          style={{ width: `${v * 100}%`, ...(color ? { backgroundColor: color } : {}) }}
        />
      </div>
    </div>
  );
}

