import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { MetaEnum, Tom } from '@/lib/labels';

const classesTom: Record<Tom, string> = {
  neutral: 'bg-white/5 text-fg-soft border-white/10',
  brand: 'bg-brand-500/12 text-brand-300 border-brand-400/25',
  lime: 'bg-white/[0.06] text-fg border-line-strong',
  success: 'bg-success/12 text-success border-success/25',
  warning: 'bg-warning/12 text-warning border-warning/25',
  danger: 'bg-danger/12 text-danger border-danger/25',
  info: 'bg-info/12 text-info border-info/25',
};
export const pontoTom: Record<Tom, string> = {
  neutral: 'bg-muted', brand: 'bg-brand-300', lime: 'bg-fg', success: 'bg-success',
  warning: 'bg-warning', danger: 'bg-danger', info: 'bg-info',
};

export interface PropsEtiqueta {
  tone?: Tom;
  size?: 'sm' | 'md';
  icon?: LucideIcon;
  ponto?: boolean;
  className?: string;
  children: ReactNode;
}

/** Etiqueta compacta. `<Badge tone="lime" icon={Sparkles}>IA</Badge>` */
export function Etiqueta({ tone = 'neutral', size = 'sm', icon: Icone, ponto, className, children }: PropsEtiqueta) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 rounded-full border font-medium whitespace-nowrap',
      size === 'sm' ? 'h-6 px-2.5 text-xs' : 'h-7 px-3 text-[13px]',
      classesTom[tone], className,
    )}>
      {ponto && <span aria-hidden className={cn('size-1.5 rounded-full', pontoTom[tone])} />}
      {Icone && <Icone aria-hidden className="size-3.5" />}
      {children}
    </span>
  );
}

export interface PropsPilulaStatus<K extends string> {
  /** Mapa de enum de `@/lib/labels` (ex.: disposalStatus). */
  mapa: Record<K, MetaEnum>;
  value: K;
  /** Ponto pulsante (útil para estados "vivos": pendente, em rota). */
  pulsar?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

/** Status de enum com rótulo PT e cor. `<StatusPill map={disposalStatus} value={d.status} />` */
export function PilulaStatus<K extends string>({ mapa, value, pulsar, size = 'sm', className }: PropsPilulaStatus<K>) {
  const meta = mapa[value] ?? { label: String(value), tone: 'neutral' as Tom };
  return (
    <span
      title={meta.description}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-medium whitespace-nowrap',
        size === 'sm' ? 'h-6 px-2.5 text-xs' : 'h-7 px-3 text-[13px]',
        classesTom[meta.tone], className,
      )}
    >
      <span aria-hidden className="relative flex size-1.5">
        {pulsar && <span className={cn('absolute inline-flex size-full animate-ping rounded-full opacity-70', pontoTom[meta.tone])} />}
        <span className={cn('relative inline-flex size-1.5 rounded-full', pontoTom[meta.tone])} />
      </span>
      {meta.label}
    </span>
  );
}
