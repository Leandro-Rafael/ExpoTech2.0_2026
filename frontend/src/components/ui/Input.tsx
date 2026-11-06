import { useState, type ComponentPropsWithRef, type ReactNode } from 'react';
import { Eye, EyeOff, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useAcessibilidadeCampo } from './Field';

/** Classes compartilhadas por Input, NumberInput, Textarea e Select. */
export const classesControle =
  'w-full rounded-[10px] border border-line-strong bg-bg-deep/70 text-fg placeholder:text-subtle ' +
  'transition-[border-color,box-shadow,background] duration-150 ' +
  'hover:border-[rgb(236_239_234/0.24)] focus:border-[rgb(236_239_234/0.36)] focus:bg-bg-deep focus:shadow-[0_0_0_3px_rgb(197_242_107/0.14)] focus:outline-none ' +
  'aria-invalid:border-danger/70 aria-invalid:focus:shadow-[0_0_0_4px_rgb(248_113_113/0.15)] ' +
  'disabled:cursor-not-allowed disabled:opacity-55 read-only:bg-surface/60';

const tamanhos = { sm: 'h-9 text-[13px]', md: 'h-11 text-sm', lg: 'h-12 text-[15px]' };

export interface PropsCampoTexto extends Omit<ComponentPropsWithRef<'input'>, 'size'> {
  iconeEsquerda?: LucideIcon;
  /** Conteúdo à direita (unidade, botão...). */
  rightSlot?: ReactNode;
  tamanhoCampo?: keyof typeof tamanhos;
  invalido?: boolean;
  classeContainer?: string;
}

/**
 * Campo de texto. Compatível com `register()` do react-hook-form (ref é repassado).
 * `<Input leftIcon={Mail} type="email" {...register('email')} />`
 */
export function CampoTexto({ iconeEsquerda: L, rightSlot, tamanhoCampo = 'md', invalido, className, classeContainer, ...props }: PropsCampoTexto) {
  const resto = useAcessibilidadeCampo(props);
  return (
    <div className={cn('relative flex items-center', classeContainer)}>
      {L && <L aria-hidden className="pointer-events-none absolute left-3.5 size-[18px] text-subtle" />}
      <input
        aria-invalid={invalido || resto['aria-invalid'] || undefined}
        className={cn(classesControle, tamanhos[tamanhoCampo], L ? 'pl-10' : 'pl-3.5', rightSlot ? 'pr-12' : 'pr-3.5', className)}
        {...resto}
      />
      {rightSlot && <div className="absolute right-1.5 flex items-center">{rightSlot}</div>}
    </div>
  );
}

/** Campo de senha com botão mostrar/ocultar. */
export function CampoSenha(props: Omit<PropsCampoTexto, 'type' | 'rightSlot'>) {
  const [visivel, setVisivel] = useState(false);
  return (
    <CampoTexto
      {...props}
      type={visivel ? 'text' : 'password'}
      autoCapitalize="none"
      spellCheck={false}
      rightSlot={
        <button
          type="button"
          onClick={() => setVisivel((v) => !v)}
          className="inline-flex size-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-white/5 hover:text-fg"
          aria-label={visivel ? 'Ocultar senha' : 'Mostrar senha'}
          aria-pressed={visivel}
        >
          {visivel ? <EyeOff className="size-[18px]" aria-hidden /> : <Eye className="size-[18px]" aria-hidden />}
        </button>
      }
    />
  );
}
