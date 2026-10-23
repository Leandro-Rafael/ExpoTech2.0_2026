import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Inbox } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { Tone } from '@/lib/labels';

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: ReactNode;
  description?: ReactNode;
  /** Botão(ões) de ação. */
  action?: ReactNode;
  tone?: Extract<Tone, 'brand' | 'lime' | 'danger' | 'warning' | 'info' | 'neutral'>;
  /** Versão menor, para dentro de cards. */
  compact?: boolean;
  /** Itens extras abaixo (ex.: lista de recursos que virão). */
  children?: ReactNode;
  className?: string;
}

const tones = {
  brand: 'text-brand-300 from-brand-500/25',
  lime: 'text-lime-300 from-lime-300/20',
  danger: 'text-danger from-danger/20',
  warning: 'text-warning from-warning/20',
  info: 'text-info from-info/20',
  neutral: 'text-fg-soft from-white/10',
};

/** Estado vazio ilustrado. `<EmptyState icon={Recycle} title="Nenhum descarte ainda" action={<ButtonLink…/>} />` */
export function EmptyState({ icon: Icon = Inbox, title, description, action, tone = 'brand', compact, children, className }: EmptyStateProps) {
  return (
    <div className={cn('relative flex flex-col items-center text-center', compact ? 'px-4 py-8' : 'px-6 py-14 sm:py-20', className)}>
      <div className="relative mb-5">
        <div aria-hidden className={cn('absolute -inset-6 rounded-full bg-radial to-transparent to-70% blur-xl', tones[tone])} />
        <div className={cn(
          'relative flex items-center justify-center rounded-2xl border border-line-strong bg-surface-2/80 shadow-card',
          compact ? 'size-12' : 'size-16', tones[tone].split(' ')[0],
        )}>
          <Icon className={compact ? 'size-6' : 'size-7'} aria-hidden strokeWidth={1.75} />
        </div>
      </div>
      <h3 className={cn('font-display font-semibold text-fg', compact ? 'text-base' : 'text-xl')}>{title}</h3>
      {description && <p className={cn('mt-2 max-w-md text-muted', compact ? 'text-sm' : 'text-[15px] leading-relaxed')}>{description}</p>}
      {action && <div className="mt-6 flex flex-wrap items-center justify-center gap-3">{action}</div>}
      {children && <div className="mt-8 w-full">{children}</div>}
    </div>
  );
}
