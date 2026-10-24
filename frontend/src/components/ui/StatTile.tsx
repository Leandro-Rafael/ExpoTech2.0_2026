import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatNumber, formatPercent } from '@/lib/format';
import { useCountUpText } from '@/hooks/useCountUp';
import { useInView } from '@/hooks/useInView';
import { Skeleton } from './Skeleton';

export interface StatTileProps {
  label: ReactNode;
  value: number | null | undefined;
  /** Formata o número animado (padrão: inteiro pt-BR). Ex.: `(v) => formatKg(v)` */
  format?: (v: number) => string;
  icon?: LucideIcon;
  /** Variação relativa (0.12 = +12%). */
  delta?: number | null;
  deltaLabel?: string;
  hint?: ReactNode;
  /** Cor de destaque do ícone. */
  accent?: 'brand' | 'lime' | 'info' | 'warning' | 'danger';
  loading?: boolean;
  /** Destaque com borda em gradiente. */
  highlight?: boolean;
  className?: string;
}

const accents = {
  brand: 'text-brand-300 bg-brand-500/12 border-brand-400/20',
  lime: 'text-lime-300 bg-lime-300/10 border-lime-300/20',
  info: 'text-info bg-info/10 border-info/20',
  warning: 'text-warning bg-warning/10 border-warning/20',
  danger: 'text-danger bg-danger/10 border-danger/20',
};

/** KPI com contagem animada ao entrar na tela. `<StatTile label="CO₂ evitado" value={x} format={formatKg} icon={Leaf} />` */
export function StatTile({ label, value, format = (v) => formatNumber(v), icon: Icon, delta, deltaLabel, hint, accent = 'brand', loading, highlight, className }: StatTileProps) {
  const [ref, inView] = useInView<HTMLDivElement>();
  const numRef = useCountUpText<HTMLParagraphElement>(value ?? 0, format, { start: inView && value != null });
  return (
    <div ref={ref} className={cn('glass relative overflow-hidden rounded-2xl p-5', highlight && 'ring-gradient shadow-glow', className)}>
      <div aria-hidden className="pointer-events-none absolute -top-20 -right-20 size-52 bg-[radial-gradient(closest-side,rgb(16_185_129/0.14),transparent)]" />
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-medium text-muted">{label}</p>
        {Icon && (
          <span className={cn('inline-flex size-9 shrink-0 items-center justify-center rounded-xl border', accents[accent])}>
            <Icon className="size-[18px]" aria-hidden />
          </span>
        )}
      </div>
      <div className="mt-2">
        {loading || value == null ? (
          loading ? <Skeleton className="h-9 w-32" /> : <p className="font-display text-3xl font-semibold text-subtle">—</p>
        ) : (
          <p ref={numRef} className="font-display text-[28px] leading-tight font-semibold tracking-tight text-fg tabular sm:text-3xl" />
        )}
      </div>
      {(delta != null || hint) && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          {delta != null && (
            <span className={cn('inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-medium', delta >= 0 ? 'bg-success/12 text-success' : 'bg-danger/12 text-danger')}>
              {delta >= 0 ? <TrendingUp className="size-3" aria-hidden /> : <TrendingDown className="size-3" aria-hidden />}
              {delta >= 0 ? '+' : ''}{formatPercent(delta, 1)}
            </span>
          )}
          {deltaLabel && <span className="text-muted">{deltaLabel}</span>}
          {hint && <span className="text-muted">{hint}</span>}
        </div>
      )}
    </div>
  );
}
