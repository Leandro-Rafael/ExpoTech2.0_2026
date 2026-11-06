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
import { EstadoErro, Esqueleto } from '@/components/ui';

// ------------------------------------------------------------------ Segmented

export interface OpcaoSegmento<V extends string> { value: V; label: ReactNode; contagem?: number | null; tom?: 'danger' | 'warning' }

export function Segmentado<V extends string>({ opcoes, value, onChange, label, size = 'sm', className }: {
  opcoes: OpcaoSegmento<V>[]; value: V; onChange: (v: V) => void; label: string; size?: 'sm' | 'md'; className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const aoTeclar = (e: KeyboardEvent) => {
    const i = opcoes.findIndex((o) => o.value === value);
    let n = -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') n = (i + 1) % opcoes.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') n = (i - 1 + opcoes.length) % opcoes.length;
    else if (e.key === 'Home') n = 0;
    else if (e.key === 'End') n = opcoes.length - 1;
    if (n < 0) return;
    e.preventDefault();
    onChange(opcoes[n].value);
    requestAnimationFrame(() => ref.current?.querySelectorAll<HTMLElement>('[role=radio]')[n]?.focus());
  };
  return (
    <div ref={ref} role="radiogroup" aria-label={label} onKeyDown={aoTeclar}
      className={cn('inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-[10px] border border-line bg-bg-deep/60 p-0.5 [scrollbar-width:none]', className)}>
      {opcoes.map((o) => {
        const ativo = o.value === value;
        return (
          <button key={o.value} type="button" role="radio" aria-checked={ativo} tabIndex={ativo ? 0 : -1} onClick={() => onChange(o.value)}
            className={cn(
              'inline-flex shrink-0 items-center gap-1.5 rounded-lg font-medium whitespace-nowrap transition-colors',
              size === 'sm' ? 'h-8 px-2.5 text-[13px]' : 'h-9 px-3 text-sm',
              ativo ? 'bg-surface-3 text-fg shadow-[inset_0_0_0_1px_rgb(236_239_234/0.12)]' : 'text-muted hover:text-fg-soft',
            )}>
            {o.label}
            {o.contagem != null && (
              <span className={cn('font-mono text-[11px] tabular',
                o.tom === 'danger' && o.contagem > 0 ? 'text-danger' : o.tom === 'warning' && o.contagem > 0 ? 'text-warning' : ativo ? 'text-fg-soft' : 'text-subtle')}>
                {o.contagem}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ------------------------------------------------------------------ SearchField

export function CampoBusca({ value, onChange, placeholder = 'Buscar', label, className }: {
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

export function Tecla({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd className={cn('inline-flex h-5 min-w-5 items-center justify-center rounded-[5px] border border-line-strong bg-surface-2 px-1 font-mono text-[10.5px] leading-none text-fg-soft shadow-[0_1px_0_rgb(0_0_0/0.5)]', className)}>
      {children}
    </kbd>
  );
}

const tomMedidor = { brand: 'bg-brand-300', warning: 'bg-warning', danger: 'bg-danger', neutral: 'bg-muted', info: 'bg-info' };
export type TomMedidor = keyof typeof tomMedidor;

/** Barra fina 0..1. `mark` desenha um tique (ex.: limite de auto-solicitação). */
export function Medidor({ value, tone = 'brand', marca, label, className, altura = 'h-1.5' }: {
  value: number; tone?: TomMedidor; marca?: number; label?: string; className?: string; altura?: string;
}) {
  const v = Math.max(0, Math.min(1, value || 0));
  return (
    <div role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v * 100)} aria-label={label}
      className={cn('relative w-full rounded-full bg-white/[0.07]', altura, className)}>
      <div className={cn('h-full rounded-full transition-[width] duration-700 ease-[var(--ease-out-expo)]', tomMedidor[tone])} style={{ width: `${v * 100}%` }} />
      {marca != null && <span aria-hidden className="absolute -top-0.5 -bottom-0.5 w-px bg-fg/60" style={{ left: `${marca * 100}%` }} />}
    </div>
  );
}

/** Par rótulo/valor compacto (detalhes). */
export function Detalhe({ label, children, mono, className }: { label: ReactNode; children: ReactNode; mono?: boolean; className?: string }) {
  return (
    <div className={cn('min-w-0', className)}>
      <dt className="text-[11px] font-medium tracking-[0.06em] text-subtle uppercase">{label}</dt>
      <dd className={cn('mt-1 truncate text-[13.5px] text-fg-soft', mono && 'font-mono tabular')}>{children}</dd>
    </div>
  );
}

// ------------------------------------------------------------------ AdminTable

export interface ColunaAdmin<T> {
  key: string;
  cabecalho: ReactNode;
  celula: (row: T) => ReactNode;
  /** Valor para ordenação (habilita o cabeçalho clicável). */
  ordenar?: (row: T) => string | number | null | undefined;
  alinhamento?: 'left' | 'right' | 'center';
  className?: string;
  /** Celular: title/subtitle/aside formam o topo do cartão; hidden some; padrão = linha rótulo/valor. */
  celular?: 'title' | 'subtitle' | 'aside' | 'hidden' | 'row';
}

export interface PropsTabelaAdmin<T> {
  colunas: ColunaAdmin<T>[];
  linhas: T[] | undefined;
  chaveLinha: (row: T) => Key;
  carregando?: boolean;
  erro?: unknown;
  aoTentarDeNovo?: () => void;
  vazio?: ReactNode;
  aoClicarLinha?: (row: T) => void;
  chaveSelecionada?: Key | null;
  classeLinha?: (row: T) => string | undefined;
  ordemPadrao?: { key: string; direcao: 'asc' | 'desc' };
  legenda: string;
  /** Rodapé (paginação etc.). */
  rodape?: ReactNode;
  className?: string;
  linhasCarregando?: number;
}

const classesAlinhamento = { left: 'text-left', right: 'text-right', center: 'text-center' };

export function TabelaAdmin<T>({
  colunas, linhas, chaveLinha, carregando, erro, aoTentarDeNovo, vazio, aoClicarLinha, chaveSelecionada, classeLinha, ordemPadrao, legenda, rodape, className, linhasCarregando = 6,
}: PropsTabelaAdmin<T>) {
  const [ordem, setOrdem] = useState(ordemPadrao ?? null);
  const ordenadas = useMemo(() => {
    if (!linhas || !ordem) return linhas;
    const coluna = colunas.find((c) => c.key === ordem.key);
    if (!coluna?.ordenar) return linhas;
    const obterValor = coluna.ordenar;
    const sentido = ordem.direcao === 'asc' ? 1 : -1;
    return [...linhas].sort((a, b) => {
      const x = obterValor(a); const y = obterValor(b);
      if (x == null && y == null) return 0;
      if (x == null) return 1;
      if (y == null) return -1;
      if (typeof x === 'number' && typeof y === 'number') return (x - y) * sentido;
      return String(x).localeCompare(String(y), 'pt-BR') * sentido;
    });
  }, [linhas, ordem, colunas]);

  const alternarOrdem = (key: string) => setOrdem((s) => (s?.key === key ? { key, direcao: s.direcao === 'asc' ? 'desc' : 'asc' } : { key, direcao: 'desc' }));

  const corpo = () => {
    if (erro && !linhas) return <EstadoErro erro={erro} aoTentarDeNovo={aoTentarDeNovo} compacto />;
    if (carregando && !linhas) {
      return (
        <div role="status" aria-label="Carregando" className="divide-y divide-line">
          {Array.from({ length: linhasCarregando }, (_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3.5">
              <Esqueleto className="size-8 rounded-full" />
              <Esqueleto className="h-3.5 w-1/3" />
              <Esqueleto className="ml-auto h-3.5 w-16" />
            </div>
          ))}
        </div>
      );
    }
    if (!ordenadas?.length) return vazio ?? null;
    return null;
  };
  const substituto = corpo();

  const colunaTitulo = colunas.find((c) => c.celular === 'title');
  const colunaSubtitulo = colunas.find((c) => c.celular === 'subtitle');
  const colunaLateral = colunas.find((c) => c.celular === 'aside');
  const demaisColunas = colunas.filter((c) => !c.celular || c.celular === 'row');
  const clicavel = !!aoClicarLinha;

  return (
    <div className={cn('surface overflow-hidden rounded-2xl', carregando && linhas && 'opacity-70 transition-opacity', className)}>
      {substituto ?? (
        <>
          {/* Desktop */}
          {/* relative: prende os sr-only (absolute) dentro da rolagem, senão alargam a página */}
          <div className="relative hidden overflow-x-auto md:block">
            <table className="w-full border-collapse text-[13.5px]">
              <caption className="sr-only">{legenda}</caption>
              <thead>
                <tr className="border-b border-line">
                  {colunas.map((c) => {
                    const ativa = ordem?.key === c.key;
                    return (
                      <th key={c.key} scope="col" aria-sort={ativa ? (ordem!.direcao === 'asc' ? 'ascending' : 'descending') : undefined}
                        className={cn('h-10 px-4 text-[11px] font-medium tracking-[0.06em] whitespace-nowrap text-subtle uppercase', classesAlinhamento[c.alinhamento ?? 'left'], c.className)}>
                        {c.ordenar ? (
                          <button type="button" onClick={() => alternarOrdem(c.key)}
                            className={cn('-mx-1 inline-flex items-center gap-1 rounded px-1 uppercase transition-colors hover:text-fg-soft', ativa && 'text-fg-soft', c.alinhamento === 'right' && 'flex-row-reverse')}>
                            {c.cabecalho}
                            {ativa ? (ordem!.direcao === 'asc' ? <ArrowUp className="size-3" aria-hidden /> : <ArrowDown className="size-3" aria-hidden />)
                              : <ChevronsUpDown className="size-3 opacity-50" aria-hidden />}
                          </button>
                        ) : c.cabecalho}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {ordenadas!.map((row) => {
                  const k = chaveLinha(row);
                  const selecionada = chaveSelecionada != null && k === chaveSelecionada;
                  return (
                    <tr key={k}
                      onClick={clicavel ? () => aoClicarLinha!(row) : undefined}
                      onKeyDown={clicavel ? (e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); aoClicarLinha!(row); } } : undefined}
                      tabIndex={clicavel ? 0 : undefined}
                      aria-selected={clicavel ? selecionada : undefined}
                      className={cn('border-b border-line/70 transition-colors last:border-0',
                        clicavel && 'cursor-pointer hover:bg-white/[0.025] focus-visible:bg-white/[0.04] focus-visible:outline-offset-[-2px]',
                        selecionada && 'bg-white/[0.045] hover:bg-white/[0.05]', classeLinha?.(row))}>
                      {colunas.map((c) => (
                        <td key={c.key} className={cn('px-4 py-3 align-middle text-fg-soft', classesAlinhamento[c.alinhamento ?? 'left'], c.className)}>{c.celula(row)}</td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Celular */}
          <ul className="divide-y divide-line md:hidden" aria-label={legenda}>
            {ordenadas!.map((row) => {
              const k = chaveLinha(row);
              const conteudo = (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      {colunaTitulo && <div className="font-medium text-fg">{colunaTitulo.celula(row)}</div>}
                      {colunaSubtitulo && <div className="mt-0.5 text-xs text-muted">{colunaSubtitulo.celula(row)}</div>}
                    </div>
                    {colunaLateral && <div className="shrink-0">{colunaLateral.celula(row)}</div>}
                  </div>
                  {demaisColunas.length > 0 && (
                    <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5 text-[13px]">
                      {demaisColunas.map((c) => (
                        <div key={c.key} className="min-w-0">
                          <dt className="text-[10.5px] tracking-[0.06em] text-subtle uppercase">{c.cabecalho}</dt>
                          <dd className="mt-0.5 min-w-0 text-fg-soft">{c.celula(row)}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </>
              );
              return (
                <li key={k} className={classeLinha?.(row)}>
                  {clicavel ? (
                    <div role="button" tabIndex={0} onClick={() => aoClicarLinha!(row)}
                      onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); aoClicarLinha!(row); } }}
                      className="block w-full cursor-pointer px-4 py-3.5 text-left active:bg-white/[0.04]">{conteudo}</div>
                  ) : <div className="px-4 py-3.5">{conteudo}</div>}
                </li>
              );
            })}
          </ul>
        </>
      )}
      {rodape && <div className="border-t border-line px-4 py-3">{rodape}</div>}
    </div>
  );
}

/** Debounce simples para buscas (evita uma requisição por tecla). */
export { useValorAtrasado as useDebounced } from './useDebounced';
