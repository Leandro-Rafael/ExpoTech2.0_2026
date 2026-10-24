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
  /** Legado: ignorado (KPIs são neutros; cor só na variação positiva/negativa). */
  accent?: 'brand' | 'lime' | 'info' | 'warning' | 'danger';
  loading?: boolean;
  /** Superfície elevada. Use em 1 KPI por grupo, no máximo. */
  highlight?: boolean;
  /** "card" (padrão) ou "plain" (sem caixa, para grupos com divisórias). */
  variant?: 'card' | 'plain';
  className?: string;
}

/** KPI: número em mono com contagem ao entrar na tela. `<StatTile label="CO₂ evitado" value={x} format={formatKg} icon={Leaf} />` */
export function StatTile({ label, value, format = (v) => formatNumber(v), icon: Icon, delta, deltaLabel, hint, loading, highlight, variant = 'card', className }: StatTileProps) {
  const [ref, inView] = useInView<HTMLDivElement>();
  const numRef = useCountUpText<HTMLParagraphElement>(value ?? 0, format, { start: inView && value != null });
  return (
    <div ref={ref} className={cn(variant === 'card' && (highlight ? 'surface-raised' : 'surface'), variant === 'card' && 'rounded-2xl p-5', className)}>
      <div className="flex items-center justify-between gap-3">
        <p className="label-mono">{label}</p>
        {Icon && <Icon className="size-4 shrink-0 text-subtle" aria-hidden />}
      </div>
      <div className="mt-3">
        {loading || value == null ? (
          loading ? <Skeleton className="h-9 w-32" /> : <p className="font-mono text-3xl text-subtle">—</p>
        ) : (
          <p ref={numRef} className="font-mono text-[28px] leading-tight font-medium tracking-[-0.03em] text-fg tabular sm:text-[32px]" />
        )}
      </div>
      {(delta != null || hint) && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          {delta != null && (
            <span className={cn('inline-flex items-center gap-1 font-mono font-medium', delta >= 0 ? 'text-success' : 'text-danger')}>
              {delta >= 0 ? <TrendingUp className="size-3" aria-hidden /> : <TrendingDown className="size-3" aria-hidden />}
              {delta >= 0 ? '+' : ''}{formatPercent(delta, 1)}
            </span>
          )}
          {deltaLabel && <span className="text-subtle">{deltaLabel}</span>}
          {hint && <span className="text-subtle">{hint}</span>}
        </div>
      )}
    </div>
  );
}
