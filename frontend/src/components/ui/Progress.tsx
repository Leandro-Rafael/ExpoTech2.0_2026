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
          className={cn('h-full rounded-full transition-[width] duration-700 ease-[var(--ease-out-expo)]', !color && 'bg-brand-gradient')}
          style={{ width: `${v * 100}%`, ...(color ? { backgroundColor: color } : {}) }}
        />
      </div>
    </div>
  );
}

export interface ProgressRingProps {
  value: number; // 0..1
  size?: number;
  stroke?: number;
  children?: ReactNode;
  color?: string;
  className?: string;
  label?: string;
}

/** Anel de progresso (SVG). Conteúdo central via children. */
export function ProgressRing({ value, size = 96, stroke = 8, children, color, className, label }: ProgressRingProps) {
  const v = Math.max(0, Math.min(1, value || 0));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const gid = `pr-${size}-${stroke}`;
  return (
    <div className={cn('relative inline-flex items-center justify-center', className)} style={{ width: size, height: size }}
      role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v * 100)} aria-label={label}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#10b981" /><stop offset="1" stopColor="#bef264" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgb(255 255 255 / 0.07)" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} strokeLinecap="round"
          stroke={color ?? `url(#${gid})`} strokeDasharray={c} strokeDashoffset={c * (1 - v)}
          style={{ transition: 'stroke-dashoffset 1s var(--ease-out-expo)' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}
