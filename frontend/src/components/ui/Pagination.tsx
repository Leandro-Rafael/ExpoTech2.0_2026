import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatNumber } from '@/lib/format';

export interface PaginationProps {
  /** Página atual, base 0 (igual à API). */
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
  totalElements?: number;
  size?: number;
  className?: string;
}

function range(page: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i);
  const out: (number | '…')[] = [0];
  const start = Math.max(1, page - 1);
  const end = Math.min(total - 2, page + 1);
  if (start > 1) out.push('…');
  for (let i = start; i <= end; i++) out.push(i);
  if (end < total - 2) out.push('…');
  out.push(total - 1);
  return out;
}

/** Paginação acessível para `Page<T>`. `<Pagination page={data.page} totalPages={data.totalPages} onChange={setPage} />` */
export function Pagination({ page, totalPages, onChange, totalElements, size, className }: PaginationProps) {
  if (totalPages <= 1 && totalElements == null) return null;
  const btn = 'inline-flex h-9 min-w-9 items-center justify-center rounded-lg px-2 text-sm transition-colors disabled:opacity-40 disabled:pointer-events-none';
  const from = size != null && totalElements != null ? page * size + 1 : null;
  const to = size != null && totalElements != null ? Math.min(totalElements, (page + 1) * size) : null;
  return (
    <nav aria-label="Paginação" className={cn('flex flex-col items-center justify-between gap-3 sm:flex-row', className)}>
      <p className="text-xs text-muted tabular">
        {from != null && totalElements != null && totalElements > 0
          ? <>Mostrando {formatNumber(from)}–{formatNumber(to)} de {formatNumber(totalElements)}</>
          : totalPages > 0 ? <>Página {page + 1} de {totalPages}</> : null}
      </p>
      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <button type="button" className={cn(btn, 'text-muted hover:bg-white/5 hover:text-fg')} onClick={() => onChange(page - 1)} disabled={page <= 0} aria-label="Página anterior">
            <ChevronLeft className="size-4" aria-hidden />
          </button>
          <span className="hidden items-center gap-1 sm:flex">
            {range(page, totalPages).map((p, i) => p === '…' ? (
              <span key={`e${i}`} className="px-1 text-subtle">…</span>
            ) : (
              <button key={p} type="button" onClick={() => onChange(p)} aria-current={p === page ? 'page' : undefined}
                className={cn(btn, 'tabular', p === page ? 'border border-line-strong bg-surface-3 font-semibold text-fg' : 'text-muted hover:bg-white/5 hover:text-fg')}>
                {p + 1}
              </button>
            ))}
          </span>
          <span className="px-2 text-sm text-fg-soft tabular sm:hidden">{page + 1} / {totalPages}</span>
          <button type="button" className={cn(btn, 'text-muted hover:bg-white/5 hover:text-fg')} onClick={() => onChange(page + 1)} disabled={page >= totalPages - 1} aria-label="Próxima página">
            <ChevronRight className="size-4" aria-hidden />
          </button>
        </div>
      )}
    </nav>
  );
}
