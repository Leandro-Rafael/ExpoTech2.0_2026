import { useId, useState, type ReactNode } from 'react';
import { Table2 } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface LegendItem { label: string; color: string; dashed?: boolean }

/** Legenda em HTML: amostra colorida + texto em tinta neutra (texto nunca usa a cor da série). */
export function ChartLegend({ items, className }: { items: LegendItem[]; className?: string }) {
  if (items.length < 2) return null;
  return (
    <ul className={cn('flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted', className)}>
      {items.map((i) => (
        <li key={i.label} className="inline-flex items-center gap-1.5">
          {i.dashed ? (
            <svg width="14" height="4" aria-hidden><line x1="0" y1="2" x2="14" y2="2" stroke={i.color} strokeWidth="2" strokeDasharray="3 2" /></svg>
          ) : (
            <span aria-hidden className="inline-block h-[3px] w-3.5 rounded-full" style={{ backgroundColor: i.color }} />
          )}
          {i.label}
        </li>
      ))}
    </ul>
  );
}

export interface ChartTable {
  columns: string[];
  rows: (string | number)[][];
}

export interface ChartFrameProps {
  title?: ReactNode;
  /** Uma linha explicando o que o gráfico mostra (unidade, período). */
  description?: ReactNode;
  /** Resumo textual para leitores de tela (o que o gráfico conclui). */
  summary?: string;
  legend?: LegendItem[];
  /** Tabela equivalente (acessibilidade + "ver dados"). */
  table?: ChartTable;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * Moldura padrão de gráfico: título (h3 Geist), descrição, legenda, gráfico e tabela de dados alternável.
 *   <ChartFrame title="Kg por mês" description="Últimos 12 meses" legend={[...]} table={{columns, rows}}>
 *     <AreaChart ... />
 *   </ChartFrame>
 */
export function ChartFrame({ title, description, summary, legend, table, action, children, className }: ChartFrameProps) {
  const id = useId();
  const [showTable, setShowTable] = useState(false);
  return (
    <figure className={cn('min-w-0', className)} aria-labelledby={title ? `${id}-t` : undefined} aria-describedby={summary || description ? `${id}-d` : undefined}>
      {(title || action || table) && (
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            {title && <h3 id={`${id}-t`} className="text-[15px] font-semibold text-fg">{title}</h3>}
            {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {action}
            {table && (
              <button
                type="button"
                onClick={() => setShowTable((v) => !v)}
                aria-pressed={showTable}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs text-muted transition-colors hover:bg-white/[0.05] hover:text-fg"
              >
                <Table2 className="size-3.5" aria-hidden /> {showTable ? 'Ver gráfico' : 'Ver dados'}
              </button>
            )}
          </div>
        </div>
      )}
      {summary && <p id={`${id}-d`} className="sr-only">{summary}</p>}
      {legend && <ChartLegend items={legend} className="mb-3" />}
      {showTable && table ? (
        <div className="max-h-80 overflow-auto rounded-xl border border-line">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-surface-2">
              <tr>{table.columns.map((c, i) => <th key={c} scope="col" className={cn('px-3 py-2 text-left font-mono text-[11px] font-normal tracking-wider text-subtle uppercase', i > 0 && 'text-right')}>{c}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-line">
              {table.rows.map((r, ri) => (
                <tr key={ri}>{r.map((v, ci) => <td key={ci} className={cn('px-3 py-2 text-fg-soft', ci > 0 && 'text-right font-mono tabular')}>{v}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div>{children}</div>
      )}
    </figure>
  );
}
