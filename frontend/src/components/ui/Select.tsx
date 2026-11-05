import type { ComponentPropsWithRef } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';
import { controlClasses } from './Input';
import { useFieldA11y } from './Field';

interface SelectOption { value: string; label: string; disabled?: boolean }

export interface SelectProps extends Omit<ComponentPropsWithRef<'select'>, 'size'> {
  options?: SelectOption[];
  /** Opção vazia inicial ("Selecione..."). */
  placeholder?: string;
  invalid?: boolean;
  inputSize?: 'sm' | 'md' | 'lg';
}

const sizes = { sm: 'h-9 text-[13px]', md: 'h-11 text-sm', lg: 'h-12 text-[15px]' };

/**
 * Select nativo estilizado (melhor acessibilidade e UX no celular). Compatível com register().
 * `<Select options={[{ value: 'WEEK', label: 'Semana' }]} {...register('period')} />`
 */
export function Select({ options, placeholder, invalid, inputSize = 'md', className, children, ...props }: SelectProps) {
  const rest = useFieldA11y(props);
  return (
    <div className="relative">
      <select
        aria-invalid={invalid || rest['aria-invalid'] || undefined}
        className={cn(controlClasses, sizes[inputSize], 'cursor-pointer appearance-none pr-10 pl-3.5 [&>option]:bg-surface [&>option]:text-fg', className)}
        {...rest}
      >
        {placeholder != null && <option value="">{placeholder}</option>}
        {options?.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>{o.label}</option>
        ))}
        {children}
      </select>
      <ChevronDown aria-hidden className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-muted" />
    </div>
  );
}
