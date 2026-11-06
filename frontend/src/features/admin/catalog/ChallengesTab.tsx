import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { FormNumber } from '../formControls';
import { Pencil, Plus, Target } from 'lucide-react';
import { aplicarErrosDoServidor } from '@/api/forms';
import { useDesafiosAdmin, useSalvarDesafio } from '@/api/queries';
import type { Challenge, ChallengeMetric } from '@/api/types';
import { Etiqueta, Botao, EstadoVazio, Campo, ErroFormulario, BotaoIcone, CampoTexto, Modal, Selecao, Interruptor, AreaTexto, toast } from '@/components/ui';
import { IconeCategoria } from '@/components/CategoryIcon';
import { cn } from '@/lib/cn';
import { formatarDataCurta, formatarNumero, dataHojeISO } from '@/lib/format';
import { CODIGOS_CATEGORIA, categoriaPadrao } from '@/lib/labels';
import { TabelaAdmin, type ColunaAdmin } from '../ui';

function fase(c: Challenge): { label: string; tone: 'success' | 'info' | 'neutral' } {
  const t = dataHojeISO();
  if (!c.active) return { label: 'Inativo', tone: 'neutral' };
  if (t < c.startsAt) return { label: 'Agendado', tone: 'info' };
  if (t > c.endsAt) return { label: 'Encerrado', tone: 'neutral' };
  return { label: 'Em andamento', tone: 'success' };
}

// Aba do catálogo: desafios com prazo que dão pontos bônus aos moradores.
export function AbaDesafios() {
  const q = useDesafiosAdmin();
  const [editando, setEditando] = useState<Challenge | 'new' | null>(null);
  const colunas: ColunaAdmin<Challenge>[] = [
    {
      key: 'title', cabecalho: 'Desafio', celular: 'title', ordenar: (c) => c.title,
      celula: (c) => (
        <span className="flex items-center gap-3">
          {c.categoryCode ? <IconeCategoria codigo={c.categoryCode} size="sm" /> : <span className="inline-flex size-8 items-center justify-center rounded-xl border border-line text-subtle"><Target className="size-4" aria-hidden /></span>}
          <span className="min-w-0">
            <span className="block font-medium text-fg">{c.title}</span>
            <span className="block text-xs text-muted">{c.categoryCode ? categoriaPadrao[c.categoryCode].name : 'Qualquer material'}</span>
          </span>
        </span>
      ),
    },
    { key: 'phase', cabecalho: 'Situação', celular: 'aside', ordenar: (c) => fase(c).label, celula: (c) => { const p = fase(c); return <Etiqueta tone={p.tone} ponto>{p.label}</Etiqueta>; } },
    { key: 'period', cabecalho: 'Período', ordenar: (c) => c.startsAt, celula: (c) => <span className="font-mono text-[12.5px] tabular">{formatarDataCurta(c.startsAt)} → {formatarDataCurta(c.endsAt)}</span> },
    { key: 'target', cabecalho: 'Meta', alinhamento: 'right', ordenar: (c) => c.target, celula: (c) => <span className="font-mono tabular">{formatarNumero(c.target, 1)} {c.metric === 'KG' ? 'kg' : 'descartes'}</span> },
    { key: 'bonus', cabecalho: 'Bônus', alinhamento: 'right', ordenar: (c) => c.bonusPoints, celula: (c) => <span className="font-mono tabular">+{formatarNumero(c.bonusPoints)} pts</span> },
    { key: 'act', cabecalho: <span className="sr-only">Ações</span>, alinhamento: 'right', celular: 'row', celula: (c) => <BotaoIcone icon={Pencil} size="sm" label={`Editar ${c.title}`} onClick={() => setEditando(c)} /> },
  ];
  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-[13.5px] text-muted">Metas com prazo que dão pontos-bônus a quem completar.</p>
        <Botao size="sm" variant="secondary" iconeEsquerda={Plus} onClick={() => setEditando('new')}>Novo desafio</Botao>
      </div>
      <TabelaAdmin legenda="Desafios" colunas={colunas} linhas={q.data} chaveLinha={(c) => c.id} carregando={q.isPending} erro={q.error} aoTentarDeNovo={q.refetch}
        classeLinha={(c) => cn(!c.active && 'opacity-60')}
        vazio={<EstadoVazio compacto icon={Target} title="Nenhum desafio" description="Crie um desafio para engajar os moradores." />} />
      {editando && <FormDesafio key={editando === 'new' ? 'new' : editando.id} desafio={editando === 'new' ? null : editando} onClose={() => setEditando(null)} />}
    </>
  );
}

