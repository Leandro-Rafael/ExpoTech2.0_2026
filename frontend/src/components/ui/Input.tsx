import { useState, type ComponentPropsWithRef, type ReactNode } from 'react';
import { Eye, EyeOff, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

/** Classes compartilhadas por Input, NumberInput, Textarea e Select. */
export const controlClasses =
  'w-full rounded-xl border border-line-strong bg-bg-deep/60 text-fg placeholder:text-subtle ' +
  'transition-[border-color,box-shadow,background] duration-150 ' +
  'hover:border-brand-300/35 focus:border-brand-300/70 focus:bg-bg-deep focus:shadow-[0_0_0_4px_rgb(52_211_153/0.14)] focus:outline-none ' +
  'aria-invalid:border-danger/70 aria-invalid:focus:shadow-[0_0_0_4px_rgb(248_113_113/0.15)] ' +
  'disabled:cursor-not-allowed disabled:opacity-55 read-only:bg-surface/60';

const sizes = { sm: 'h-9 text-[13px]', md: 'h-11 text-sm', lg: 'h-12 text-[15px]' };

export interface InputProps extends Omit<ComponentPropsWithRef<'input'>, 'size'> {
  leftIcon?: LucideIcon;
  /** Conteúdo à direita (unidade, botão...). */
  rightSlot?: ReactNode;
  inputSize?: keyof typeof sizes;
  invalid?: boolean;
  wrapperClassName?: string;
}

/**
 * Campo de texto. Compatível com `register()` do react-hook-form (ref é repassado).
 * `<Input leftIcon={Mail} type="email" {...register('email')} />`
 */
export function Input({ leftIcon: L, rightSlot, inputSize = 'md', invalid, className, wrapperClassName, ...rest }: InputProps) {
  return (
    <div className={cn('relative flex items-center', wrapperClassName)}>
      {L && <L aria-hidden className="pointer-events-none absolute left-3.5 size-[18px] text-subtle" />}
      <input
        aria-invalid={invalid || rest['aria-invalid'] || undefined}
        className={cn(controlClasses, sizes[inputSize], L ? 'pl-10' : 'pl-3.5', rightSlot ? 'pr-12' : 'pr-3.5', className)}
        {...rest}
      />
      {rightSlot && <div className="absolute right-1.5 flex items-center">{rightSlot}</div>}
    </div>
  );
}

/** Campo de senha com botão mostrar/ocultar. */
export function PasswordInput(props: Omit<InputProps, 'type' | 'rightSlot'>) {
  const [visible, setVisible] = useState(false);
  return (
    <Input
      {...props}
      type={visible ? 'text' : 'password'}
      autoCapitalize="none"
      spellCheck={false}
      rightSlot={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="inline-flex size-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-white/5 hover:text-fg"
          aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
          aria-pressed={visible}
        >
          {visible ? <EyeOff className="size-[18px]" aria-hidden /> : <Eye className="size-[18px]" aria-hidden />}
        </button>
      }
    />
  );
}
