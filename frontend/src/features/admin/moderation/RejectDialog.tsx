import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { Disposal } from '@/api/types';
import { Button, Field, Modal, Textarea } from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatKg } from '@/lib/format';

export const REJECT_PRESETS = [
  'A foto não corresponde ao material declarado.',
  'Foto duplicada ou reaproveitada de outro envio.',
  'Quantidade incompatível com o que aparece na foto.',
  'Material contaminado ou não reciclável nesta categoria.',
  'Sem comprovação suficiente para validar o descarte.',
];

const schema = z.object({
  reason: z.string().trim().min(3, 'Informe o motivo da recusa (mín. 3 caracteres)').max(300, 'Máximo de 300 caracteres'),
});
type Values = z.infer<typeof schema>;

/** Recusa com motivo obrigatório (atalhos de motivo + texto livre). */
export function RejectDialog({ disposal, onClose, onConfirm }: {
  disposal: Disposal | null; onClose: () => void; onConfirm: (reason: string) => void;
}) {
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { reason: '' } });
  useEffect(() => { if (disposal) form.reset({ reason: '' }); }, [disposal, form]);
  const reason = form.watch('reason');

  return (
    <Modal
      open={!!disposal}
      onClose={onClose}
      title="Recusar descarte"
      description={disposal ? `${disposal.category.name} · ${formatKg(disposal.quantityKg)} de ${disposal.user?.name ?? 'usuário'}. O morador verá o motivo.` : undefined}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button variant="danger" type="submit" form="reject-form">Recusar descarte</Button>
        </>
      }
    >
      <form id="reject-form" noValidate onSubmit={form.handleSubmit((v) => onConfirm(v.reason.trim()))} className="space-y-4">
        <fieldset>
          <legend className="mb-2 text-[13px] font-medium text-fg-soft">Motivos frequentes</legend>
          <div className="flex flex-col gap-1.5">
            {REJECT_PRESETS.map((p) => {
              const active = reason === p;
              return (
                <button key={p} type="button" aria-pressed={active}
                  onClick={() => form.setValue('reason', p, { shouldValidate: true })}
                  className={cn('rounded-lg border px-3 py-2 text-left text-[13px] transition-colors',
                    active ? 'border-line-strong bg-surface-3 text-fg' : 'border-line text-muted hover:border-line-strong hover:text-fg-soft')}>
                  {p}
                </button>
              );
            })}
          </div>
        </fieldset>
        <Field label="Motivo" required error={form.formState.errors.reason} hint="Escreva com clareza: o morador recebe esta mensagem.">
          <Textarea {...form.register('reason')} maxLength={300} rows={3} placeholder="Descreva o motivo da recusa" data-autofocus />
        </Field>
      </form>
    </Modal>
  );
}
