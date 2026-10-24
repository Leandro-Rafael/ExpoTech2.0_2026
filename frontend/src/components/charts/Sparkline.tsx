import { useId } from 'react';
import { cn } from '@/lib/cn';

export interface SparklineProps {
  values: number[];
  width?: number;
  height?: number;
  color?: string;
  /** Domínio fixo (ex.: [0, 100] para %). Padrão: min..max dos valores. */
  domain?: [number, number];
  /** Linha horizontal de referência (ex.: limite de coleta automática). */
  threshold?: number;
  /** Preenchimento suave sob a linha. */
  fill?: boolean;
  /** Ponto no último valor. */
  endDot?: boolean;
  ariaLabel?: string;
  className?: string;
}

/**
 * Minigráfico em SVG puro (sem recharts — pode ser usado em qualquer página sem custo de bundle).
 *   <Sparkline values={bin.history.map(h => h.fillLevel)} domain={[0, 100]} threshold={80} />
 */
export function Sparkline({ values, width = 120, height = 32, color = '#10b981', domain, threshold, fill = true, endDot = true, ariaLabel, className }: SparklineProps) {
  const gid = useId().replace(/:/g, '');
  if (values.length < 2) {
    return <svg width={width} height={height} className={className} role="img" aria-label={ariaLabel ?? 'Sem histórico suficiente'}><line x1="0" x2={width} y1={height - 1} y2={height - 1} stroke="rgba(236,239,234,0.1)" /></svg>;
  }
  const pad = 3;
  const [min, max] = domain ?? [Math.min(...values), Math.max(...values)];
  const span = max - min || 1;
  const x = (i: number) => pad + (i / (values.length - 1)) * (width - pad * 2);
  const y = (v: number) => pad + (1 - (Math.max(min, Math.min(max, v)) - min) / span) * (height - pad * 2);
  const pts = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`);
  const line = `M${pts.join(' L')}`;
  const area = `${line} L${x(values.length - 1).toFixed(1)},${height} L${x(0).toFixed(1)},${height} Z`;
  const lastV = values[values.length - 1];
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={cn('overflow-visible', className)} role="img" aria-label={ariaLabel}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.2} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      {threshold != null && (
        <line x1={0} x2={width} y1={y(threshold)} y2={y(threshold)} stroke="rgba(236,239,234,0.22)" strokeWidth={1} strokeDasharray="2 3" />
      )}
      {fill && <path d={area} fill={`url(#${gid})`} />}
      <path d={line} fill="none" stroke={color} strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />
      {endDot && <circle cx={x(values.length - 1)} cy={y(lastV)} r={3} fill={color} stroke="#111613" strokeWidth={2} />}
    </svg>
  );
}
