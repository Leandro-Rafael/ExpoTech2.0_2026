/**
 * Integração ApiError ↔ react-hook-form.
 *
 *   const onSubmit = form.handleSubmit(async (values) => {
 *     try { await mutation.mutateAsync(values); }
 *     catch (e) { applyServerErrors(e, form.setError, { fieldMap: { 'address.street': 'street' } }); }
 *   });
 *
 * Erros de campo vão para os campos; o restante vira `root.server` (mostre com <FormError />)
 * e, opcionalmente, um toast.
 */
import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { toast } from 'sonner';
import { ApiError, errorMessage } from './client';

export interface ApplyServerErrorsOptions {
  /** Renomeia campos do back-end para nomes do formulário. */
  fieldMap?: Record<string, string>;
  /** Campos que existem no form (os demais vão para root). Se omitido, aplica todos. */
  knownFields?: readonly string[];
  /** Mostra toast com a mensagem geral (padrão: true quando não há erros de campo). */
  toast?: boolean;
}

/** Retorna true se ao menos um erro foi atribuído a um campo. */
export function applyServerErrors<T extends FieldValues>(
  err: unknown,
  setError: UseFormSetError<T>,
  opts: ApplyServerErrorsOptions = {},
): boolean {
  const message = errorMessage(err);
  let assigned = 0;
  if (err instanceof ApiError && err.fieldErrors.length) {
    for (const fe of err.fieldErrors) {
      const name = opts.fieldMap?.[fe.field] ?? fe.field;
      if (opts.knownFields && !opts.knownFields.includes(name)) continue;
      setError(name as Path<T>, { type: 'server', message: fe.message }, { shouldFocus: assigned === 0 });
      assigned++;
    }
  }
  if (!assigned) {
    setError('root.server' as Path<T>, { type: 'server', message });
  }
  if (opts.toast ?? !assigned) toast.error(message);
  return assigned > 0;
}
