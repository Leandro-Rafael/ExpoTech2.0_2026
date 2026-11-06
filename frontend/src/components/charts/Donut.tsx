import type { ReactNode } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { cn } from '@/lib/cn';
import { DicaGrafico } from './ChartTooltip';
import { temaGrafico, type FormatadorValor } from './theme';

interface DadoRosca { name: string; value: number; color: string }

export interface PropsRosca {
  dados: DadoRosca[];
  size?: number;
  /** Espessura do anel. */
  espessura?: number;
  formatoValor?: FormatadorValor;
  /** Conteúdo central (ex.: total). */
  centro?: ReactNode;
  /** Lista lateral com nome, valor e % (recomendado: identidade nunca só pela cor). */
  mostrarLista?: boolean;
  ariaLabel?: string;
  className?: string;
}

/**
 * Rosca parte-do-todo (≤ 7 fatias), com 2px de respiro entre fatias e lista com valores ao lado.
 *   <Donut data={byCategory.map(c => ({ name: c.name, value: c.kg, color: c.color }))} valueFormat={formatKg} showList />
 */
export function Rosca({ dados, size = 200, espessura = 18, formatoValor = (v) => String(v), centro, mostrarLista = true, ariaLabel, className }: PropsRosca) {
  const total = dados.reduce((s, d) => s + d.value, 0);
  const ordenados = [...dados].sort((a, b) => b.value - a.value);
  return (
    <div className={cn('@container', className)}>
    <div className="flex flex-col items-center gap-6 @md:flex-row @md:items-center">
      <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={ariaLabel}>
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: size, height: size }}>
          <PieChart>
            <Pie
              data={ordenados}
              dataKey="value"
              nameKey="name"
              innerRadius={size / 2 - espessura}
              outerRadius={size / 2}
              paddingAngle={ordenados.length > 1 ? 1.5 : 0}
              stroke={temaGrafico.superficie}
              strokeWidth={2}
              cornerRadius={3}
              startAngle={90}
              endAngle={-270}
              animationDuration={700}
            >
              {ordenados.map((d) => <Cell key={d.name} fill={d.color} />)}
            </Pie>
            <Tooltip
              content={(p) => (
                <DicaGrafico active={p.active} payload={p.payload as never} formatoValor={(v) => `${formatoValor(v)} · ${total ? Math.round((v / total) * 100) : 0}%`} />
              )}
            />
          </PieChart>
        </ResponsiveContainer>
        {centro && <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">{centro}</div>}
      </div>
      {mostrarLista && (
        <ul className="w-full min-w-0 flex-1 divide-y divide-line text-sm">
          {ordenados.map((d) => (
            <li key={d.name} className="flex items-center justify-between gap-3 py-2">
              <span className="inline-flex min-w-0 items-center gap-2 text-fg-soft">
                <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: d.color }} />
                <span className="truncate">{d.name}</span>
              </span>
              <span className="flex shrink-0 items-baseline gap-3 font-mono tabular">
                <span className="text-fg">{formatoValor(d.value)}</span>
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