const DATA = /^\d{4}-\d{2}-\d{2}$/;
const esquema = z.object({
  title: z.string().trim().min(3, 'Mínimo de 3 caracteres').max(100, 'Máximo de 100 caracteres'),
  description: z.string().trim().max(500, 'Máximo de 500 caracteres'),
  categoryCode: z.string(),
  metric: z.enum(['KG', 'COUNT']),
  target: z.number({ invalid_type_error: 'Informe a meta', required_error: 'Informe a meta' }).min(0.1, 'Mínimo de 0,1').max(100_000),
  bonusPoints: z.number({ invalid_type_error: 'Informe o bônus', required_error: 'Informe o bônus' }).int('Use um número inteiro').min(0).max(100_000),
  startsAt: z.string().regex(DATA, 'Escolha a data de início'),
  endsAt: z.string().regex(DATA, 'Escolha a data de fim'),
  active: z.boolean(),
}).superRefine((v, ctx) => {
  if (DATA.test(v.startsAt) && DATA.test(v.endsAt) && v.endsAt < v.startsAt) ctx.addIssue({ code: 'custom', path: ['endsAt'], message: 'O fim deve ser depois do início' });
  if (v.metric === 'COUNT' && !Number.isInteger(v.target)) ctx.addIssue({ code: 'custom', path: ['target'], message: 'Para descartes, use um número inteiro' });
});
type Valores = z.infer<typeof esquema>;

function FormDesafio({ desafio, onClose }: { desafio: Challenge | null; onClose: () => void }) {
  const salvar = useSalvarDesafio();
  const formulario = useForm<Valores>({
    resolver: zodResolver(esquema),
    defaultValues: desafio
      ? { title: desafio.title, description: desafio.description, categoryCode: desafio.categoryCode ?? '', metric: desafio.metric, target: desafio.target, bonusPoints: desafio.bonusPoints, startsAt: desafio.startsAt, endsAt: desafio.endsAt, active: desafio.active }
      : { title: '', description: '', categoryCode: '', metric: 'KG', target: undefined, bonusPoints: 100, startsAt: dataHojeISO(), endsAt: '', active: true },
  });
  const { errors: erros, isSubmitting: enviando } = formulario.formState;
  const metrica = formulario.watch('metric') as ChallengeMetric;
  const enviar = formulario.handleSubmit(async (v) => {
    try {
      const salvo = await salvar.mutateAsync({
        id: desafio?.id,
        body: { ...v, title: v.title.trim(), description: v.description.trim(), categoryCode: (v.categoryCode || null) as Challenge['categoryCode'], metric: v.metric },
      });
      toast.success(desafio ? `“${salvo.title}” atualizado.` : `“${salvo.title}” criado.`);
      onClose();
    } catch (e) { aplicarErrosDoServidor(e, formulario.setError); }
  });
  return (
    <Modal open onClose={onClose} size="lg" fecharAoClicarFora={false} title={desafio ? 'Editar desafio' : 'Novo desafio'}
      rodape={<><Botao variant="ghost" onClick={onClose}>Cancelar</Botao><Botao type="submit" form="ch-form" carregando={enviando}>Salvar desafio</Botao></>}>
      <form id="ch-form" noValidate onSubmit={enviar} className="space-y-4">
        <ErroFormulario erro={erros.root?.server} />
        <Campo label="Título" required erro={erros.title}><CampoTexto {...formulario.register('title')} maxLength={100} placeholder="Mês do vidro" /></Campo>
        <Campo label="Descrição" opcional erro={erros.description}><AreaTexto {...formulario.register('description')} maxLength={500} rows={2} /></Campo>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo label="Material" erro={erros.categoryCode}>
            <Selecao {...formulario.register('categoryCode')} opcoes={[{ value: '', label: 'Qualquer material' }, ...CODIGOS_CATEGORIA.map((c) => ({ value: c, label: categoriaPadrao[c].name }))]} />
          </Campo>
          <Campo label="Medida" required erro={erros.metric}>
            <Selecao {...formulario.register('metric')} opcoes={[{ value: 'KG', label: 'Quilos reciclados' }, { value: 'COUNT', label: 'Número de descartes' }]} />
          </Campo>
          <Campo label="Meta" required erro={erros.target}>
            <FormNumber control={formulario.control} name="target" casasDecimais={metrica === 'KG' ? 1 : 0} min={0.1} max={100_000} unidade={metrica === 'KG' ? 'kg' : 'desc.'} />
          </Campo>
          <Campo label="Bônus" required erro={erros.bonusPoints}>
            <FormNumber control={formulario.control} name="bonusPoints" casasDecimais={0} min={0} max={100_000} unidade="pts" />
          </Campo>
          <Campo label="Início" required erro={erros.startsAt}><CampoTexto type="date" {...formulario.register('startsAt')} className="[color-scheme:dark]" /></Campo>
          <Campo label="Fim" required erro={erros.endsAt}><CampoTexto type="date" {...formulario.register('endsAt')} min={formulario.watch('startsAt') || undefined} className="[color-scheme:dark]" /></Campo>
        </div>
        <Controller control={formulario.control} name="active" render={({ field }) => <Interruptor checked={field.value} onChange={field.onChange} label="Ativo" />} />
      </form>
    </Modal>
  );
}
