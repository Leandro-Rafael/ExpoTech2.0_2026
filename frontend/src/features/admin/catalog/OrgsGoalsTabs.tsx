import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { FormNumber } from '../formControls';
import { Building2, Flag, Pencil, Plus } from 'lucide-react';
import { applyServerErrors } from '@/api/forms';
import { useAdminGoals, useAdminOrganizations, useCreateOrganization, useSaveGoal } from '@/api/queries';
import type { Goal, Organization, OrganizationType } from '@/api/types';
import { Button, EmptyState, Field, FormError, IconButton, Input, Modal, Select, StatusPill, toast } from '@/components/ui';
import { formatKg, formatPercent } from '@/lib/format';
import { organizationType } from '@/lib/labels';
import { AdminTable, Meter, type AdminColumn } from '../ui';

// ------------------------------------------------------------------ Organizações

export function OrganizationsTab() {
  const q = useAdminOrganizations();
  const [open, setOpen] = useState(false);
  const columns: AdminColumn<Organization>[] = [
    { key: 'name', header: 'Organização', mobile: 'title', sort: (o) => o.name, cell: (o) => <span className="font-medium text-fg">{o.name}</span> },
    { key: 'type', header: 'Tipo', mobile: 'aside', sort: (o) => o.type, cell: (o) => <StatusPill map={organizationType} value={o.type} /> },
  ];
  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-[13.5px] text-muted">Turmas, escolas, empresas e condomínios que competem no ranking.</p>
        <Button size="sm" variant="secondary" leftIcon={Plus} onClick={() => setOpen(true)}>Nova organização</Button>
      </div>
      <AdminTable caption="Organizações" columns={columns} rows={q.data} rowKey={(o) => o.id} loading={q.isPending} error={q.error} onRetry={q.refetch}
        defaultSort={{ key: 'name', dir: 'asc' }}
        empty={<EmptyState compact icon={Building2} title="Nenhuma organização" />} />
      {open && <OrgForm onClose={() => setOpen(false)} />}
    </>
  );
}

const orgSchema = z.object({
  name: z.string().trim().min(2, 'Mínimo de 2 caracteres').max(120, 'Máximo de 120 caracteres'),
  type: z.enum(['TURMA', 'EMPRESA', 'CONDOMINIO', 'ESCOLA']),
});

function OrgForm({ onClose }: { onClose: () => void }) {
  const create = useCreateOrganization();
  const form = useForm<z.infer<typeof orgSchema>>({ resolver: zodResolver(orgSchema), defaultValues: { name: '', type: 'TURMA' } });
  const { errors, isSubmitting } = form.formState;
  return (
    <Modal open onClose={onClose} size="sm" title="Nova organização"
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button type="submit" form="org-form" loading={isSubmitting}>Criar</Button></>}>
      <form id="org-form" noValidate className="space-y-4" onSubmit={form.handleSubmit(async (v) => {
        try { const o = await create.mutateAsync({ name: v.name.trim(), type: v.type }); toast.success(`“${o.name}” criada.`); onClose(); }
        catch (e) { applyServerErrors(e, form.setError); }
      })}>
        <FormError error={errors.root?.server} />
        <Field label="Nome" required error={errors.name}><Input {...form.register('name')} maxLength={120} placeholder="3º semestre — ADS" data-autofocus /></Field>
        <Field label="Tipo" required error={errors.type}>
          <Select {...form.register('type')} options={(Object.keys(organizationType) as OrganizationType[]).map((t) => ({ value: t, label: organizationType[t].label }))} />
        </Field>
      </form>
    </Modal>
  );
}

// ------------------------------------------------------------------ Metas

