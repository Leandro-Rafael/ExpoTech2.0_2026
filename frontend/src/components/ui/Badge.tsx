import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { EnumMeta, Tone } from '@/lib/labels';

export const toneClasses: Record<Tone, string> = {
  neutral: 'bg-white/5 text-fg-soft border-white/10',
  brand: 'bg-brand-500/12 text-brand-300 border-brand-400/25',
  lime: 'bg-lime-300/12 text-lime-200 border-lime-300/25',
  success: 'bg-success/12 text-success border-success/25',
  warning: 'bg-warning/12 text-warning border-warning/25',
  danger: 'bg-danger/12 text-danger border-danger/25',
  info: 'bg-info/12 text-info border-info/25',
};
export const toneDot: Record<Tone, string> = {
  neutral: 'bg-muted', brand: 'bg-brand-300', lime: 'bg-lime-300', success: 'bg-success',
  warning: 'bg-warning', danger: 'bg-danger', info: 'bg-info',
};

export interface BadgeProps {
  tone?: Tone;
  size?: 'sm' | 'md';
  icon?: LucideIcon;
  dot?: boolean;
  className?: string;
  children: ReactNode;
}

/** Etiqueta compacta. `<Badge tone="lime" icon={Sparkles}>IA</Badge>` */
export function Badge({ tone = 'neutral', size = 'sm', icon: Icon, dot, className, children }: BadgeProps) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 rounded-full border font-medium whitespace-nowrap',
      size === 'sm' ? 'h-6 px-2.5 text-xs' : 'h-7 px-3 text-[13px]',
      toneClasses[tone], className,
    )}>
      {dot && <span aria-hidden className={cn('size-1.5 rounded-full', toneDot[tone])} />}
      {Icon && <Icon aria-hidden className="size-3.5" />}
      {children}
    </span>
  );
}

export interface StatusPillProps<K extends string> {
  /** Mapa de enum de `@/lib/labels` (ex.: disposalStatus). */
  map: Record<K, EnumMeta>;
  value: K;
  /** Ponto pulsante (útil para estados "vivos": pendente, em rota). */
  pulse?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

/** Status de enum com rótulo PT e cor. `<StatusPill map={disposalStatus} value={d.status} />` */
export function StatusPill<K extends string>({ map, value, pulse, size = 'sm', className }: StatusPillProps<K>) {
  const meta = map[value] ?? { label: String(value), tone: 'neutral' as Tone };
  return (
    <span
      title={meta.description}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-medium whitespace-nowrap',
        size === 'sm' ? 'h-6 px-2.5 text-xs' : 'h-7 px-3 text-[13px]',
        toneClasses[meta.tone], className,
      )}
    >
      <span aria-hidden className="relative flex size-1.5">
        {pulse && <span className={cn('absolute inline-flex size-full animate-ping rounded-full opacity-70', toneDot[meta.tone])} />}
        <span className={cn('relative inline-flex size-1.5 rounded-full', toneDot[meta.tone])} />
      </span>
      {meta.label}
    </span>
  );
}
