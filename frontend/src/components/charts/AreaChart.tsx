import { useId, type ReactNode } from 'react';
import {
  Area, AreaChart as RAreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { ChartTooltip } from './ChartTooltip';
import { chartTheme, tickStyle, type SeriesSpec, type ValueFormatter } from './theme';

export interface AreaChartProps<T extends object> {
  data: T[];
  xKey: keyof T & string;
  series: SeriesSpec[];
  height?: number;
  yFormat?: ValueFormatter;
  /** Formato curto do eixo Y (padrão: yFormat). */
  yTickFormat?: ValueFormatter;
  xFormat?: (v: string | number) => string;
  /** Rótulo completo no tooltip (padrão: xFormat). */
  tooltipLabel?: (v: string | number) => ReactNode;
  stacked?: boolean;
  /** Linha vertical de referência (ex.: "hoje", ano-meta). */
  referenceX?: { value: string | number; label?: string };
  /** Esconde o eixo Y (gráficos pequenos). */
  hideYAxis?: boolean;
  /** Rótulo acessível (aria-label) do SVG. */
  ariaLabel?: string;
  className?: string;
}

/**
 * Área/linha temporal temada. Séries `lineOnly` viram linha de comparação (sem preenchimento).
 *   <AreaChart data={byMonth} xKey="month" xFormat={formatMonth} yFormat={formatKg}
 *     series={[{ key: 'kg', label: 'Registrado', color: seriesColor.primary }]} />
 */
export function AreaChart<T extends object>({
  data, xKey, series, height = 260, yFormat = (v) => String(v), yTickFormat, xFormat, tooltipLabel,
  stacked, referenceX, hideYAxis, ariaLabel, className,
}: AreaChartProps<T>) {
  const gid = useId().replace(/:/g, '');
  const names = Object.fromEntries(series.map((s) => [s.key, s.label]));
  return (
    <div className={className} style={{ height }} role="img" aria-label={ariaLabel}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 600, height }}>
        <RAreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: hideYAxis ? 8 : 0 }} accessibilityLayer>
          <defs>
            {series.map((s) => (
              <linearGradient key={s.key} id={`${gid}-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity={0.22} />
                <stop offset="100%" stopColor={s.color} stopOpacity={0.02} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid vertical={false} stroke={chartTheme.grid} />
          <XAxis
            dataKey={xKey as never}
            tick={tickStyle}
            tickLine={false}
            axisLine={{ stroke: chartTheme.axis }}
            tickFormatter={xFormat}
            minTickGap={16}
            tickMargin={8}
          />
          <YAxis
            hide={hideYAxis}
            tick={tickStyle}
            tickLine={false}
            axisLine={false}
            tickFormatter={yTickFormat ?? yFormat}
            width={56}
            tickMargin={4}
          />
          <Tooltip
            cursor={{ stroke: chartTheme.cursor, strokeWidth: 1 }}
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
          {referenceX && (
            <ReferenceLine
              x={referenceX.value}
              stroke={chartTheme.cursor}
              label={referenceX.label ? { value: referenceX.label, position: 'insideTopRight', fill: chartTheme.tick, fontSize: 11, fontFamily: chartTheme.tickFont } : undefined}
            />
          )}
          {series.map((s) => (
            <Area
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stackId={stacked ? 'a' : undefined}
              stroke={s.color}
              strokeWidth={2}
              strokeDasharray={s.dashed ? '5 4' : undefined}
              fill={s.lineOnly ? 'transparent' : `url(#${gid}-${s.key})`}
              dot={false}
              activeDot={{ r: 4, fill: s.color, stroke: chartTheme.surface, strokeWidth: 2 }}
              isAnimationActive
              animationDuration={700}
            />
          ))}
        </RAreaChart>
      </ResponsiveContainer>
    </div>
  );
}
