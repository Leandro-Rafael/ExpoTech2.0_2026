import { useId, type ReactNode } from 'react';
import {
  Area, AreaChart as RAreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { DicaGrafico } from './ChartTooltip';
import { temaGrafico, estiloMarca, type SerieGrafico, type FormatadorValor } from './theme';

export interface PropsGraficoArea<T extends object> {
  dados: T[];
  chaveX: keyof T & string;
  series: SerieGrafico[];
  height?: number;
  formatoY?: FormatadorValor;
  /** Formato curto do eixo Y (padrão: yFormat). */
  formatoMarcaY?: FormatadorValor;
  formatoX?: (v: string | number) => string;
  /** Rótulo completo no tooltip (padrão: xFormat). */
  rotuloDica?: (v: string | number) => ReactNode;
  empilhado?: boolean;
  /** Linha vertical de referência (ex.: "hoje", ano-meta). */
  referenciaX?: { value: string | number; label?: string };
  /** Esconde o eixo Y (gráficos pequenos). */
  esconderEixoY?: boolean;
  /** Rótulo acessível (aria-label) do SVG. */
  ariaLabel?: string;
  className?: string;
}

/**
 * Área/linha temporal temada. Séries `lineOnly` viram linha de comparação (sem preenchimento).
 *   <AreaChart data={byMonth} xKey="month" xFormat={formatMonth} yFormat={formatKg}
 *     series={[{ key: 'kg', label: 'Registrado', color: seriesColor.primary }]} />
 */
export function GraficoArea<T extends object>({
  dados, chaveX, series, height = 260, formatoY = (v) => String(v), formatoMarcaY, formatoX, rotuloDica,
  empilhado, referenciaX, esconderEixoY, ariaLabel, className,
}: PropsGraficoArea<T>) {
  const gid = useId().replace(/:/g, '');
  const nomes = Object.fromEntries(series.map((s) => [s.chave, s.label]));
  return (
    <div className={className} style={{ height }} role="img" aria-label={ariaLabel}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 600, height }}>
        <RAreaChart data={dados} margin={{ top: 8, right: 8, bottom: 0, left: esconderEixoY ? 8 : 0 }} accessibilityLayer>
          <defs>
            {series.map((s) => (
              <linearGradient key={s.chave} id={`${gid}-${s.chave}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.cor} stopOpacity={0.22} />
                <stop offset="100%" stopColor={s.cor} stopOpacity={0.02} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid vertical={false} stroke={temaGrafico.grade} />
          <XAxis
            dataKey={chaveX as never}
            tick={estiloMarca}
            tickLine={false}
            axisLine={{ stroke: temaGrafico.eixo }}
            tickFormatter={formatoX}
            minTickGap={16}
            tickMargin={8}
          />
          <YAxis
            hide={esconderEixoY}
            tick={estiloMarca}
            tickLine={false}
            axisLine={false}
            tickFormatter={formatoMarcaY ?? formatoY}
            width={56}
            tickMargin={4}
          />
          <Tooltip
            cursor={{ stroke: temaGrafico.cursor, strokeWidth: 1 }}
            content={(p) => (
              <DicaGrafico
                active={p.active}
                payload={p.payload as never}
                label={p.label as string}
                formatoRotulo={rotuloDica ?? (formatoX as never)}
                formatoValor={formatoY}
                nomes={nomes}
              />
            )}
          />
          {referenciaX && (
            <ReferenceLine
              x={referenciaX.value}
              stroke={temaGrafico.cursor}
              label={referenciaX.label ? { value: referenciaX.label, position: 'insideTopRight', fill: temaGrafico.marca, fontSize: 11, fontFamily: temaGrafico.fonteMarca } : undefined}
            />
          )}
          {series.map((s) => (
            <Area
              key={s.chave}
              type="monotone"
              dataKey={s.chave}
              name={s.label}
              stackId={empilhado ? 'a' : undefined}
              stroke={s.cor}
              strokeWidth={2}
              strokeDasharray={s.tracejada ? '5 4' : undefined}
              fill={s.soLinha ? 'transparent' : `url(#${gid}-${s.chave})`}
              dot={false}
              activeDot={{ r: 4, fill: s.cor, stroke: temaGrafico.superficie, strokeWidth: 2 }}
              isAnimationActive
              animationDuration={700}
            />
          ))}
        </RAreaChart>
      </ResponsiveContainer>
    </div>
  );
}
