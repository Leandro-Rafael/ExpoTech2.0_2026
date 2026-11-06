import { useId } from 'react';
import { cn } from '@/lib/cn';

export interface PropsMinigrafico {
  valores: number[];
  width?: number;
  height?: number;
  cor?: string;
  /** Domínio fixo (ex.: [0, 100] para %). Padrão: min..max dos valores. */
  dominio?: [number, number];
  /** Linha horizontal de referência (ex.: limite de coleta automática). */
  limite?: number;
  /** Preenchimento suave sob a linha. */
  preencher?: boolean;
  /** Ponto no último valor. */
  pontoFinal?: boolean;
  ariaLabel?: string;
  className?: string;
}

/**
 * Minigráfico em SVG puro (sem recharts — pode ser usado em qualquer página sem custo de bundle).
 *   <Sparkline values={bin.history.map(h => h.fillLevel)} domain={[0, 100]} threshold={80} />
 */
export function Minigrafico({ valores, width = 120, height = 32, cor = '#10b981', dominio, limite, preencher = true, pontoFinal = true, ariaLabel, className }: PropsMinigrafico) {
  const gid = useId().replace(/:/g, '');
  if (valores.length < 2) {
    return <svg width={width} height={height} className={className} role="img" aria-label={ariaLabel ?? 'Sem histórico suficiente'}><line x1="0" x2={width} y1={height - 1} y2={height - 1} stroke="rgba(236,239,234,0.1)" /></svg>;
  }
  const margem = 3;
  const [min, max] = dominio ?? [Math.min(...valores), Math.max(...valores)];
  const amplitude = max - min || 1;
  const x = (i: number) => margem + (i / (valores.length - 1)) * (width - margem * 2);
  const y = (v: number) => margem + (1 - (Math.max(min, Math.min(max, v)) - min) / amplitude) * (height - margem * 2);
  const pontos = valores.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`);
  const linha = `M${pontos.join(' L')}`;
  const areaPreenchida = `${linha} L${x(valores.length - 1).toFixed(1)},${height} L${x(0).toFixed(1)},${height} Z`;
  const ultimoValor = valores[valores.length - 1];
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={cn('overflow-visible', className)} role="img" aria-label={ariaLabel}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={cor} stopOpacity={0.2} />
          <stop offset="100%" stopColor={cor} stopOpacity={0} />
        </linearGradient>
      </defs>
      {limite != null && (
        <line x1={0} x2={width} y1={y(limite)} y2={y(limite)} stroke="rgba(236,239,234,0.22)" strokeWidth={1} strokeDasharray="2 3" />
      )}
      {preencher && <path d={areaPreenchida} fill={`url(#${gid})`} />}
      <path d={linha} fill="none" stroke={cor} strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />
      {pontoFinal && <circle cx={x(valores.length - 1)} cy={y(ultimoValor)} r={3} fill={cor} stroke="#111613" strokeWidth={2} />}
    </svg>
  );
}
