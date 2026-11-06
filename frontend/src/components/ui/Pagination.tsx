import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatarNumero } from '@/lib/format';

export interface PropsPaginacao {
  /** Página atual, base 0 (igual à API). */
  pagina: number;
  totalPaginas: number;
  onChange: (page: number) => void;
  totalItens?: number;
  size?: number;
  className?: string;
}

function intervaloPaginas(pagina: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i);
  const saida: (number | '…')[] = [0];
  const inicio = Math.max(1, pagina - 1);
  const fim = Math.min(total - 2, pagina + 1);
  if (inicio > 1) saida.push('…');
  for (let i = inicio; i <= fim; i++) saida.push(i);
  if (fim < total - 2) saida.push('…');
  saida.push(total - 1);
  return saida;
}

/** Paginação acessível para `Page<T>`. `<Pagination page={data.page} totalPages={data.totalPages} onChange={setPage} />` */
export function Paginacao({ pagina, totalPaginas, onChange, totalItens, size, className }: PropsPaginacao) {
  if (totalPaginas <= 1 && totalItens == null) return null;
  const classeBotao = 'inline-flex h-9 min-w-9 items-center justify-center rounded-lg px-2 text-sm transition-colors disabled:opacity-40 disabled:pointer-events-none';
  const primeiro = size != null && totalItens != null ? pagina * size + 1 : null;
  const ultimo = size != null && totalItens != null ? Math.min(totalItens, (pagina + 1) * size) : null;
  return (
    <nav aria-label="Paginação" className={cn('flex flex-col items-center justify-between gap-3 sm:flex-row', className)}>
      <p className="text-xs text-muted tabular">
        {primeiro != null && totalItens != null && totalItens > 0
          ? <>Mostrando {formatarNumero(primeiro)}–{formatarNumero(ultimo)} de {formatarNumero(totalItens)}</>
          : totalPaginas > 0 ? <>Página {pagina + 1} de {totalPaginas}</> : null}
      </p>
      {totalPaginas > 1 && (
        <div className="flex items-center gap-1">
          <button type="button" className={cn(classeBotao, 'text-muted hover:bg-white/5 hover:text-fg')} onClick={() => onChange(pagina - 1)} disabled={pagina <= 0} aria-label="Página anterior">
            <ChevronLeft className="size-4" aria-hidden />
          </button>
          <span className="hidden items-center gap-1 sm:flex">
            {intervaloPaginas(pagina, totalPaginas).map((p, i) => p === '…' ? (
              <span key={`e${i}`} className="px-1 text-subtle">…</span>
            ) : (
              <button key={p} type="button" onClick={() => onChange(p)} aria-current={p === pagina ? 'page' : undefined}
                className={cn(classeBotao, 'tabular', p === pagina ? 'border border-line-strong bg-surface-3 font-semibold text-fg' : 'text-muted hover:bg-white/5 hover:text-fg')}>
                {p + 1}
              </button>
            ))}
          </span>
          <span className="px-2 text-sm text-fg-soft tabular sm:hidden">{pagina + 1} / {totalPaginas}</span>
          <button type="button" className={cn(classeBotao, 'text-muted hover:bg-white/5 hover:text-fg')} onClick={() => onChange(pagina + 1)} disabled={pagina >= totalPaginas - 1} aria-label="Próxima página">
            <ChevronRight className="size-4" aria-hidden />
          </button>
        </div>
      )}
    </nav>
  );
}
