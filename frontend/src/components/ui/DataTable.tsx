import type { Key, ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Skeleton } from './Skeleton';

export interface Column<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  align?: 'left' | 'right' | 'center';
  /** Classe do <td>/<th> (ex.: larguras). */
  className?: string;
  /** No modo cartão (celular): 'title' vira o título do cartão; 'hidden' some; padrão = linha rótulo/valor. */
  mobile?: 'title' | 'subtitle' | 'aside' | 'hidden' | 'row';
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[] | undefined;
  rowKey: (row: T) => Key;
  loading?: boolean;
  /** Mostrado quando rows está vazio (use <EmptyState compact />). */
  empty?: ReactNode;
  onRowClick?: (row: T) => void;
  caption?: string;
  className?: string;
  /** Destaca linhas (ex.: suspeitas de fraude). */
  rowClassName?: (row: T) => string | undefined;
}

const alignCls = { left: 'text-left', right: 'text-right', center: 'text-center' };

/**
 * Tabela simples e responsiva: tabela em ≥ md, lista de cartões no celular.
 *
 *   <DataTable rows={data?.content} rowKey={(d) => d.id} loading={isPending}
 *     columns={[{ key: 'cat', header: 'Categoria', cell: (d) => d.category.name, mobile: 'title' }, ...]} />
 */
export function DataTable<T>({ columns, rows, rowKey, loading, empty, onRowClick, caption, className, rowClassName }: DataTableProps<T>) {
  if (loading && !rows) {
    return (
      <div className={cn('glass rounded-2xl p-4', className)} role="status" aria-label="Carregando">
        {Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="mb-2 h-12 last:mb-0" />)}
      </div>
    );
  }
  if (!rows?.length) return <div className={cn('glass rounded-2xl', className)}>{empty}</div>;

  const title = columns.find((c) => c.mobile === 'title');
  const subtitle = columns.find((c) => c.mobile === 'subtitle');
  const aside = columns.find((c) => c.mobile === 'aside');
  const rest = columns.filter((c) => !c.mobile || c.mobile === 'row');
  const clickable = !!onRowClick;

  return (
    <div className={cn('relative', loading && 'opacity-60 transition-opacity', className)}>
      {/* Desktop */}
      <div className="glass hidden overflow-hidden rounded-2xl md:block">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            {caption && <caption className="sr-only">{caption}</caption>}
            <thead>
              <tr className="border-b border-line bg-white/[0.02]">
                {columns.map((c) => (
                  <th key={c.key} scope="col" className={cn('px-4 py-3 text-xs font-medium tracking-wide text-muted uppercase', alignCls[c.align ?? 'left'], c.className)}>
                    {c.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={rowKey(row)}
                  onClick={clickable ? () => onRowClick!(row) : undefined}
                  onKeyDown={clickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onRowClick!(row); } } : undefined}
                  tabIndex={clickable ? 0 : undefined}
                  className={cn('border-b border-line/60 transition-colors last:border-0', clickable && 'cursor-pointer hover:bg-white/[0.03] focus-visible:bg-white/[0.04]', rowClassName?.(row))}
                >
                  {columns.map((c) => (
                    <td key={c.key} className={cn('px-4 py-3.5 align-middle text-fg-soft', alignCls[c.align ?? 'left'], c.className)}>{c.cell(row)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile: cartões */}
      <ul className="flex flex-col gap-2.5 md:hidden" aria-label={caption}>
        {rows.map((row) => {
          const content = (
            <>
              {(title || aside) && (
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    {title && <div className="font-medium text-fg">{title.cell(row)}</div>}
                    {subtitle && <div className="mt-0.5 text-xs text-muted">{subtitle.cell(row)}</div>}
                  </div>
                  {aside && <div className="shrink-0">{aside.cell(row)}</div>}
                </div>
              )}
              {rest.length > 0 && (
                <dl className={cn('grid grid-cols-2 gap-x-4 gap-y-2 text-sm', (title || aside) && 'mt-3 border-t border-line pt-3')}>
                  {rest.map((c) => (
                    <div key={c.key} className="min-w-0">
                      <dt className="text-[11px] tracking-wide text-subtle uppercase">{c.header}</dt>
                      <dd className="mt-0.5 truncate text-fg-soft">{c.cell(row)}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </>
          );
          return (
            <li key={rowKey(row)}>
              {clickable ? (
                <button type="button" onClick={() => onRowClick!(row)} className={cn('glass block w-full rounded-2xl p-4 text-left transition-colors active:bg-white/5', rowClassName?.(row))}>{content}</button>
              ) : (
                <div className={cn('glass rounded-2xl p-4', rowClassName?.(row))}>{content}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
