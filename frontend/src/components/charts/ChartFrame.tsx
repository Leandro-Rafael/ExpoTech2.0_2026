import { useId, useState, type ReactNode } from 'react';
import { Table2 } from 'lucide-react';
import { cn } from '@/lib/cn';

interface ItemLegenda { label: string; cor: string; tracejada?: boolean }

/** Legenda em HTML: amostra colorida + texto em tinta neutra (texto nunca usa a cor da série). */
function LegendaGrafico({ itens, className }: { itens: ItemLegenda[]; className?: string }) {
  if (itens.length < 2) return null;
  return (
    <ul className={cn('flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted', className)}>
      {itens.map((i) => (
        <li key={i.label} className="inline-flex items-center gap-1.5">
          {i.tracejada ? (
            <svg width="14" height="4" aria-hidden><line x1="0" y1="2" x2="14" y2="2" stroke={i.cor} strokeWidth="2" strokeDasharray="3 2" /></svg>
          ) : (
            <span aria-hidden className="inline-block h-[3px] w-3.5 rounded-full" style={{ backgroundColor: i.cor }} />
          )}
          {i.label}
        </li>
      ))}
    </ul>
  );
}

interface TabelaGrafico {
  colunas: string[];
  linhas: (string | number)[][];
}

export interface PropsMolduraGrafico {
  title?: ReactNode;
  /** Uma linha explicando o que o gráfico mostra (unidade, período). */
  description?: ReactNode;
  /** Resumo textual para leitores de tela (o que o gráfico conclui). */
  resumo?: string;
  legenda?: ItemLegenda[];
  /** Tabela equivalente (acessibilidade + "ver dados"). */
  tabela?: TabelaGrafico;
  acao?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * Moldura padrão de gráfico: título (h3 Geist), descrição, legenda, gráfico e tabela de dados alternável.
 *   <ChartFrame title="Kg por mês" description="Últimos 12 meses" legend={[...]} table={{columns, rows}}>
 *     <AreaChart ... />
 *   </ChartFrame>
 */
export function MolduraGrafico({ title, description, resumo, legenda, tabela, acao, children, className }: PropsMolduraGrafico) {
  const id = useId();
  const [mostrarTabela, setMostrarTabela] = useState(false);
  return (
    <figure className={cn('min-w-0', className)} aria-labelledby={title ? `${id}-t` : undefined} aria-describedby={resumo || description ? `${id}-d` : undefined}>
      {(title || acao || tabela) && (
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            {title && <h3 id={`${id}-t`} className="text-[15px] font-semibold text-fg">{title}</h3>}
            {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {acao}
            {tabela && (
              <button
                type="button"
                onClick={() => setMostrarTabela((v) => !v)}
                aria-pressed={mostrarTabela}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs text-muted transition-colors hover:bg-white/[0.05] hover:text-fg"
              >
                <Table2 className="size-3.5" aria-hidden /> {mostrarTabela ? 'Ver gráfico' : 'Ver dados'}
              </button>
            )}
          </div>
        </div>
      )}
      {resumo && <p id={`${id}-d`} className="sr-only">{resumo}</p>}
      {legenda && <LegendaGrafico itens={legenda} className="mb-3" />}
      {mostrarTabela && tabela ? (
        <div className="max-h-80 overflow-auto rounded-xl border border-line">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-surface-2">
              <tr>{tabela.colunas.map((c, i) => <th key={c} scope="col" className={cn('px-3 py-2 text-left font-mono text-[11px] font-normal tracking-wider text-subtle uppercase', i > 0 && 'text-right')}>{c}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-line">
              {tabela.linhas.map((r, ri) => (
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
