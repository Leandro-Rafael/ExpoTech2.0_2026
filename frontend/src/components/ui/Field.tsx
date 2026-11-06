import { cloneElement, createContext, isValidElement, useContext, useId, type ReactElement, type ReactNode } from 'react';
import type { FieldError } from 'react-hook-form';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface PropsCampo {
  label?: ReactNode;
  /** Mensagem de erro — aceita string ou o `FieldError` do react-hook-form (`errors.email`). */
  erro?: string | FieldError | null;
  dica?: ReactNode;
  required?: boolean;
  /** Mostra "(opcional)" ao lado do rótulo. */
  opcional?: boolean;
  /** Conteúdo à direita do rótulo (ex.: link "Esqueci a senha"). */
  rotuloLateral?: ReactNode;
  id?: string;
  className?: string;
  /**
   * Um único controle. O Field injeta `id`, `aria-invalid`, `aria-describedby` e `aria-required`.
   * Para controles compostos, use a forma função: `{(a11y) => <X {...a11y} />}`.
   */
  children: ReactElement | ((a11y: PropsAcessibilidadeCampo) => ReactNode);
}

interface PropsAcessibilidadeCampo {
  id: string;
  'aria-invalid'?: true;
  'aria-describedby'?: string;
  'aria-required'?: true;
}

const ContextoCampo = createContext<PropsAcessibilidadeCampo | null>(null);

/**
 * Usado pelos controles do kit (Input, NumberInput, Select, Textarea): dentro de um <Field>,
 * recebem automaticamente `id`, `aria-describedby`, `aria-invalid` e `aria-required` — mesmo
 * quando estão dentro de um <Controller> ou de um wrapper. Props explícitas têm prioridade.
 */
export function useAcessibilidadeCampo<P extends { id?: string; 'aria-describedby'?: string; 'aria-invalid'?: unknown; 'aria-required'?: unknown }>(props: P): P {
  const ctx = useContext(ContextoCampo);
  if (!ctx) return props;
  const saida: Record<string, unknown> = { ...props };
  for (const k of ['id', 'aria-describedby', 'aria-invalid', 'aria-required'] as const) {
    if (saida[k] == null && ctx[k] != null) saida[k] = ctx[k];
  }
  return saida as P;
}

/**
 * Rótulo + controle + dica + erro, acessível.
 *
 *   <Field label="E-mail" error={errors.email} required>
 *     <Input type="email" {...register('email')} />
 *   </Field>
 */
export function Campo({ label, erro, dica, required, opcional, rotuloLateral, id, className, children }: PropsCampo) {
  const idAuto = useId();
  const idControle = id ?? `f${idAuto}`;
  const mensagem = typeof erro === 'string' ? erro : erro?.message;
  const idDica = dica ? `${idControle}-hint` : undefined;
  const idErro = mensagem ? `${idControle}-error` : undefined;
  const descritoPor = [idErro, idDica].filter(Boolean).join(' ') || undefined;

  const acessibilidade: PropsAcessibilidadeCampo = {
    id: idControle,
    ...(mensagem ? { 'aria-invalid': true as const } : {}),
    ...(descritoPor ? { 'aria-describedby': descritoPor } : {}),
    ...(required ? { 'aria-required': true as const } : {}),
  };

  // Controles do kit leem o contexto; elementos nativos diretos (<input>, <select>...) recebem via clone.
  // Componentes como <Controller> não recebem clone (evita ids duplicados em wrappers).
  const controle = typeof children === 'function'
    ? children(acessibilidade)
    : isValidElement(children) && typeof children.type === 'string'
      ? cloneElement(children as ReactElement<Record<string, unknown>>, acessibilidade as unknown as Record<string, unknown>)
      : children;

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {(label || rotuloLateral) && (
        <div className="flex items-baseline justify-between gap-2">
          {label && (
            <label htmlFor={idControle} className="text-[13px] font-medium text-fg-soft">
              {label}
              {required && <span className="ml-0.5 text-subtle" aria-hidden>*</span>}
              {opcional && <span className="ml-1.5 font-normal text-subtle">(opcional)</span>}
            </label>
          )}
          {rotuloLateral && <div className="text-[13px]">{rotuloLateral}</div>}
        </div>
      )}
      <ContextoCampo.Provider value={acessibilidade}>{controle}</ContextoCampo.Provider>
      {mensagem ? (
        <p id={idErro} role="alert" className="flex items-start gap-1.5 text-[13px] text-danger animate-fade-up">
          <AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden />
          <span>{mensagem}</span>
        </p>
      ) : dica ? (
        <p id={idDica} className="text-[12.5px] text-muted">{dica}</p>
      ) : null}
    </div>
  );
}

/** Erro geral do formulário (ex.: `errors.root?.server`). */
export function ErroFormulario({ erro, className }: { erro?: string | { message?: string } | null; className?: string }) {
  const mensagem = typeof erro === 'string' ? erro : erro?.message;
  if (!mensagem) return null;
  return (
    <div role="alert" className={cn('flex items-start gap-2.5 rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-3 text-sm text-danger animate-fade-up', className)}>
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{mensagem}</span>
    </div>
  );
}
