/**
 * Peças compartilhadas das telas de administração/coletor (sem dependências pesadas).
 *   Segmented     filtro segmentado (radiogroup, setas ←/→)
 *   SearchField   busca com ícone e limpar
 *   AdminTable    tabela densa com ordenação, seleção, estados e cartões no celular
 *   Kbd           tecla de atalho
 *   Meter         barra fina 0..1 com tom
 */
import { useMemo, useRef, useState, type KeyboardEvent, type Key, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, ChevronsUpDown, Search, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { ErrorState, Skeleton } from '@/components/ui';

// ------------------------------------------------------------------ Segmented

export interface SegmentOption<V extends string> { value: V; label: ReactNode; count?: number | null; tone?: 'danger' | 'warning' }

export function Segmented<V extends string>({ options, value, onChange, label, size = 'sm', className }: {
  options: SegmentOption<V>[]; value: V; onChange: (v: V) => void; label: string; size?: 'sm' | 'md'; className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const onKeyDown = (e: KeyboardEvent) => {
    const i = options.findIndex((o) => o.value === value);
    let n = -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') n = (i + 1) % options.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') n = (i - 1 + options.length) % options.length;
    else if (e.key === 'Home') n = 0;
    else if (e.key === 'End') n = options.length - 1;
    if (n < 0) return;
    e.preventDefault();
    onChange(options[n].value);
    requestAnimationFrame(() => ref.current?.querySelectorAll<HTMLElement>('[role=radio]')[n]?.focus());
  };
  return (
    <div ref={ref} role="radiogroup" aria-label={label} onKeyDown={onKeyDown}
      className={cn('inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-[10px] border border-line bg-bg-deep/60 p-0.5 [scrollbar-width:none]', className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button key={o.value} type="button" role="radio" aria-checked={active} tabIndex={active ? 0 : -1} onClick={() => onChange(o.value)}
            className={cn(
              'inline-flex shrink-0 items-center gap-1.5 rounded-lg font-medium whitespace-nowrap transition-colors',
              size === 'sm' ? 'h-8 px-2.5 text-[13px]' : 'h-9 px-3 text-sm',
              active ? 'bg-surface-3 text-fg shadow-[inset_0_0_0_1px_rgb(236_239_234/0.12)]' : 'text-muted hover:text-fg-soft',
            )}>
            {o.label}
            {o.count != null && (
              <span className={cn('font-mono text-[11px] tabular',
                o.tone === 'danger' && o.count > 0 ? 'text-danger' : o.tone === 'warning' && o.count > 0 ? 'text-warning' : active ? 'text-fg-soft' : 'text-subtle')}>
                {o.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ------------------------------------------------------------------ SearchField

export function SearchField({ value, onChange, placeholder = 'Buscar', label, className }: {
  value: string; onChange: (v: string) => void; placeholder?: string; label?: string; className?: string;
}) {
  return (
    <div className={cn('relative flex items-center', className)}>
      <Search aria-hidden className="pointer-events-none absolute left-3 size-4 text-subtle" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label ?? placeholder}
        maxLength={100}
        className="h-9 w-full rounded-[10px] border border-line bg-bg-deep/60 pr-8 pl-9 text-[13px] text-fg placeholder:text-subtle transition-[border-color,box-shadow] hover:border-line-strong focus:border-[rgb(236_239_234/0.3)] focus:shadow-[0_0_0_3px_rgb(197_242_107/0.12)] focus:outline-none [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button type="button" onClick={() => onChange('')} aria-label="Limpar busca"
          className="absolute right-1.5 inline-flex size-6 items-center justify-center rounded-md text-subtle hover:bg-white/5 hover:text-fg">
          <X className="size-3.5" aria-hidden />
        </button>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ Kbd / Meter / misc

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd className={cn('inline-flex h-5 min-w-5 items-center justify-center rounded-[5px] border border-line-strong bg-surface-2 px-1 font-mono text-[10.5px] leading-none text-fg-soft shadow-[0_1px_0_rgb(0_0_0/0.5)]', className)}>
      {children}
    </kbd>
  );
}

const meterTone = { brand: 'bg-brand-300', warning: 'bg-warning', danger: 'bg-danger', neutral: 'bg-muted', info: 'bg-info' };
export type MeterTone = keyof typeof meterTone;

/** Barra fina 0..1. `mark` desenha um tique (ex.: limite de auto-solicitação). */
export function Meter({ value, tone = 'brand', mark, label, className, height = 'h-1.5' }: {
  value: number; tone?: MeterTone; mark?: number; label?: string; className?: string; height?: string;
}) {
  const v = Math.max(0, Math.min(1, value || 0));
  return (
    <div role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v * 100)} aria-label={label}
      className={cn('relative w-full rounded-full bg-white/[0.07]', height, className)}>
      <div className={cn('h-full rounded-full transition-[width] duration-700 ease-[var(--ease-out-expo)]', meterTone[tone])} style={{ width: `${v * 100}%` }} />
      {mark != null && <span aria-hidden className="absolute -top-0.5 -bottom-0.5 w-px bg-fg/60" style={{ left: `${mark * 100}%` }} />}
    </div>
  );
}

/** Título de bloco dentro de página (h2 da página fica com Fraunces via CSS; aqui usamos h3). */
export function BlockTitle({ title, meta, action, className }: { title: ReactNode; meta?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('mb-3 flex items-end justify-between gap-4', className)}>
      <div className="min-w-0">
        <h3 className="text-[15px] font-semibold text-fg">{title}</h3>
        {meta && <p className="mt-0.5 text-[13px] text-muted">{meta}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/** Par rótulo/valor compacto (detalhes). */
export function Detail({ label, children, mono, className }: { label: ReactNode; children: ReactNode; mono?: boolean; className?: string }) {
  return (
    <div className={cn('min-w-0', className)}>
      <dt className="text-[11px] font-medium tracking-[0.06em] text-subtle uppercase">{label}</dt>
      <dd className={cn('mt-1 truncate text-[13.5px] text-fg-soft', mono && 'font-mono tabular')}>{children}</dd>
    </div>
  );
}

// ------------------------------------------------------------------ AdminTable

export interface AdminColumn<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  /** Valor para ordenação (habilita o cabeçalho clicável). */
  sort?: (row: T) => string | number | null | undefined;
  align?: 'left' | 'right' | 'center';
  className?: string;
  /** Celular: title/subtitle/aside formam o topo do cartão; hidden some; padrão = linha rótulo/valor. */
  mobile?: 'title' | 'subtitle' | 'aside' | 'hidden' | 'row';
}

export interface AdminTableProps<T> {
  columns: AdminColumn<T>[];
  rows: T[] | undefined;
  rowKey: (row: T) => Key;
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  empty?: ReactNode;
  onRowClick?: (row: T) => void;
  selectedKey?: Key | null;
  rowClassName?: (row: T) => string | undefined;
  defaultSort?: { key: string; dir: 'asc' | 'desc' };
  caption: string;
  /** Rodapé (paginação etc.). */
  footer?: ReactNode;
  className?: string;
  skeletonRows?: number;
}

const alignCls = { left: 'text-left', right: 'text-right', center: 'text-center' };

export function AdminTable<T>({
  columns, rows, rowKey, loading, error, onRetry, empty, onRowClick, selectedKey, rowClassName, defaultSort, caption, footer, className, skeletonRows = 6,
}: AdminTableProps<T>) {
  const [sort, setSort] = useState(defaultSort ?? null);
  const sorted = useMemo(() => {
    if (!rows || !sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sort) return rows;
    const get = col.sort;
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const x = get(a); const y = get(b);
      if (x == null && y == null) return 0;
      if (x == null) return 1;
      if (y == null) return -1;
      if (typeof x === 'number' && typeof y === 'number') return (x - y) * dir;
      return String(x).localeCompare(String(y), 'pt-BR') * dir;
    });
  }, [rows, sort, columns]);

  const toggle = (key: string) => setSort((s) => (s?.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' }));

  const body = () => {
    if (error && !rows) return <ErrorState error={error} onRetry={onRetry} compact />;
    if (loading && !rows) {
      return (
        <div role="status" aria-label="Carregando" className="divide-y divide-line">
          {Array.from({ length: skeletonRows }, (_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3.5">
              <Skeleton className="size-8 rounded-full" />
              <Skeleton className="h-3.5 w-1/3" />
              <Skeleton className="ml-auto h-3.5 w-16" />
            </div>
          ))}
        </div>
      );
    }
    if (!sorted?.length) return empty ?? null;
    return null;
  };
  const placeholder = body();

  const title = columns.find((c) => c.mobile === 'title');
  const subtitle = columns.find((c) => c.mobile === 'subtitle');
  const aside = columns.find((c) => c.mobile === 'aside');
  const restCols = columns.filter((c) => !c.mobile || c.mobile === 'row');
  const clickable = !!onRowClick;

  return (
    <div className={cn('surface overflow-hidden rounded-2xl', loading && rows && 'opacity-70 transition-opacity', className)}>
      {placeholder ?? (
        <>
          {/* Desktop */}
          {/* relative: prende os sr-only (absolute) dentro da rolagem, senão alargam a página */}
          <div className="relative hidden overflow-x-auto md:block">
            <table className="w-full border-collapse text-[13.5px]">
              <caption className="sr-only">{caption}</caption>
              <thead>
                <tr className="border-b border-line">
                  {columns.map((c) => {
                    const active = sort?.key === c.key;
                    return (
                      <th key={c.key} scope="col" aria-sort={active ? (sort!.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                        className={cn('h-10 px-4 text-[11px] font-medium tracking-[0.06em] whitespace-nowrap text-subtle uppercase', alignCls[c.align ?? 'left'], c.className)}>
                        {c.sort ? (
                          <button type="button" onClick={() => toggle(c.key)}
                            className={cn('-mx-1 inline-flex items-center gap-1 rounded px-1 uppercase transition-colors hover:text-fg-soft', active && 'text-fg-soft', c.align === 'right' && 'flex-row-reverse')}>
                            {c.header}
                            {active ? (sort!.dir === 'asc' ? <ArrowUp className="size-3" aria-hidden /> : <ArrowDown className="size-3" aria-hidden />)
                              : <ChevronsUpDown className="size-3 opacity-50" aria-hidden />}
                          </button>
                        ) : c.header}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {sorted!.map((row) => {
                  const k = rowKey(row);
                  const selected = selectedKey != null && k === selectedKey;
                  return (
                    <tr key={k}
                      onClick={clickable ? () => onRowClick!(row) : undefined}
                      onKeyDown={clickable ? (e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onRowClick!(row); } } : undefined}
                      tabIndex={clickable ? 0 : undefined}
                      aria-selected={clickable ? selected : undefined}
                      className={cn('border-b border-line/70 transition-colors last:border-0',
                        clickable && 'cursor-pointer hover:bg-white/[0.025] focus-visible:bg-white/[0.04] focus-visible:outline-offset-[-2px]',
                        selected && 'bg-white/[0.045] hover:bg-white/[0.05]', rowClassName?.(row))}>
                      {columns.map((c) => (
                        <td key={c.key} className={cn('px-4 py-3 align-middle text-fg-soft', alignCls[c.align ?? 'left'], c.className)}>{c.cell(row)}</td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Celular */}
          <ul className="divide-y divide-line md:hidden" aria-label={caption}>
            {sorted!.map((row) => {
              const k = rowKey(row);
              const content = (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      {title && <div className="font-medium text-fg">{title.cell(row)}</div>}
                      {subtitle && <div className="mt-0.5 text-xs text-muted">{subtitle.cell(row)}</div>}
                    </div>
                    {aside && <div className="shrink-0">{aside.cell(row)}</div>}
                  </div>
                  {restCols.length > 0 && (
                    <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5 text-[13px]">
                      {restCols.map((c) => (
                        <div key={c.key} className="min-w-0">
                          <dt className="text-[10.5px] tracking-[0.06em] text-subtle uppercase">{c.header}</dt>
                          <dd className="mt-0.5 min-w-0 text-fg-soft">{c.cell(row)}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </>
              );
              return (
                <li key={k} className={rowClassName?.(row)}>
                  {clickable ? (
                    <div role="button" tabIndex={0} onClick={() => onRowClick!(row)}
                      onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onRowClick!(row); } }}
                      className="block w-full cursor-pointer px-4 py-3.5 text-left active:bg-white/[0.04]">{content}</div>
                  ) : <div className="px-4 py-3.5">{content}</div>}
                </li>
              );
            })}
          </ul>
        </>
      )}
      {footer && <div className="border-t border-line px-4 py-3">{footer}</div>}
    </div>
  );
}

/** Debounce simples para buscas (evita uma requisição por tecla). */
export { useDebounced } from './useDebounced';
