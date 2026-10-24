import type { ReactNode } from 'react';
import {
  Bar, BarChart as RBarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { ChartTooltip } from './ChartTooltip';
import { chartTheme, tickStyle, type SeriesSpec, type ValueFormatter } from './theme';

export interface BarChartProps<T extends object> {
  data: T[];
  /** Chave da categoria (eixo X em colunas; eixo Y em barras horizontais). */
  xKey: keyof T & string;
  series: SeriesSpec[];
  /** 'columns' (verticais, padrão) ou 'bars' (horizontais — melhor para nomes longos). */
  orientation?: 'columns' | 'bars';
  /** Chave com a cor por linha (ex.: cor da categoria). Só para série única. */
  colorKey?: keyof T & string;
  height?: number;
  yFormat?: ValueFormatter;
  yTickFormat?: ValueFormatter;
  xFormat?: (v: string | number) => string;
  tooltipLabel?: (v: string | number) => ReactNode;
  stacked?: boolean;
  /** Mostra o valor na ponta da barra (use com poucas barras). */
  showValues?: boolean;
  /** Largura reservada para os rótulos (barras horizontais). */
  categoryWidth?: number;
  ariaLabel?: string;
  className?: string;
}

/**
 * Colunas/barras temadas: espessura ≤ 24px, ponta arredondada de 4px e base reta, grade em hairline.
 *   <BarChart data={byCategory} xKey="name" colorKey="color" orientation="bars"
 *     series={[{ key: 'kg', label: 'Kg', color: seriesColor.primary }]} yFormat={formatKg} showValues />
 */
export function BarChart<T extends object>({
  data, xKey, series, orientation = 'columns', colorKey, height = 260, yFormat = (v) => String(v), yTickFormat,
  xFormat, tooltipLabel, stacked, showValues, categoryWidth = 96, ariaLabel, className,
}: BarChartProps<T>) {
  const horizontal = orientation === 'bars';
  const names = Object.fromEntries(series.map((s) => [s.key, s.label]));
  const last = series.length - 1;
  const radius = (i: number): [number, number, number, number] => {
    if (stacked && i !== last) return [0, 0, 0, 0];
    return horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0];
  };

  const categoryAxis = {
    dataKey: xKey as never,
    type: 'category' as const,
    tick: tickStyle,
    tickLine: false,
    tickFormatter: xFormat,
    interval: 0 as const,
  };
  const valueAxis = {
    type: 'number' as const,
    tick: tickStyle,
    tickLine: false,
    axisLine: false,
    tickFormatter: yTickFormat ?? yFormat,
  };

  return (
    <div className={className} style={{ height }} role="img" aria-label={ariaLabel}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 600, height }}>
        <RBarChart
          data={data}
          layout={horizontal ? 'vertical' : 'horizontal'}
          margin={{ top: 8, right: showValues ? 56 : 8, bottom: 0, left: 0 }}
          barCategoryGap={horizontal ? 6 : '28%'}
          accessibilityLayer
        >
          <CartesianGrid horizontal={!horizontal} vertical={horizontal} stroke={chartTheme.grid} />
          {horizontal ? (
            <>
              <XAxis {...valueAxis} hide={showValues} />
              <YAxis {...categoryAxis} axisLine={false} width={categoryWidth} tick={{ ...tickStyle, fill: '#a3aca6', fontFamily: "'Geist Variable', ui-sans-serif, system-ui", fontSize: 12 }} />
            </>
          ) : (
            <>
              <XAxis {...categoryAxis} axisLine={{ stroke: chartTheme.axis }} tickMargin={8} minTickGap={8} interval="preserveStartEnd" />
              <YAxis {...valueAxis} width={56} tickMargin={4} />
            </>
          )}
          <Tooltip
            cursor={{ fill: chartTheme.cursorFill }}
            content={(p) => (
              <ChartTooltip
                active={p.active}
                payload={p.payload as never}
                label={p.label as string}
                labelFormat={tooltipLabel ?? (xFormat as never)}
                valueFormat={yFormat}
                names={names}
              />
            )}
          />
          {series.map((s, i) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.label}
              fill={s.color}
              stackId={stacked ? 'a' : undefined}
              radius={radius(i)}
              maxBarSize={horizontal ? 18 : 24}
              stroke={stacked ? chartTheme.surface : undefined}
              strokeWidth={stacked ? 1 : 0}
              animationDuration={600}
            >
              {colorKey && series.length === 1 && data.map((row, ri) => (
                <Cell key={ri} fill={String((row as Record<string, unknown>)[colorKey] ?? s.color)} />
              ))}
              {showValues && i === last && (
                <LabelList
                  dataKey={s.key}
                  position={horizontal ? 'right' : 'top'}
                  formatter={(v: unknown) => (typeof v === 'number' ? yFormat(v) : '')}
                  style={{ fill: '#c8cec9', fontSize: 11, fontFamily: chartTheme.tickFont, fontVariantNumeric: 'tabular-nums' }}
                />
              )}
            </Bar>
          ))}
        </RBarChart>
      </ResponsiveContainer>
    </div>
  );
}
