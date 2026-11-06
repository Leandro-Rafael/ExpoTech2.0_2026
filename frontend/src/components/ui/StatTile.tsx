import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatarNumero, formatarPercentual } from '@/lib/format';
import { useContagemTexto } from '@/hooks/useCountUp';
import { useNaTela } from '@/hooks/useInView';
import { Esqueleto } from './Skeleton';

export interface PropsCartaoIndicador {
  label: ReactNode;
  value: number | null | undefined;
  /** Formata o número animado (padrão: inteiro pt-BR). Ex.: `(v) => formatKg(v)` */
  formato?: (v: number) => string;
  icon?: LucideIcon;
  /** Variação relativa (0.12 = +12%). */
  delta?: number | null;
  rotuloDelta?: string;
  dica?: ReactNode;
  /** Legado: ignorado (KPIs são neutros; cor só na variação positiva/negativa). */
  acento?: 'brand' | 'lime' | 'info' | 'warning' | 'danger';
  carregando?: boolean;
  /** Superfície elevada. Use em 1 KPI por grupo, no máximo. */
  destaque?: boolean;
  /** "card" (padrão) ou "plain" (sem caixa, para grupos com divisórias). */
  variant?: 'card' | 'plain';
  className?: string;
}

/** KPI: número em mono com contagem ao entrar na tela. `<StatTile label="CO₂ evitado" value={x} format={formatKg} icon={Leaf} />` */
export function CartaoIndicador({ label, value, formato = (v) => formatarNumero(v), icon: Icone, delta, rotuloDelta, dica, carregando, destaque, variant = 'card', className }: PropsCartaoIndicador) {
  const [ref, naTela] = useNaTela<HTMLDivElement>();
  const numeroRef = useContagemTexto<HTMLParagraphElement>(value ?? 0, formato, { start: naTela && value != null });
  return (
    <div ref={ref} className={cn(variant === 'card' && (destaque ? 'surface-raised' : 'surface'), variant === 'card' && 'rounded-2xl p-5', className)}>
      <div className="flex items-center justify-between gap-3">
        <p className="label-mono">{label}</p>
        {Icone && <Icone className="size-4 shrink-0 text-subtle" aria-hidden />}
      </div>
      <div className="mt-3">
        {carregando || value == null ? (
          carregando ? <Esqueleto className="h-9 w-32" /> : <p className="font-mono text-3xl text-subtle">—</p>
        ) : (
          <p ref={numeroRef} className="font-mono text-[28px] leading-tight font-medium tracking-[-0.03em] text-fg tabular sm:text-[32px]" />
        )}
      </div>
      {(delta != null || dica) && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          {delta != null && (
            <span className={cn('inline-flex items-center gap-1 font-mono font-medium', delta >= 0 ? 'text-success' : 'text-danger')}>
              {delta >= 0 ? <TrendingUp className="size-3" aria-hidden /> : <TrendingDown className="size-3" aria-hidden />}
              {delta >= 0 ? '+' : ''}{formatarPercentual(delta, 1)}
            </span>
          )}
          {rotuloDelta && <span className="text-subtle">{rotuloDelta}</span>}
          {dica && <span className="text-subtle">{dica}</span>}
        </div>
      )}
    </div>
  );
}
