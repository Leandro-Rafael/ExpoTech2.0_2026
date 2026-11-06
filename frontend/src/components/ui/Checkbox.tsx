import { useId, type ComponentPropsWithRef, type ReactNode } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface PropsCaixaSelecao extends Omit<ComponentPropsWithRef<'input'>, 'type'> {
  label?: ReactNode;
  description?: ReactNode;
}

/** Checkbox nativo estilizado (compatível com register()). */
export function CaixaSelecao({ label, description, className, id, ...rest }: PropsCaixaSelecao) {
  const idAuto = useId();
  const idCampo = id ?? idAuto;
  return (
    <label htmlFor={idCampo} className={cn('group inline-flex cursor-pointer items-start gap-3 select-none', rest.disabled && 'cursor-not-allowed opacity-55', className)}>
      <span className="relative mt-0.5 inline-flex size-5 shrink-0">
        <input
          id={idCampo}
          type="checkbox"
          className="peer absolute inset-0 size-5 cursor-pointer appearance-none rounded-md border border-line-strong bg-bg-deep/60 transition-colors checked:border-transparent checked:bg-fg hover:border-[rgb(236_239_234/0.3)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent aria-invalid:border-danger"
          {...rest}
        />
        <Check aria-hidden strokeWidth={3} className="pointer-events-none absolute inset-0 m-auto size-3.5 scale-50 text-bg-deep opacity-0 transition-all peer-checked:scale-100 peer-checked:opacity-100" />
      </span>
      {(label || description) && (
        <span className="text-sm">
          {label && <span className="block font-medium text-fg">{label}</span>}
          {description && <span className="block text-muted">{description}</span>}
        </span>
      )}
    </label>
  );
}

export interface PropsInterruptor {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  id?: string;
  className?: string;
  size?: 'sm' | 'md';
}

/** Interruptor acessível (role="switch"). Controlado: use com <Controller>. */
export function Interruptor({ checked, onChange, label, description, disabled, id, className, size = 'md' }: PropsInterruptor) {
  const idAuto = useId();
  const idInterruptor = id ?? idAuto;
  const trilho = size === 'sm' ? 'h-5 w-9' : 'h-6 w-11';
  const botaoDeslizante = size === 'sm' ? 'size-4 data-[on=true]:translate-x-4' : 'size-5 data-[on=true]:translate-x-5';
  return (
    <div className={cn('inline-flex items-start gap-3', className)}>
      <button
        id={idInterruptor}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex shrink-0 items-center rounded-full border p-0.5 transition-colors duration-200',
          trilho,
          checked ? 'border-transparent bg-brand-500' : 'border-line-strong bg-surface-3',
          disabled && 'cursor-not-allowed opacity-50',
        )}
      >
        <span data-on={checked} className={cn('rounded-full bg-white shadow-sm transition-transform duration-200 ease-[var(--ease-out-expo)]', botaoDeslizante)} />
      </button>
      {(label || description) && (
        <label htmlFor={idInterruptor} className="cursor-pointer text-sm">
          {label && <span className="block font-medium text-fg">{label}</span>}
          {description && <span className="block text-muted">{description}</span>}
        </label>
      )}
    </div>
  );
}
