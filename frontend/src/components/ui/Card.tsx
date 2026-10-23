import type { ComponentPropsWithRef, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface CardProps extends ComponentPropsWithRef<'div'> {
  /** glass (padrão, vidro), solid (superfície opaca), outline (só borda), gradient (borda em gradiente + brilho). */
  variant?: 'glass' | 'solid' | 'outline' | 'gradient';
  /** Efeito hover de elevação (para cards clicáveis). */
  interactive?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const variants = {
  glass: 'glass',
  solid: 'bg-surface border border-line shadow-card',
  outline: 'border border-line bg-transparent',
  gradient: 'glass ring-gradient shadow-glow',
};
const paddings = { none: '', sm: 'p-4', md: 'p-5 sm:p-6', lg: 'p-6 sm:p-8' };

/** Contêiner base. `<Card><CardHeader title="..." /> ... </Card>` */
export function Card({ variant = 'glass', interactive, padding = 'md', className, ...rest }: CardProps) {
  return (
    <div
      className={cn(
        'relative rounded-2xl',
        variants[variant],
        paddings[padding],
        interactive && 'cursor-pointer transition-[transform,border-color,box-shadow] duration-300 ease-[var(--ease-out-expo)] hover:-translate-y-0.5 hover:border-line-strong hover:shadow-pop',
        className,
      )}
      {...rest}
    />
  );
}

export interface CardHeaderProps { title: ReactNode; description?: ReactNode; action?: ReactNode; icon?: ReactNode; className?: string }

export function CardHeader({ title, description, action, icon, className }: CardHeaderProps) {
  return (
    <div className={cn('mb-4 flex items-start justify-between gap-4', className)}>
      <div className="flex min-w-0 items-start gap-3">
        {icon && <div className="mt-0.5 shrink-0">{icon}</div>}
        <div className="min-w-0">
          <h3 className="font-display text-base font-semibold text-fg">{title}</h3>
          {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function CardFooter({ className, ...rest }: ComponentPropsWithRef<'div'>) {
  return <div className={cn('mt-5 flex items-center justify-end gap-2 border-t border-line pt-4', className)} {...rest} />;
}
