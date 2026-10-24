/**
 * Tema dos gráficos (espelha os tokens de styles/index.css).
 * Regras: grade/eixos em hairline recessiva, números em Geist Mono tabular,
 * esmeralda para a série principal, neutro para comparação/base, lima só para UM destaque.
 */
export const chartTheme = {
  grid: 'rgba(236, 239, 234, 0.06)',
  axis: 'rgba(236, 239, 234, 0.10)',
  tick: '#7d8680',
  tickFont: "'Geist Mono Variable', ui-monospace, monospace",
  tickSize: 11,
  surface: '#111613',
  cursor: 'rgba(236, 239, 234, 0.14)',
  cursorFill: 'rgba(236, 239, 234, 0.04)',
} as const;

/** Cores de série. `primary` = dado principal; `baseline` = comparação; `highlight` = o único destaque. */
export const seriesColor = {
  primary: '#10b981',
  primarySoft: '#34d399',
  baseline: '#7d8680',
  muted: '#4b544e',
  highlight: '#c5f26b',
  info: '#7cc4f0',
  warning: '#f5b544',
} as const;

export const tickStyle = {
  fill: chartTheme.tick,
  fontSize: chartTheme.tickSize,
  fontFamily: chartTheme.tickFont,
  fontVariantNumeric: 'tabular-nums',
} as const;

export type ValueFormatter = (v: number) => string;

export interface SeriesSpec {
  /** Chave no objeto de dados. */
  key: string;
  label: string;
  color: string;
  /** Desenha só a linha (sem preenchimento) — útil para a série de comparação. */
  lineOnly?: boolean;
  /** Linha tracejada: reservado para PROJEÇÃO/meta, nunca para dado real. */
  dashed?: boolean;
}
