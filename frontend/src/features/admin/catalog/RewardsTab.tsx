import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Gift, Pencil, Plus } from 'lucide-react';
import { applyServerErrors } from '@/api/forms';
import { useAdminRewards, useSaveReward } from '@/api/queries';
import type { Reward } from '@/api/types';
import { Badge, Button, EmptyState, Field, FormError, IconButton, Input, Modal, Switch, Textarea, toast } from '@/components/ui';
import { iconByName } from '@/components/icons';
import { cn } from '@/lib/cn';
import { formatNumber } from '@/lib/format';
import { AdminTable, type AdminColumn } from '../ui';
import { IconPicker, FormNumber } from '../formControls';

/ Aba do catálogo: recompensas que os moradores trocam por pontos (custo, estoque, parceiro).
export function RewardsTab() {
  const q = useAdminRewards();
  const [editing, setEditing] = useState<Reward | 'new' | null>(null);

  const columns: AdminColumn<Reward>[] = [
    {
      key: 'name', header: 'Recompensa', mobile: 'title', sort: (r) => r.name,
      cell: (r) => {
        const Icon = iconByName(r.icon, Gift);
        return (
          <span className="flex items-center gap-3">
            <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-line bg-surface-2 text-fg-soft"><Icon className="size-4" aria-hidden /></span>
            <span className="min-w-0">
              <span className="block font-medium text-fg">{r.name}</span>
              <span className="block truncate text-xs text-muted">{r.partner ?? 'Sem parceiro'}</span>
            </span>
          </span>
        );
      },
    },
    { key: 'status', header: 'Situação', mobile: 'aside', sort: (r) => Number(r.active), cell: (r) => r.active ? <Badge tone="success" dot>Ativa</Badge> : <Badge dot>Inativa</Badge> },
    { key: 'cost', header: 'Custo', align: 'right', sort: (r) => r.costPoints, cell: (r) => <span className="font-mono tabular">{formatNumber(r.costPoints)} pts</span> },
    {
      key: 'stock', header: 'Estoque', align: 'right', sort: (r) => r.stock,
      cell: (r) => <span className={cn('font-mono tabular', r.stock === 0 ? 'text-danger' : r.stock < 10 ? 'text-warning' : '')}>{r.stock === 0 ? 'Esgotado' : formatNumber(r.stock)}</span>,
    },
    { key: 'act', header: <span className="sr-only">Ações</span>, align: 'right', mobile: 'row', cell: (r) => <IconButton icon={Pencil} size="sm" label={`Editar ${r.name}`} onClick={() => setEditing(r)} /> },
  ];

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-[13.5px] text-muted">Itens que os moradores trocam por pontos. Inativas não aparecem no catálogo.</p>
        <Button size="sm" variant="secondary" leftIcon={Plus} onClick={() => setEditing('new')}>Nova recompensa</Button>
      </div>
      <AdminTable caption="Recompensas" columns={columns} rows={q.data} rowKey={(r) => r.id} loading={q.isPending} error={q.error} onRetry={q.refetch}
        defaultSort={{ key: 'cost', dir: 'asc' }} rowClassName={(r) => cn(!r.active && 'opacity-60')}
        empty={<EmptyState compact icon={Gift} title="Nenhuma recompensa" description="Cadastre a primeira recompensa do catálogo." />} />
      {editing && <RewardForm key={editing === 'new' ? 'new' : editing.id} reward={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </>
  );
}

const schema = z.object({
  name: z.string().trim().min(2, 'Mínimo de 2 caracteres').max(80, 'Máximo de 80 caracteres'),
  description: z.string().trim().max(500, 'Máximo de 500 caracteres'),
  costPoints: z.number({ invalid_type_error: 'Informe o custo', required_error: 'Informe o custo' }).int('Use um número inteiro').min(1, 'Mínimo de 1 ponto').max(1_000_000),
  stock: z.number({ invalid_type_error: 'Informe o estoque', required_error: 'Informe o estoque' }).int('Use um número inteiro').min(0).max(1_000_000),
  icon: z.string().min(1, 'Escolha um ícone'),
  partner: z.string().trim().max(120, 'Máximo de 120 caracteres'),
  active: z.boolean(),
});
type Values = z.infer<typeof schema>;

function RewardForm({ reward, onClose }: { reward: Reward | null; onClose: () => void }) {
  const save = useSaveReward();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: reward
      ? { name: reward.name, description: reward.description, costPoints: reward.costPoints, stock: reward.stock, icon: reward.icon, partner: reward.partner ?? '', active: reward.active }
      : { name: '', description: '', costPoints: undefined, stock: undefined, icon: 'gift', partner: '', active: true },
  });
  const { errors, isSubmitting } = form.formState;
  const submit = form.handleSubmit(async (v) => {
    try {
      const saved = await save.mutateAsync({ id: reward?.id, body: { ...v, name: v.name.trim(), description: v.description.trim(), partner: v.partner.trim() || null } });
      toast.success(reward ? `“${saved.name}” atualizada.` : `“${saved.name}” criada.`);
      onClose();
    } catch (e) { applyServerErrors(e, form.setError); }
  });
  return (
    <Modal open onClose={onClose} size="lg" closeOnBackdrop={false} title={reward ? 'Editar recompensa' : 'Nova recompensa'}
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button type="submit" form="reward-form" loading={isSubmitting}>Salvar recompensa</Button></>}>
      <form id="reward-form" noValidate onSubmit={submit} className="space-y-4">
        <FormError error={errors.root?.server} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nome" required error={errors.name}><Input {...form.register('name')} maxLength={80} /></Field>
          <Field label="Parceiro" optional error={errors.partner}><Input {...form.register('partner')} maxLength={120} /></Field>
        </div>
        <Field label="Descrição" optional error={errors.description}><Textarea {...form.register('description')} maxLength={500} rows={2} /></Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Custo" required error={errors.costPoints}>
            <FormNumber control={form.control} name="costPoints" decimals={0} min={1} max={1_000_000} unit="pts" />
          </Field>
          <Field label="Estoque" required error={errors.stock} hint="0 = esgotado">
            <FormNumber control={form.control} name="stock" decimals={0} min={0} max={1_000_000} stepper />
          </Field>
        </div>
        <Field label="Ícone" required error={errors.icon}>
          {(a11y) => <Controller control={form.control} name="icon" render={({ field }) => <IconPicker {...a11y} value={field.value} onChange={field.onChange} />} />}
        </Field>
        <Controller control={form.control} name="active" render={({ field }) => <Switch checked={field.value} onChange={field.onChange} label="Ativa" description="Disponível para resgate no catálogo." />} />
      </form>
    </Modal>
  );
}
