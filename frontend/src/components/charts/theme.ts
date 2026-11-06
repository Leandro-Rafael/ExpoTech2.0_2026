/**
 * Tema dos gráficos (espelha os tokens de styles/index.css).
 * Regras: grade/eixos em hairline recessiva, números em Geist Mono tabular,
 * esmeralda para a série principal, neutro para comparação/base, lima só para UM destaque.
 */
export const temaGrafico = {
  grade: 'rgba(236, 239, 234, 0.06)',
  eixo: 'rgba(236, 239, 234, 0.10)',
  marca: '#7d8680',
  fonteMarca: "'Geist Mono Variable', ui-monospace, monospace",
  tamanhoMarca: 11,
  superficie: '#111613',
  cursor: 'rgba(236, 239, 234, 0.14)',
  fundoCursor: 'rgba(236, 239, 234, 0.04)',
} as const;

/** Cores de série. `primary` = dado principal; `baseline` = comparação; `highlight` = o único destaque. */
export const corSerie = {
  principal: '#10b981',
  principalSuave: '#34d399',
  baseline: '#7d8680',
  apagada: '#4b544e',
  destaque: '#c5f26b',
  info: '#7cc4f0',
  alerta: '#f5b544',
} as const;

export const estiloMarca = {
  fill: temaGrafico.marca,
  fontSize: temaGrafico.tamanhoMarca,
  fontFamily: temaGrafico.fonteMarca,
  fontVariantNumeric: 'tabular-nums',
} as const;

export type FormatadorValor = (v: number) => string;

export interface SerieGrafico {
  /** Chave no objeto de dados. */
  chave: string;
  label: string;
  cor: string;
  /** Desenha só a linha (sem preenchimento) — útil para a série de comparação. */
  soLinha?: boolean;
  /** Linha tracejada: reservado para PROJEÇÃO/meta, nunca para dado real. */
  tracejada?: boolean;
}
