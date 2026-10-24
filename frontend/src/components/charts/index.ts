/**
 * Gráficos temados (recharts). Importe SÓ de páginas/feature modules lazy — recharts fica no chunk `charts`.
 *   import { AreaChart, BarChart, Donut, ChartFrame, seriesColor } from '@/components/charts';
 * `Sparkline` é SVG puro: importe de '@/components/charts/Sparkline' para não puxar recharts.
 */
export * from './theme';
export * from './ChartFrame';
export * from './ChartTooltip';
export * from './AreaChart';
export * from './BarChart';
export * from './Donut';
export * from './Sparkline';
