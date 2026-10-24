import type { ReactNode } from 'react';
import type { ValueFormatter } from './theme';

interface PayloadItem {
  name?: string | number;
  value?: unknown;
  color?: string;
  dataKey?: unknown;
  payload?: Record<string, unknown>;
  fill?: string;
  stroke?: string;
}

export interface ChartTooltipProps {
  active?: boolean;
  payload?: readonly PayloadItem[];
  label?: string | number;
  /** Formata o rótulo (eixo X). */
  labelFormat?: (label: string | number) => ReactNode;
  valueFormat?: ValueFormatter;
  /** Rótulos legíveis por dataKey. */
  names?: Record<string, string>;
  /** Linha extra no rodapé (ex.: total). */
  footer?: (payload: readonly PayloadItem[]) => ReactNode;
}

/** Tooltip padrão: superfície elevada, rótulo mono, valores mono tabulares, amostra de cor ao lado do texto. */
export function ChartTooltip({ active, payload, label, labelFormat, valueFormat = (v) => String(v), names, footer }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="surface-raised pointer-events-none min-w-40 rounded-xl px-3 py-2.5 text-xs">
      {label != null && label !== '' && (
        <p className="mb-1.5 font-mono text-[11px] tracking-wider text-subtle uppercase">{labelFormat ? labelFormat(label) : label}</p>
      )}
      <ul className="space-y-1">
        {payload.map((p, i) => {
          const key = String(p.dataKey ?? p.name ?? i);
          const color = (p.payload?.color as string | undefined) ?? p.color ?? p.stroke ?? p.fill;
          return (
            <li key={key + i} className="flex items-center justify-between gap-4">
              <span className="inline-flex items-center gap-1.5 text-muted">
                <span aria-hidden className="inline-block size-2 rounded-full" style={{ backgroundColor: color }} />
                {names?.[key] ?? p.name}
              </span>
              <span className="font-mono text-fg tabular">{typeof p.value === 'number' ? valueFormat(p.value) : String(p.value ?? '—')}</span>
            </li>
          );
        })}
      </ul>
      {footer && <div className="mt-2 border-t border-line pt-2">{footer(payload)}</div>}
    </div>
  );
}
