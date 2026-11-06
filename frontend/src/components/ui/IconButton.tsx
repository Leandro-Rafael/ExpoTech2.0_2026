import type { ComponentPropsWithRef } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';
import { IconeCarregando } from './Spinner';

export interface PropsBotaoIcone extends Omit<ComponentPropsWithRef<'button'>, 'children'> {
  icon: LucideIcon;
  /** Obrigatório: vira aria-label e title. */
  label: string;
  variant?: 'ghost' | 'secondary' | 'primary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  carregando?: boolean;
}

const variantes = {
  ghost: 'text-muted hover:text-fg hover:bg-white/[0.05]',
  secondary: 'border border-line-strong text-fg-soft hover:text-fg hover:bg-white/[0.04]',
  primary: 'bg-accent text-accent-ink hover:bg-accent-hover',
  danger: 'text-danger hover:bg-danger/10',
};
const tamanhos = { sm: 'size-8 rounded-md [&_svg]:size-4', md: 'size-10 rounded-[10px] [&_svg]:size-[18px]', lg: 'size-12 rounded-xl [&_svg]:size-5' };

/** Botão só com ícone (sempre com rótulo acessível). `<IconButton icon={X} label="Fechar" />` */
export function BotaoIcone({ icon: Icone, label, variant = 'ghost', size = 'md', carregando, className, type = 'button', disabled, ...rest }: PropsBotaoIcone) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      disabled={disabled || carregando}
      className={cn(
        'inline-flex shrink-0 items-center justify-center transition-colors duration-150 active:scale-95 disabled:opacity-50 disabled:pointer-events-none',
        variantes[variant], tamanhos[size], className,
      )}
      {...rest}
    >
      {carregando ? <IconeCarregando size={16} /> : <Icone aria-hidden />}
    </button>
  );
}
