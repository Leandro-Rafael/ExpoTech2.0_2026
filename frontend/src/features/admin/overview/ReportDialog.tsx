import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Download } from 'lucide-react';
import { apiAdmin } from '@/api/admin';
import { salvarArquivo } from '@/api/client';
import { aplicarErrosDoServidor } from '@/api/forms';
import { Botao, Campo, ErroFormulario, CampoTexto, Modal, toast } from '@/components/ui';
import { dataHojeISO } from '@/lib/format';

const DATA = /^\d{4}-\d{2}-\d{2}$/;
const diasEntre = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
function dataDiasAtras(dias: number) {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const esquema = z.object({
  from: z.string().regex(DATA, 'Escolha a data inicial'),
  to: z.string().regex(DATA, 'Escolha a data final'),
}).superRefine((v, ctx) => {
  if (!DATA.test(v.from) || !DATA.test(v.to)) return;
  if (v.from > v.to) ctx.addIssue({ code: 'custom', path: ['from'], message: 'A data inicial deve ser anterior à final' });
  else if (diasEntre(v.from, v.to) > 366) ctx.addIssue({ code: 'custom', path: ['to'], message: 'O período máximo é de 366 dias' });
  if (v.to > dataHojeISO()) ctx.addIssue({ code: 'custom', path: ['to'], message: 'A data final não pode estar no futuro' });
});
type Valores = z.infer<typeof esquema>;

const PERIODOS = [{ label: '7 dias', days: 7 }, { label: '30 dias', days: 30 }, { label: '90 dias', days: 90 }, { label: '12 meses', days: 365 }];

/** Exporta o CSV de descartes (separador ";" e UTF-8 com BOM — abre direto no Excel). */
export function DialogoRelatorio({ open, onClose }: { open: boolean; onClose: () => void }) {
  const formulario = useForm<Valores>({ resolver: zodResolver(esquema), defaultValues: { from: dataDiasAtras(30), to: dataHojeISO() } });
  const { errors: erros, isSubmitting: enviando } = formulario.formState;
  const [de, ate] = formulario.watch(['from', 'to']);

  return (
    <Modal open={open} onClose={onClose} size="sm" title="Relatório de descartes" description="Arquivo CSV com usuário, categoria, peso, status, pontos e risco de fraude."
      rodape={<><Botao variant="ghost" onClick={onClose}>Cancelar</Botao><Botao type="submit" form="report-form" iconeEsquerda={Download} carregando={enviando}>Baixar CSV</Botao></>}>
      <form id="report-form" noValidate className="space-y-4" onSubmit={formulario.handleSubmit(async (v) => {
        try {
          const { blob, filename: nomeArquivo } = await apiAdmin.descartesCsv({ from: v.from, to: v.to });
          salvarArquivo(blob, nomeArquivo ?? `descartes_${v.from}_${v.to}.csv`);
          toast.success('Relatório gerado.');
          onClose();
        } catch (e) { aplicarErrosDoServidor(e, formulario.setError); }
      })}>
        <ErroFormulario erro={erros.root?.server} />
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Períodos rápidos">
          {PERIODOS.map((p) => {
            const ativo = de === dataDiasAtras(p.days) && ate === dataHojeISO();
            return (
              <button key={p.days} type="button" aria-pressed={ativo}
                onClick={() => { formulario.setValue('from', dataDiasAtras(p.days), { shouldValidate: true }); formulario.setValue('to', dataHojeISO(), { shouldValidate: true }); }}
                className={ativo ? 'h-8 rounded-lg border border-line-strong bg-surface-3 px-3 text-[13px] text-fg' : 'h-8 rounded-lg border border-line px-3 text-[13px] text-muted hover:text-fg-soft'}>
                Últimos {p.label}
              </button>
            );
          })}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Campo label="De" required erro={erros.from}><CampoTexto type="date" max={dataHojeISO()} {...formulario.register('from')} className="[color-scheme:dark]" /></Campo>
          <Campo label="Até" required erro={erros.to}><CampoTexto type="date" max={dataHojeISO()} {...formulario.register('to')} className="[color-scheme:dark]" /></Campo>
        </div>
      </form>
    </Modal>
  );
}
