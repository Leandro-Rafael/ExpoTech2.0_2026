import type { ReactNode } from 'react';
import type { FormatadorValor } from './theme';

interface ItemCarga {
  name?: string | number;
  value?: unknown;
  color?: string;
  dataKey?: unknown;
  payload?: Record<string, unknown>;
  fill?: string;
  stroke?: string;
}

export interface PropsDicaGrafico {
  active?: boolean;
  payload?: readonly ItemCarga[];
  label?: string | number;
  /** Formata o rótulo (eixo X). */
  formatoRotulo?: (label: string | number) => ReactNode;
  formatoValor?: FormatadorValor;
  /** Rótulos legíveis por dataKey. */
  nomes?: Record<string, string>;
  /** Linha extra no rodapé (ex.: total). */
  rodape?: (payload: readonly ItemCarga[]) => ReactNode;
}

/** Tooltip padrão: superfície elevada, rótulo mono, valores mono tabulares, amostra de cor ao lado do texto. */
export function DicaGrafico({ active, payload, label, formatoRotulo, formatoValor = (v) => String(v), nomes, rodape }: PropsDicaGrafico) {
  if (!active || !payload?.length) return null;
  return (
    <div className="surface-raised pointer-events-none min-w-40 rounded-xl px-3 py-2.5 text-xs">
      {label != null && label !== '' && (
        <p className="mb-1.5 font-mono text-[11px] tracking-wider text-subtle uppercase">{formatoRotulo ? formatoRotulo(label) : label}</p>
      )}
      <ul className="space-y-1">
        {payload.map((p, i) => {
          const chave = String(p.dataKey ?? p.name ?? i);
          const cor = (p.payload?.color as string | undefined) ?? p.color ?? p.stroke ?? p.fill;
          return (
            <li key={chave + i} className="flex items-center justify-between gap-4">
              <span className="inline-flex items-center gap-1.5 text-muted">
                <span aria-hidden className="inline-block size-2 rounded-full" style={{ backgroundColor: cor }} />
                {nomes?.[chave] ?? p.name}
              </span>
              <span className="font-mono text-fg tabular">{typeof p.value === 'number' ? formatoValor(p.value) : String(p.value ?? '—')}</span>
            </li>
          );
        })}
      </ul>
      {rodape && <div className="mt-2 border-t border-line pt-2">{rodape(payload)}</div>}
    </div>
  );
}
