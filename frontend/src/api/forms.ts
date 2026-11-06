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
import { ErroApi, mensagemDeErro } from './client';

export interface OpcoesErrosDoServidor {
  /** Renomeia campos do back-end para nomes do formulário. */
  fieldMap?: Record<string, string>;
  /** Campos que existem no form (os demais vão para root). Se omitido, aplica todos. */
  knownFields?: readonly string[];
  /** Mostra toast com a mensagem geral (padrão: true quando não há erros de campo). */
  toast?: boolean;
}

/** Retorna true se ao menos um erro foi atribuído a um campo. */
export function aplicarErrosDoServidor<T extends FieldValues>(
  erro: unknown,
  setError: UseFormSetError<T>,
  opcoes: OpcoesErrosDoServidor = {},
): boolean {
  const mensagem = mensagemDeErro(erro);
  let atribuidos = 0;
  if (erro instanceof ErroApi && erro.fieldErrors.length) {
    for (const fe of erro.fieldErrors) {
      const nome = opcoes.fieldMap?.[fe.field] ?? fe.field;
      if (opcoes.knownFields && !opcoes.knownFields.includes(nome)) continue;
      setError(nome as Path<T>, { type: 'server', message: fe.message }, { shouldFocus: atribuidos === 0 });
      atribuidos++;
    }
  }
  if (!atribuidos) {
    setError('root.server' as Path<T>, { type: 'server', message: mensagem });
  }
  if (opcoes.toast ?? !atribuidos) toast.error(mensagem);
  return atribuidos > 0;
}
