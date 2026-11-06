import type { ReactNode } from 'react';
import {
  Bar, BarChart as RBarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { DicaGrafico } from './ChartTooltip';
import { temaGrafico, estiloMarca, type SerieGrafico, type FormatadorValor } from './theme';

export interface PropsGraficoBarras<T extends object> {
  dados: T[];
  /** Chave da categoria (eixo X em colunas; eixo Y em barras horizontais). */
  chaveX: keyof T & string;
  series: SerieGrafico[];
  /** 'columns' (verticais, padrão) ou 'bars' (horizontais — melhor para nomes longos). */
  orientacao?: 'columns' | 'bars';
  /** Chave com a cor por linha (ex.: cor da categoria). Só para série única. */
  chaveCor?: keyof T & string;
  height?: number;
  formatoY?: FormatadorValor;
  formatoMarcaY?: FormatadorValor;
  formatoX?: (v: string | number) => string;
  rotuloDica?: (v: string | number) => ReactNode;
  empilhado?: boolean;
  /** Mostra o valor na ponta da barra (use com poucas barras). */
  mostrarValores?: boolean;
  /** Largura reservada para os rótulos (barras horizontais). */
  larguraCategoria?: number;
  ariaLabel?: string;
  className?: string;
}

/**
 * Colunas/barras temadas: espessura ≤ 24px, ponta arredondada de 4px e base reta, grade em hairline.
 *   <BarChart data={byCategory} xKey="name" colorKey="color" orientation="bars"
 *     series={[{ key: 'kg', label: 'Kg', color: seriesColor.primary }]} yFormat={formatKg} showValues />
 */
export function GraficoBarras<T extends object>({
  dados, chaveX, series, orientacao = 'columns', chaveCor, height = 260, formatoY = (v) => String(v), formatoMarcaY,
  formatoX, rotuloDica, empilhado, mostrarValores, larguraCategoria = 96, ariaLabel, className,
}: PropsGraficoBarras<T>) {
  const horizontal = orientacao === 'bars';
  const nomes = Object.fromEntries(series.map((s) => [s.chave, s.label]));
  const ultima = series.length - 1;
  const raio = (i: number): [number, number, number, number] => {
    if (empilhado && i !== ultima) return [0, 0, 0, 0];
    return horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0];
  };

  const eixoCategoria = {
    dataKey: chaveX as never,
    type: 'category' as const,
    tick: estiloMarca,
    tickLine: false,
    tickFormatter: formatoX,
    interval: 0 as const,
  };
  const eixoValor = {
    type: 'number' as const,
    tick: estiloMarca,
    tickLine: false,
    axisLine: false,
    tickFormatter: formatoMarcaY ?? formatoY,
  };

  return (
    <div className={className} style={{ height }} role="img" aria-label={ariaLabel}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 600, height }}>
        <RBarChart
          data={dados}
          layout={horizontal ? 'vertical' : 'horizontal'}
          margin={{ top: 8, right: mostrarValores ? 56 : 8, bottom: 0, left: 0 }}
          barCategoryGap={horizontal ? 6 : '28%'}
          accessibilityLayer
        >
          <CartesianGrid horizontal={!horizontal} vertical={horizontal} stroke={temaGrafico.grade} />
          {horizontal ? (
            <>
              <XAxis {...eixoValor} hide={mostrarValores} />
              <YAxis {...eixoCategoria} axisLine={false} width={larguraCategoria} tick={{ ...estiloMarca, fill: '#a3aca6', fontFamily: "'Geist Variable', ui-sans-serif, system-ui", fontSize: 12 }} />
            </>
          ) : (
            <>
              <XAxis {...eixoCategoria} axisLine={{ stroke: temaGrafico.eixo }} tickMargin={8} minTickGap={8} interval="preserveStartEnd" />
              <YAxis {...eixoValor} width={56} tickMargin={4} />
            </>
          )}
          <Tooltip
            cursor={{ fill: temaGrafico.fundoCursor }}
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
          {series.map((s, i) => (
            <Bar
              key={s.chave}
              dataKey={s.chave}
              name={s.label}
              fill={s.cor}
              stackId={empilhado ? 'a' : undefined}
              radius={raio(i)}
              maxBarSize={horizontal ? 18 : 24}
              stroke={empilhado ? temaGrafico.superficie : undefined}
              strokeWidth={empilhado ? 1 : 0}
              animationDuration={600}
            >
              {chaveCor && series.length === 1 && dados.map((linha, ri) => (
                <Cell key={ri} fill={String((linha as Record<string, unknown>)[chaveCor] ?? s.cor)} />
              ))}
              {mostrarValores && i === ultima && (
                <LabelList
                  dataKey={s.chave}
                  position={horizontal ? 'right' : 'top'}
                  formatter={(v: unknown) => (typeof v === 'number' ? formatoY(v) : '')}
                  style={{ fill: '#c8cec9', fontSize: 11, fontFamily: temaGrafico.fonteMarca, fontVariantNumeric: 'tabular-nums' }}
                />
              )}
            </Bar>
          ))}
        </RBarChart>
      </ResponsiveContainer>
    </div>
  );
}
