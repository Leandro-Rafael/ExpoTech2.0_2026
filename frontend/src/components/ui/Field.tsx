import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from 'react';
import type { FieldError } from 'react-hook-form';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface FieldProps {
  label?: ReactNode;
  /** Mensagem de erro — aceita string ou o `FieldError` do react-hook-form (`errors.email`). */
  error?: string | FieldError | null;
  hint?: ReactNode;
  required?: boolean;
  /** Mostra "(opcional)" ao lado do rótulo. */
  optional?: boolean;
  /** Conteúdo à direita do rótulo (ex.: link "Esqueci a senha"). */
  labelAside?: ReactNode;
  id?: string;
  className?: string;
  /**
   * Um único controle. O Field injeta `id`, `aria-invalid`, `aria-describedby` e `aria-required`.
   * Para controles compostos, use a forma função: `{(a11y) => <X {...a11y} />}`.
   */
  children: ReactElement | ((a11y: FieldA11yProps) => ReactNode);
}

export interface FieldA11yProps {
  id: string;
  'aria-invalid'?: true;
  'aria-describedby'?: string;
  'aria-required'?: true;
}

/**
 * Rótulo + controle + dica + erro, acessível.
 *
 *   <Field label="E-mail" error={errors.email} required>
 *     <Input type="email" {...register('email')} />
 *   </Field>
 */
export function Field({ label, error, hint, required, optional, labelAside, id, className, children }: FieldProps) {
  const auto = useId();
  const controlId = id ?? `f${auto}`;
  const message = typeof error === 'string' ? error : error?.message;
  const hintId = hint ? `${controlId}-hint` : undefined;
  const errorId = message ? `${controlId}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;

  const a11y: FieldA11yProps = {
    id: controlId,
    ...(message ? { 'aria-invalid': true as const } : {}),
    ...(describedBy ? { 'aria-describedby': describedBy } : {}),
    ...(required ? { 'aria-required': true as const } : {}),
  };

  const control = typeof children === 'function'
    ? children(a11y)
    : isValidElement(children)
      ? cloneElement(children as ReactElement<Record<string, unknown>>, a11y as unknown as Record<string, unknown>)
      : children;

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {(label || labelAside) && (
        <div className="flex items-baseline justify-between gap-2">
          {label && (
            <label htmlFor={controlId} className="text-[13px] font-medium text-fg-soft">
              {label}
              {required && <span className="ml-0.5 text-lime-300" aria-hidden>*</span>}
              {optional && <span className="ml-1.5 font-normal text-subtle">(opcional)</span>}
            </label>
          )}
          {labelAside && <div className="text-[13px]">{labelAside}</div>}
        </div>
      )}
      {control}
      {message ? (
        <p id={errorId} role="alert" className="flex items-start gap-1.5 text-[13px] text-danger animate-fade-up">
          <AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden />
          <span>{message}</span>
        </p>
      ) : hint ? (
        <p id={hintId} className="text-[12.5px] text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

/** Erro geral do formulário (ex.: `errors.root?.server`). */
export function FormError({ error, className }: { error?: string | { message?: string } | null; className?: string }) {
  const message = typeof error === 'string' ? error : error?.message;
  if (!message) return null;
  return (
    <div role="alert" className={cn('flex items-start gap-2.5 rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-3 text-sm text-danger animate-fade-up', className)}>
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{message}</span>
    </div>
  );
}
