import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { FormNumber } from '../formControls';
import { Pencil, Plus, Target } from 'lucide-react';
import { applyServerErrors } from '@/api/forms';
import { useAdminChallenges, useSaveChallenge } from '@/api/queries';
import type { Challenge, ChallengeMetric } from '@/api/types';
import { Badge, Button, EmptyState, Field, FormError, IconButton, Input, Modal, Select, Switch, Textarea, toast } from '@/components/ui';
import { CategoryIcon } from '@/components/CategoryIcon';
import { cn } from '@/lib/cn';
import { formatDateShort, formatNumber, todayISODate } from '@/lib/format';
import { CATEGORY_CODES, categoryFallback } from '@/lib/labels';
import { AdminTable, type AdminColumn } from '../ui';

function phase(c: Challenge): { label: string; tone: 'success' | 'info' | 'neutral' } {
  const t = todayISODate();
  if (!c.active) return { label: 'Inativo', tone: 'neutral' };
  if (t < c.startsAt) return { label: 'Agendado', tone: 'info' };
  if (t > c.endsAt) return { label: 'Encerrado', tone: 'neutral' };
  return { label: 'Em andamento', tone: 'success' };
}

/ Aba do catálogo: desafios com prazo que dão pontos bônus aos moradores.
export function ChallengesTab() {
  const q = useAdminChallenges();
  const [editing, setEditing] = useState<Challenge | 'new' | null>(null);
  const columns: AdminColumn<Challenge>[] = [
    {
      key: 'title', header: 'Desafio', mobile: 'title', sort: (c) => c.title,
      cell: (c) => (
        <span className="flex items-center gap-3">
          {c.categoryCode ? <CategoryIcon code={c.categoryCode} size="sm" /> : <span className="inline-flex size-8 items-center justify-center rounded-xl border border-line text-subtle"><Target className="size-4" aria-hidden /></span>}
          <span className="min-w-0">
            <span className="block font-medium text-fg">{c.title}</span>
            <span className="block text-xs text-muted">{c.categoryCode ? categoryFallback[c.categoryCode].name : 'Qualquer material'}</span>
          </span>
        </span>
      ),
    },
    { key: 'phase', header: 'Situação', mobile: 'aside', sort: (c) => phase(c).label, cell: (c) => { const p = phase(c); return <Badge tone={p.tone} dot>{p.label}</Badge>; } },
    { key: 'period', header: 'Período', sort: (c) => c.startsAt, cell: (c) => <span className="font-mono text-[12.5px] tabular">{formatDateShort(c.startsAt)} → {formatDateShort(c.endsAt)}</span> },
    { key: 'target', header: 'Meta', align: 'right', sort: (c) => c.target, cell: (c) => <span className="font-mono tabular">{formatNumber(c.target, 1)} {c.metric === 'KG' ? 'kg' : 'descartes'}</span> },
    { key: 'bonus', header: 'Bônus', align: 'right', sort: (c) => c.bonusPoints, cell: (c) => <span className="font-mono tabular">+{formatNumber(c.bonusPoints)} pts</span> },
    { key: 'act', header: <span className="sr-only">Ações</span>, align: 'right', mobile: 'row', cell: (c) => <IconButton icon={Pencil} size="sm" label={`Editar ${c.title}`} onClick={() => setEditing(c)} /> },
  ];
  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-[13.5px] text-muted">Metas com prazo que dão pontos-bônus a quem completar.</p>
        <Button size="sm" variant="secondary" leftIcon={Plus} onClick={() => setEditing('new')}>Novo desafio</Button>
      </div>
      <AdminTable caption="Desafios" columns={columns} rows={q.data} rowKey={(c) => c.id} loading={q.isPending} error={q.error} onRetry={q.refetch}
        rowClassName={(c) => cn(!c.active && 'opacity-60')}
        empty={<EmptyState compact icon={Target} title="Nenhum desafio" description="Crie um desafio para engajar os moradores." />} />
      {editing && <ChallengeForm key={editing === 'new' ? 'new' : editing.id} challenge={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </>
  );
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const schema = z.object({
  title: z.string().trim().min(3, 'Mínimo de 3 caracteres').max(100, 'Máximo de 100 caracteres'),
  description: z.string().trim().max(500, 'Máximo de 500 caracteres'),
  categoryCode: z.string(),
  metric: z.enum(['KG', 'COUNT']),
  target: z.number({ invalid_type_error: 'Informe a meta', required_error: 'Informe a meta' }).min(0.1, 'Mínimo de 0,1').max(100_000),
  bonusPoints: z.number({ invalid_type_error: 'Informe o bônus', required_error: 'Informe o bônus' }).int('Use um número inteiro').min(0).max(100_000),
  startsAt: z.string().regex(DATE, 'Escolha a data de início'),
  endsAt: z.string().regex(DATE, 'Escolha a data de fim'),
  active: z.boolean(),
}).superRefine((v, ctx) => {
  if (DATE.test(v.startsAt) && DATE.test(v.endsAt) && v.endsAt < v.startsAt) ctx.addIssue({ code: 'custom', path: ['endsAt'], message: 'O fim deve ser depois do início' });
  if (v.metric === 'COUNT' && !Number.isInteger(v.target)) ctx.addIssue({ code: 'custom', path: ['target'], message: 'Para descartes, use um número inteiro' });
});
type Values = z.infer<typeof schema>;

function ChallengeForm({ challenge, onClose }: { challenge: Challenge | null; onClose: () => void }) {
  const save = useSaveChallenge();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: challenge
      ? { title: challenge.title, description: challenge.description, categoryCode: challenge.categoryCode ?? '', metric: challenge.metric, target: challenge.target, bonusPoints: challenge.bonusPoints, startsAt: challenge.startsAt, endsAt: challenge.endsAt, active: challenge.active }
      : { title: '', description: '', categoryCode: '', metric: 'KG', target: undefined, bonusPoints: 100, startsAt: todayISODate(), endsAt: '', active: true },
  });
  const { errors, isSubmitting } = form.formState;
  const metric = form.watch('metric') as ChallengeMetric;
  const submit = form.handleSubmit(async (v) => {
    try {
      const saved = await save.mutateAsync({
        id: challenge?.id,
        body: { ...v, title: v.title.trim(), description: v.description.trim(), categoryCode: (v.categoryCode || null) as Challenge['categoryCode'], metric: v.metric },
      });
      toast.success(challenge ? `“${saved.title}” atualizado.` : `“${saved.title}” criado.`);
      onClose();
    } catch (e) { applyServerErrors(e, form.setError); }
  });
  return (
    <Modal open onClose={onClose} size="lg" closeOnBackdrop={false} title={challenge ? 'Editar desafio' : 'Novo desafio'}
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button type="submit" form="ch-form" loading={isSubmitting}>Salvar desafio</Button></>}>
      <form id="ch-form" noValidate onSubmit={submit} className="space-y-4">
        <FormError error={errors.root?.server} />
        <Field label="Título" required error={errors.title}><Input {...form.register('title')} maxLength={100} placeholder="Mês do vidro" /></Field>
        <Field label="Descrição" optional error={errors.description}><Textarea {...form.register('description')} maxLength={500} rows={2} /></Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Material" error={errors.categoryCode}>
            <Select {...form.register('categoryCode')} options={[{ value: '', label: 'Qualquer material' }, ...CATEGORY_CODES.map((c) => ({ value: c, label: categoryFallback[c].name }))]} />
          </Field>
          <Field label="Medida" required error={errors.metric}>
            <Select {...form.register('metric')} options={[{ value: 'KG', label: 'Quilos reciclados' }, { value: 'COUNT', label: 'Número de descartes' }]} />
          </Field>
          <Field label="Meta" required error={errors.target}>
            <FormNumber control={form.control} name="target" decimals={metric === 'KG' ? 1 : 0} min={0.1} max={100_000} unit={metric === 'KG' ? 'kg' : 'desc.'} />
          </Field>
          <Field label="Bônus" required error={errors.bonusPoints}>
            <FormNumber control={form.control} name="bonusPoints" decimals={0} min={0} max={100_000} unit="pts" />
          </Field>
          <Field label="Início" required error={errors.startsAt}><Input type="date" {...form.register('startsAt')} className="[color-scheme:dark]" /></Field>
          <Field label="Fim" required error={errors.endsAt}><Input type="date" {...form.register('endsAt')} min={form.watch('startsAt') || undefined} className="[color-scheme:dark]" /></Field>
        </div>
        <Controller control={form.control} name="active" render={({ field }) => <Switch checked={field.value} onChange={field.onChange} label="Ativo" />} />
      </form>
    </Modal>
  );
}
