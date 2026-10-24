import type { ComponentPropsWithRef } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Spinner } from './Spinner';

export interface IconButtonProps extends Omit<ComponentPropsWithRef<'button'>, 'children'> {
  icon: LucideIcon;
  /** Obrigatório: vira aria-label e title. */
  label: string;
  variant?: 'ghost' | 'secondary' | 'primary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

const variants = {
  ghost: 'text-muted hover:text-fg hover:bg-white/[0.05]',
  secondary: 'border border-line-strong text-fg-soft hover:text-fg hover:bg-white/[0.04]',
  primary: 'bg-accent text-accent-ink hover:bg-accent-hover',
  danger: 'text-danger hover:bg-danger/10',
};
const sizes = { sm: 'size-8 rounded-md [&_svg]:size-4', md: 'size-10 rounded-[10px] [&_svg]:size-[18px]', lg: 'size-12 rounded-xl [&_svg]:size-5' };

/** Botão só com ícone (sempre com rótulo acessível). `<IconButton icon={X} label="Fechar" />` */
export function IconButton({ icon: Icon, label, variant = 'ghost', size = 'md', loading, className, type = 'button', disabled, ...rest }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      disabled={disabled || loading}
      className={cn(
        'inline-flex shrink-0 items-center justify-center transition-colors duration-150 active:scale-95 disabled:opacity-50 disabled:pointer-events-none',
        variants[variant], sizes[size], className,
      )}
      {...rest}
    >
      {loading ? <Spinner size={16} /> : <Icon aria-hidden />}
    </button>
  );
}
