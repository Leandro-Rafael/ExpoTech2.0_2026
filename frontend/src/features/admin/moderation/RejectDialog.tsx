import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { Disposal } from '@/api/types';
import { Botao, Campo, Modal, AreaTexto } from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatarKg } from '@/lib/format';

const MOTIVOS_PRONTOS = [
  'A foto não corresponde ao material declarado.',
  'Foto duplicada ou reaproveitada de outro envio.',
  'Quantidade incompatível com o que aparece na foto.',
  'Material contaminado ou não reciclável nesta categoria.',
  'Sem comprovação suficiente para validar o descarte.',
];

const esquema = z.object({
  reason: z.string().trim().min(3, 'Informe o motivo da recusa (mín. 3 caracteres)').max(300, 'Máximo de 300 caracteres'),
});
type Valores = z.infer<typeof esquema>;

/** Recusa com motivo obrigatório (atalhos de motivo + texto livre). */
export function DialogoRecusa({ descarte, onClose, aoConfirmar }: {
  descarte: Disposal | null; onClose: () => void; aoConfirmar: (reason: string) => void;
}) {
  const formulario = useForm<Valores>({ resolver: zodResolver(esquema), defaultValues: { reason: '' } });
  useEffect(() => { if (descarte) formulario.reset({ reason: '' }); }, [descarte, formulario]);
  const motivo = formulario.watch('reason');

  return (
    <Modal
      open={!!descarte}
      onClose={onClose}
      title="Recusar descarte"
      description={descarte ? `${descarte.category.name} · ${formatarKg(descarte.quantityKg)} de ${descarte.user?.name ?? 'usuário'}. O morador verá o motivo.` : undefined}
      rodape={
        <>
          <Botao variant="ghost" onClick={onClose}>Cancelar</Botao>
          <Botao variant="danger" type="submit" form="reject-form">Recusar descarte</Botao>
        </>
      }
    >
      <form id="reject-form" noValidate onSubmit={formulario.handleSubmit((v) => aoConfirmar(v.reason.trim()))} className="space-y-4">
        <fieldset>
          <legend className="mb-2 text-[13px] font-medium text-fg-soft">Motivos frequentes</legend>
          <div className="flex flex-col gap-1.5">
            {MOTIVOS_PRONTOS.map((p) => {
              const ativo = motivo === p;
              return (
                <button key={p} type="button" aria-pressed={ativo}
                  onClick={() => formulario.setValue('reason', p, { shouldValidate: true })}
                  className={cn('rounded-lg border px-3 py-2 text-left text-[13px] transition-colors',
                    ativo ? 'border-line-strong bg-surface-3 text-fg' : 'border-line text-muted hover:border-line-strong hover:text-fg-soft')}>
                  {p}
                </button>
              );
            })}
          </div>
        </fieldset>
        <Campo label="Motivo" required erro={formulario.formState.errors.reason} dica="Escreva com clareza: o morador recebe esta mensagem.">
          <AreaTexto {...formulario.register('reason')} maxLength={300} rows={3} placeholder="Descreva o motivo da recusa" data-autofocus />
        </Campo>
      </form>
    </Modal>
  );
}