export function GoalsTab() {
  const q = useAdminGoals();
  const [editing, setEditing] = useState<Goal | 'new' | null>(null);
  const columns: AdminColumn<Goal>[] = [
    { key: 'year', header: 'Ano', mobile: 'aside', sort: (g) => g.year, cell: (g) => <span className="font-mono text-fg tabular">{g.year}</span> },
    { key: 'title', header: 'Meta', mobile: 'title', sort: (g) => g.title, cell: (g) => <span className="font-medium text-fg">{g.title}</span> },
    {
      key: 'rate', header: 'Taxa de reciclagem', sort: (g) => g.targetRecyclingRate,
      cell: (g) => <span className="font-mono tabular"><span className="text-fg">{formatPercent(g.currentRate, 1)}</span> <span className="text-subtle">/ {formatPercent(g.targetRecyclingRate)}</span></span>,
    },
    {
      key: 'kg', header: 'Volume', sort: (g) => g.targetKg,
      cell: (g) => <span className="font-mono tabular"><span className="text-fg">{formatKg(g.currentKg)}</span> <span className="text-subtle">/ {formatKg(g.targetKg)}</span></span>,
    },
    {
      key: 'progress', header: 'Progresso', sort: (g) => g.progress,
      cell: (g) => (
        <span className="flex min-w-32 items-center gap-2.5">
          <Meter value={g.progress} tone={g.progress >= 1 ? 'brand' : g.progress >= 0.5 ? 'brand' : 'warning'} label={`Progresso de ${g.title}`} />
          <span className="shrink-0 font-mono text-[12px] text-muted tabular">{formatPercent(g.progress)}</span>
        </span>
      ),
    },
    { key: 'act', header: <span className="sr-only">Ações</span>, align: 'right', mobile: 'row', cell: (g) => <IconButton icon={Pencil} size="sm" label={`Editar ${g.title}`} onClick={() => setEditing(g)} /> },
  ];
  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-[13.5px] text-muted">Metas anuais da cidade até 2050, acompanhadas no painel de impacto.</p>
        <Button size="sm" variant="secondary" leftIcon={Plus} onClick={() => setEditing('new')}>Nova meta</Button>
      </div>
      <AdminTable caption="Metas" columns={columns} rows={q.data} rowKey={(g) => g.id} loading={q.isPending} error={q.error} onRetry={q.refetch}
        defaultSort={{ key: 'year', dir: 'asc' }}
        empty={<EmptyState compact icon={Flag} title="Nenhuma meta" />} />
      {editing && <GoalForm key={editing === 'new' ? 'new' : editing.id} goal={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </>
  );
}

const goalSchema = z.object({
  year: z.number({ invalid_type_error: 'Informe o ano', required_error: 'Informe o ano' }).int('Ano inteiro').min(2024, 'A partir de 2024').max(2100, 'Até 2100'),
  title: z.string().trim().min(3, 'Mínimo de 3 caracteres').max(120, 'Máximo de 120 caracteres'),
  ratePct: z.number({ invalid_type_error: 'Informe a taxa', required_error: 'Informe a taxa' }).min(0).max(100, 'Máximo de 100%'),
  targetKg: z.number({ invalid_type_error: 'Informe o volume', required_error: 'Informe o volume' }).min(0).max(1_000_000_000),
});

function GoalForm({ goal, onClose }: { goal: Goal | null; onClose: () => void }) {
  const save = useSaveGoal();
  const form = useForm<z.infer<typeof goalSchema>>({
    resolver: zodResolver(goalSchema),
    defaultValues: goal
      ? { year: goal.year, title: goal.title, ratePct: Math.round(goal.targetRecyclingRate * 1000) / 10, targetKg: goal.targetKg }
      : { year: new Date().getFullYear() + 1, title: '', ratePct: undefined, targetKg: undefined },
  });
  const { errors, isSubmitting } = form.formState;
  return (
    <Modal open onClose={onClose} size="md" closeOnBackdrop={false} title={goal ? 'Editar meta' : 'Nova meta'}
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button type="submit" form="goal-form" loading={isSubmitting}>Salvar meta</Button></>}>
      <form id="goal-form" noValidate className="space-y-4" onSubmit={form.handleSubmit(async (v) => {
        try {
          const g = await save.mutateAsync({ id: goal?.id, body: { year: v.year, title: v.title.trim(), targetRecyclingRate: Math.round(v.ratePct * 10) / 1000, targetKg: v.targetKg } });
          toast.success(`Meta ${g.year} salva.`);
          onClose();
        } catch (e) { applyServerErrors(e, form.setError, { fieldMap: { targetRecyclingRate: 'ratePct' } }); }
      })}>
        <FormError error={errors.root?.server} />
        <div className="grid grid-cols-[120px_1fr] gap-3">
          <Field label="Ano" required error={errors.year}>
            <FormNumber control={form.control} name="year" decimals={0} min={2024} max={2100} />
          </Field>
          <Field label="Título" required error={errors.title}><Input {...form.register('title')} maxLength={120} placeholder="Reciclar metade do lixo" /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Taxa de reciclagem" required error={errors.ratePct}>
            <FormNumber control={form.control} name="ratePct" decimals={1} min={0} max={100} unit="%" />
          </Field>
          <Field label="Volume reciclado" required error={errors.targetKg}>
            <FormNumber control={form.control} name="targetKg" decimals={0} min={0} max={1_000_000_000} unit="kg" />
          </Field>
        </div>
      </form>
    </Modal>
  );
}
