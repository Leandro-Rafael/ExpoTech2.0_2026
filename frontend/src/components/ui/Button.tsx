import type { ComponentPropsWithRef, ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Spinner } from './Spinner';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger' | 'link';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'xl';

const base =
  'group/btn relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap font-medium ' +
  'transition-[background,box-shadow,transform,color,border-color,opacity] duration-200 ease-[var(--ease-out-expo)] ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-300 ' +
  'disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 active:scale-[0.98]';

const variants: Record<ButtonVariant, string> = {
  primary:
    'bg-brand-gradient text-bg-deep font-semibold shadow-[0_0_0_1px_rgb(190_242_100/0.35)_inset,0_8px_24px_-8px_rgb(34_197_94/0.6)] ' +
    'hover:shadow-[0_0_0_1px_rgb(217_249_157/0.6)_inset,0_12px_36px_-8px_rgb(132_204_22/0.65)] hover:brightness-110',
  secondary:
    'glass text-fg hover:border-line-strong hover:bg-surface-3/70',
  ghost: 'text-fg-soft hover:bg-white/5 hover:text-fg',
  outline: 'border border-line-strong text-fg hover:border-brand-300/50 hover:bg-brand-500/5',
  danger:
    'bg-danger/15 text-danger border border-danger/30 hover:bg-danger/25 hover:border-danger/50',
  link: 'text-brand-300 hover:text-lime-300 underline-offset-4 hover:underline px-0! h-auto!',
};

const sizes: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-[13px] rounded-md [&_svg]:size-3.5',
  md: 'h-10 px-4 text-sm rounded-lg [&_svg]:size-4',
  lg: 'h-12 px-6 text-[15px] rounded-xl [&_svg]:size-[18px]',
  xl: 'h-14 px-8 text-base rounded-2xl [&_svg]:size-5',
};

interface CommonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  leftIcon?: LucideIcon;
  rightIcon?: LucideIcon;
  fullWidth?: boolean;
  children?: ReactNode;
}

export function buttonClasses({ variant = 'primary', size = 'md', fullWidth, className }: { variant?: ButtonVariant; size?: ButtonSize; fullWidth?: boolean; className?: string } = {}) {
  return cn(base, variants[variant], sizes[size], fullWidth && 'w-full', className);
}

function Inner({ leftIcon: L, rightIcon: R, children, loading }: CommonProps & { loading?: boolean }) {
  return (
    <>
      {loading ? <Spinner size={16} label="Processando" /> : L ? <L aria-hidden /> : null}
      {children != null && <span className={cn(loading && 'opacity-90')}>{children}</span>}
      {R && !loading && <R aria-hidden className="transition-transform duration-200 group-hover/btn:translate-x-0.5" />}
    </>
  );
}

export interface ButtonProps extends CommonProps, Omit<ComponentPropsWithRef<'button'>, 'children'> {
  /** Mostra spinner, desabilita e marca aria-busy. */
  loading?: boolean;
}

/** Botão padrão. `<Button variant="primary" size="lg" leftIcon={Plus} loading={m.isPending}>Salvar</Button>` */
export function Button({ variant, size, leftIcon, rightIcon, fullWidth, loading, className, children, disabled, type = 'button', ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClasses({ variant, size, fullWidth, className })}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      <Inner leftIcon={leftIcon} rightIcon={rightIcon} loading={loading}>{children}</Inner>
    </button>
  );
}

export interface ButtonLinkProps extends CommonProps, Omit<LinkProps, 'children' | 'className'> { className?: string }

/** Link do router com aparência de botão. `<ButtonLink to="/cadastro">Criar conta</ButtonLink>` */
export function ButtonLink({ variant, size, leftIcon, rightIcon, fullWidth, className, children, ...rest }: ButtonLinkProps) {
  return (
    <Link className={buttonClasses({ variant, size, fullWidth, className })} {...rest}>
      <Inner leftIcon={leftIcon} rightIcon={rightIcon}>{children}</Inner>
    </Link>
  );
}
