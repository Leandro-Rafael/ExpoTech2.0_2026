import type { ReactNode } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { cn } from '@/lib/cn';
import { ChartTooltip } from './ChartTooltip';
import { chartTheme, type ValueFormatter } from './theme';

interface DonutDatum { name: string; value: number; color: string }

export interface DonutProps {
  data: DonutDatum[];
  size?: number;
  /** Espessura do anel. */
  thickness?: number;
  valueFormat?: ValueFormatter;
  /** Conteúdo central (ex.: total). */
  center?: ReactNode;
  /** Lista lateral com nome, valor e % (recomendado: identidade nunca só pela cor). */
  showList?: boolean;
  ariaLabel?: string;
  className?: string;
}

/**
 * Rosca parte-do-todo (≤ 7 fatias), com 2px de respiro entre fatias e lista com valores ao lado.
 *   <Donut data={byCategory.map(c => ({ name: c.name, value: c.kg, color: c.color }))} valueFormat={formatKg} showList />
 */
export function Donut({ data, size = 200, thickness = 18, valueFormat = (v) => String(v), center, showList = true, ariaLabel, className }: DonutProps) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const sorted = [...data].sort((a, b) => b.value - a.value);
  return (
    <div className={cn('@container', className)}>
    <div className="flex flex-col items-center gap-6 @md:flex-row @md:items-center">
      <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={ariaLabel}>
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: size, height: size }}>
          <PieChart>
            <Pie
              data={sorted}
              dataKey="value"
              nameKey="name"
              innerRadius={size / 2 - thickness}
              outerRadius={size / 2}
              paddingAngle={sorted.length > 1 ? 1.5 : 0}
              stroke={chartTheme.surface}
              strokeWidth={2}
              cornerRadius={3}
              startAngle={90}
              endAngle={-270}
              animationDuration={700}
            >
              {sorted.map((d) => <Cell key={d.name} fill={d.color} />)}
            </Pie>
            <Tooltip
              content={(p) => (
                <ChartTooltip active={p.active} payload={p.payload as never} valueFormat={(v) => `${valueFormat(v)} · ${total ? Math.round((v / total) * 100) : 0}%`} />
              )}
            />
          </PieChart>
        </ResponsiveContainer>
        {center && <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">{center}</div>}
      </div>
      {showList && (
        <ul className="w-full min-w-0 flex-1 divide-y divide-line text-sm">
          {sorted.map((d) => (
            <li key={d.name} className="flex items-center justify-between gap-3 py-2">
              <span className="inline-flex min-w-0 items-center gap-2 text-fg-soft">
                <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: d.color }} />
                <span className="truncate">{d.name}</span>
              </span>
              <span className="flex shrink-0 items-baseline gap-3 font-mono tabular">
                <span className="text-fg">{valueFormat(d.value)}</span>
                <span className="w-10 text-right text-xs text-subtle">{total ? Math.round((d.value / total) * 100) : 0}%</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
    </div>
  );
}
