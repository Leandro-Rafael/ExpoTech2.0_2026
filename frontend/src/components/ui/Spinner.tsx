import { cn } from '@/lib/cn';

export interface SpinnerProps { size?: number; className?: string; label?: string }

/** Indicador de carregamento circular. `label` é lido por leitores de tela. */
export function Spinner({ size = 18, className, label = 'Carregando' }: SpinnerProps) {
  return (
    <span role="status" aria-label={label} className={cn('inline-flex shrink-0', className)}>
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className="animate-spin" aria-hidden>
        <circle cx="12" cy="12" r="9.5" stroke="currentColor" strokeOpacity=".18" strokeWidth="3" />
        <path d="M21.5 12A9.5 9.5 0 0 0 12 2.5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
    </span>
  );
}
