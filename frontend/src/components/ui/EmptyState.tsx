import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Inbox } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { Tone } from '@/lib/labels';

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: ReactNode;
  description?: ReactNode;
  /** Botão(ões) de ação. Use no máximo um primário. */
  action?: ReactNode;
  /** Só danger/warning mudam a cor do ícone; o resto é neutro. */
  tone?: Extract<Tone, 'brand' | 'lime' | 'danger' | 'warning' | 'info' | 'neutral'>;
  /** Versão menor, para dentro de cards. */
  compact?: boolean;
  /** Itens extras abaixo (ex.: lista do que a tela terá). */
  children?: ReactNode;
  className?: string;
}

const iconTone: Record<string, string> = { danger: 'text-danger', warning: 'text-warning' };

/** Estado vazio. `<EmptyState icon={Recycle} title="Nenhum descarte ainda" action={<ButtonLink…/>} />` */
export function EmptyState({ icon: Icon = Inbox, title, description, action, tone = 'neutral', compact, children, className }: EmptyStateProps) {
  return (
    <div className={cn('relative flex flex-col items-center text-center', compact ? 'px-4 py-8' : 'px-6 py-14 sm:py-20', className)}>
      <div className={cn(
        'mb-5 flex items-center justify-center rounded-xl border border-line-strong bg-surface-2',
        compact ? 'size-11' : 'size-14', iconTone[tone] ?? 'text-fg-soft',
      )}>
        <Icon className={compact ? 'size-5' : 'size-6'} aria-hidden strokeWidth={1.6} />
      </div>
      <h3 className={cn('font-semibold tracking-tight text-fg', compact ? 'text-base' : 'text-xl')}>{title}</h3>
      {description && <p className={cn('mt-2 max-w-[52ch] text-muted', compact ? 'text-sm' : 'text-[15px] leading-relaxed')}>{description}</p>}
      {action && <div className="mt-6 flex flex-wrap items-center justify-center gap-3">{action}</div>}
      {children && <div className="mt-10 w-full">{children}</div>}
    </div>
  );
}
