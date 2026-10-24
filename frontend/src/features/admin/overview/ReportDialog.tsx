import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Download } from 'lucide-react';
import { adminApi } from '@/api/admin';
import { saveBlob } from '@/api/client';
import { applyServerErrors } from '@/api/forms';
import { Button, Field, FormError, Input, Modal, toast } from '@/components/ui';
import { todayISODate } from '@/lib/format';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
function shift(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const schema = z.object({
  from: z.string().regex(DATE, 'Escolha a data inicial'),
  to: z.string().regex(DATE, 'Escolha a data final'),
}).superRefine((v, ctx) => {
  if (!DATE.test(v.from) || !DATE.test(v.to)) return;
  if (v.from > v.to) ctx.addIssue({ code: 'custom', path: ['from'], message: 'A data inicial deve ser anterior à final' });
  else if (daysBetween(v.from, v.to) > 366) ctx.addIssue({ code: 'custom', path: ['to'], message: 'O período máximo é de 366 dias' });
  if (v.to > todayISODate()) ctx.addIssue({ code: 'custom', path: ['to'], message: 'A data final não pode estar no futuro' });
});
type Values = z.infer<typeof schema>;

const PRESETS = [{ label: '7 dias', days: 7 }, { label: '30 dias', days: 30 }, { label: '90 dias', days: 90 }, { label: '12 meses', days: 365 }];

/** Exporta o CSV de descartes (separador ";" e UTF-8 com BOM — abre direto no Excel). */
export function ReportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { from: shift(30), to: todayISODate() } });
  const { errors, isSubmitting } = form.formState;
  const [from, to] = form.watch(['from', 'to']);

  return (
    <Modal open={open} onClose={onClose} size="sm" title="Relatório de descartes" description="Arquivo CSV com usuário, categoria, peso, status, pontos e risco de fraude."
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button type="submit" form="report-form" leftIcon={Download} loading={isSubmitting}>Baixar CSV</Button></>}>
      <form id="report-form" noValidate className="space-y-4" onSubmit={form.handleSubmit(async (v) => {
        try {
          const { blob, filename } = await adminApi.disposalsCsv({ from: v.from, to: v.to });
          saveBlob(blob, filename ?? `descartes_${v.from}_${v.to}.csv`);
          toast.success('Relatório gerado.');
          onClose();
        } catch (e) { applyServerErrors(e, form.setError); }
      })}>
        <FormError error={errors.root?.server} />
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Períodos rápidos">
          {PRESETS.map((p) => {
            const active = from === shift(p.days) && to === todayISODate();
            return (
              <button key={p.days} type="button" aria-pressed={active}
                onClick={() => { form.setValue('from', shift(p.days), { shouldValidate: true }); form.setValue('to', todayISODate(), { shouldValidate: true }); }}
                className={active ? 'h-8 rounded-lg border border-line-strong bg-surface-3 px-3 text-[13px] text-fg' : 'h-8 rounded-lg border border-line px-3 text-[13px] text-muted hover:text-fg-soft'}>
                Últimos {p.label}
              </button>
            );
          })}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="De" required error={errors.from}><Input type="date" max={todayISODate()} {...form.register('from')} className="[color-scheme:dark]" /></Field>
          <Field label="Até" required error={errors.to}><Input type="date" max={todayISODate()} {...form.register('to')} className="[color-scheme:dark]" /></Field>
        </div>
      </form>
    </Modal>
  );
}
