import type { ComponentPropsWithRef, ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';
import { IconeCarregando } from './Spinner';

export type VarianteBotao = 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger' | 'link';
export type TamanhoBotao = 'sm' | 'md' | 'lg' | 'xl';

const classeBase =
  'group/btn relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap font-medium tracking-[-0.005em] ' +
  'transition-[background-color,color,border-color,transform,opacity] duration-200 ease-[var(--ease-out-expo)] ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ' +
  'disabled:pointer-events-none disabled:opacity-45 aria-disabled:pointer-events-none aria-disabled:opacity-45 active:translate-y-0';

const variantes: Record<VarianteBotao, string> = {
  // Acento: use UM primário por tela/área.
  primary: 'bg-accent text-accent-ink font-semibold hover:bg-accent-hover hover:-translate-y-px',
  secondary: 'border border-line-strong text-fg hover:border-[rgb(236_239_234/0.24)] hover:bg-white/[0.04]',
  ghost: 'text-fg-soft hover:bg-white/[0.05] hover:text-fg',
  outline: 'border border-line-strong text-fg hover:bg-white/[0.04]',
  danger: 'border border-danger/35 text-danger hover:bg-danger/10',
  link: 'text-fg underline decoration-line-strong underline-offset-4 hover:decoration-fg px-0! h-auto!',
};

const tamanhos: Record<TamanhoBotao, string> = {
  sm: 'h-9 px-3.5 text-[13px] rounded-lg [&_svg]:size-3.5',
  md: 'h-11 px-4.5 text-sm rounded-[10px] [&_svg]:size-4',
  lg: 'h-12 px-5 text-[15px] rounded-xl [&_svg]:size-[18px]',
  xl: 'h-14 px-6 text-base rounded-xl [&_svg]:size-5',
};

interface PropsComuns {
  variant?: VarianteBotao;
  size?: TamanhoBotao;
  iconeEsquerda?: LucideIcon;
  iconeDireita?: LucideIcon;
  larguraTotal?: boolean;
  children?: ReactNode;
}

export function classesBotao({ variant = 'primary', size = 'md', larguraTotal, className }: { variant?: VarianteBotao; size?: TamanhoBotao; larguraTotal?: boolean; className?: string } = {}) {
  return cn(classeBase, variantes[variant], tamanhos[size], larguraTotal && 'w-full', className);
}

function Conteudo({ iconeEsquerda: L, iconeDireita: R, children, carregando }: PropsComuns & { carregando?: boolean }) {
  return (
    <>
      {carregando ? <IconeCarregando size={16} label="Processando" /> : L ? <L aria-hidden /> : null}
      {children != null && <span className={cn(carregando && 'opacity-90')}>{children}</span>}
      {R && !carregando && <R aria-hidden className="transition-transform duration-200 group-hover/btn:translate-x-0.5" />}
    </>
  );
}

export interface PropsBotao extends PropsComuns, Omit<ComponentPropsWithRef<'button'>, 'children'> {
  /** Mostra spinner, desabilita e marca aria-busy. */
  carregando?: boolean;
}

/** Botão padrão. `<Button variant="primary" size="lg" leftIcon={Plus} loading={m.isPending}>Salvar</Button>` */
export function Botao({ variant, size, iconeEsquerda, iconeDireita, larguraTotal, carregando, className, children, disabled, type = 'button', ...rest }: PropsBotao) {
  return (
    <button
      type={type}
      className={classesBotao({ variant, size, larguraTotal, className })}
      disabled={disabled || carregando}
      aria-busy={carregando || undefined}
      {...rest}
    >
      <Conteudo iconeEsquerda={iconeEsquerda} iconeDireita={iconeDireita} carregando={carregando}>{children}</Conteudo>
    </button>
  );
}

export interface PropsLinkBotao extends PropsComuns, Omit<LinkProps, 'children' | 'className'> { className?: string }

/** Link do router com aparência de botão. `<ButtonLink to="/cadastro">Criar conta</ButtonLink>` */
export function LinkBotao({ variant, size, iconeEsquerda, iconeDireita, larguraTotal, className, children, ...rest }: PropsLinkBotao) {
  return (
    <Link className={classesBotao({ variant, size, larguraTotal, className })} {...rest}>
      <Conteudo iconeEsquerda={iconeEsquerda} iconeDireita={iconeDireita}>{children}</Conteudo>
    </Link>
  );
}
