import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Pencil, Plus, Shapes } from 'lucide-react';
import { applyServerErrors } from '@/api/forms';
import { useCategories, useSaveCategory } from '@/api/queries';
import type { Category, CategoryCode } from '@/api/types';
import { Badge, Button, EmptyState, Field, FormError, IconButton, Input, Modal, NumberInput, Select, Switch, Textarea, Tooltip, toast } from '@/components/ui';
import { CategoryIcon } from '@/components/CategoryIcon';
import { cn } from '@/lib/cn';
import { formatNumber } from '@/lib/format';
import { CATEGORY_CODES, categoryFallback } from '@/lib/labels';
import { AdminTable, type AdminColumn } from '../ui';
import { ColorPicker, IconPicker, ListEditor } from '../formControls';

export function CategoriesTab() {
  const q = useCategories({ all: true });
  const [editing, setEditing] = useState<Category | 'new' | null>(null);
  const used = new Set(q.data?.map((c) => c.code));
  const free = CATEGORY_CODES.filter((c) => !used.has(c));

  const columns: AdminColumn<Category>[] = [
    {
      key: 'name', header: 'Categoria', mobile: 'title', sort: (c) => c.name,
      cell: (c) => (
        <span className="flex items-center gap-3">
          <CategoryIcon icon={c.icon} color={c.color} code={c.code} size="sm" />
          <span className="min-w-0">
            <span className="block font-medium text-fg">{c.name}</span>
            <span className="block font-mono text-[11px] text-subtle">{c.code}</span>
          </span>
        </span>
      ),
    },
    { key: 'status', header: 'Situação', mobile: 'aside', sort: (c) => Number(c.active), cell: (c) => c.active ? <Badge tone="success" dot>Ativa</Badge> : <Badge dot>Inativa</Badge> },
    { key: 'pts', header: 'Pontos/kg', align: 'right', sort: (c) => c.pointsPerKg, cell: (c) => <span className="font-mono tabular">{formatNumber(c.pointsPerKg)}</span> },
    { key: 'co2', header: 'CO₂/kg', align: 'right', sort: (c) => c.co2FactorKg, cell: (c) => <span className="font-mono tabular">{formatNumber(c.co2FactorKg, 2)} kg</span> },
    { key: 'max', header: 'Máx. por descarte', align: 'right', sort: (c) => c.maxKgPerDisposal, cell: (c) => <span className="font-mono tabular">{formatNumber(c.maxKgPerDisposal, 1)} kg</span> },
    { key: 'rec', header: 'Reciclável', sort: (c) => Number(c.recyclable), cell: (c) => <span className={c.recyclable ? 'text-fg-soft' : 'text-subtle'}>{c.recyclable ? 'Sim' : 'Não'}</span> },
    { key: 'guid', header: 'Orientações', align: 'right', mobile: 'hidden', cell: (c) => <span className="font-mono text-muted tabular">{c.guidance.length}</span> },
    { key: 'act', header: <span className="sr-only">Ações</span>, align: 'right', mobile: 'row', cell: (c) => <IconButton icon={Pencil} size="sm" label={`Editar ${c.name}`} onClick={() => setEditing(c)} /> },
  ];

  const newBtn = <Button size="sm" variant="secondary" leftIcon={Plus} disabled={!free.length} onClick={() => setEditing('new')}>Nova categoria</Button>;
  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-[13.5px] text-muted">Pontuação, fator de CO₂ e orientações de descarte de cada material.</p>
        {free.length ? newBtn : <Tooltip content="Todos os 7 códigos de material já têm categoria. Edite uma existente.">{newBtn}</Tooltip>}
      </div>
      <AdminTable caption="Categorias" columns={columns} rows={q.data} rowKey={(c) => c.id} loading={q.isPending} error={q.error} onRetry={q.refetch}
        rowClassName={(c) => cn(!c.active && 'opacity-60')}
        empty={<EmptyState compact icon={Shapes} title="Nenhuma categoria" />} />
      {editing && <CategoryForm key={editing === 'new' ? 'new' : editing.id} category={editing === 'new' ? null : editing} freeCodes={free} onClose={() => setEditing(null)} />}
    </>
  );
}

const schema = z.object({
  code: z.enum(['PLASTICO', 'PAPEL', 'VIDRO', 'METAL', 'ORGANICO', 'ELETRONICO', 'REJEITO'], { errorMap: () => ({ message: 'Escolha o código' }) }),
  name: z.string().trim().min(2, 'Mínimo de 2 caracteres').max(60, 'Máximo de 60 caracteres'),
  description: z.string().trim().max(500, 'Máximo de 500 caracteres'),
  guidance: z.array(z.string().trim().min(1).max(300)).max(12, 'Até 12 orientações'),
  pointsPerKg: z.number({ invalid_type_error: 'Informe os pontos', required_error: 'Informe os pontos' }).int('Use um número inteiro').min(0).max(1000, 'Máximo de 1.000'),
  co2FactorKg: z.number({ invalid_type_error: 'Informe o fator', required_error: 'Informe o fator' }).min(0).max(50, 'Máximo de 50'),
  maxKgPerDisposal: z.number({ invalid_type_error: 'Informe o limite', required_error: 'Informe o limite' }).min(0.1, 'Mínimo de 0,1 kg').max(1000, 'Máximo de 1.000 kg'),
  recyclable: z.boolean(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Use o formato #RRGGBB'),
  icon: z.string().min(1, 'Escolha um ícone').max(40),
  active: z.boolean(),
});
type Values = z.infer<typeof schema>;

function CategoryForm({ category, freeCodes, onClose }: { category: Category | null; freeCodes: CategoryCode[]; onClose: () => void }) {
  const save = useSaveCategory();
  const first = freeCodes[0] ?? 'PLASTICO';
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: category
      ? { code: category.code, name: category.name, description: category.description, guidance: category.guidance, pointsPerKg: category.pointsPerKg, co2FactorKg: category.co2FactorKg, maxKgPerDisposal: category.maxKgPerDisposal, recyclable: category.recyclable, color: category.color.toUpperCase(), icon: category.icon, active: category.active }
      : { code: first, name: categoryFallback[first].name, description: '', guidance: [], pointsPerKg: 10, co2FactorKg: 1, maxKgPerDisposal: 20, recyclable: true, color: categoryFallback[first].color.toUpperCase(), icon: categoryFallback[first].icon, active: true },
  });
  const { errors, isSubmitting } = form.formState;
  const [color, icon, name, code] = form.watch(['color', 'icon', 'name', 'code']);

  const submit = form.handleSubmit(async (v) => {
    try {
      const saved = await save.mutateAsync({ id: category?.id, body: { ...v, name: v.name.trim(), description: v.description.trim(), guidance: v.guidance.map((g) => g.trim()).filter(Boolean) } });
      toast.success(category ? `Categoria “${saved.name}” atualizada.` : `Categoria “${saved.name}” criada.`);
      onClose();
    } catch (e) { applyServerErrors(e, form.setError); }
  });

  return (
    <Modal open onClose={onClose} size="xl" closeOnBackdrop={false} title={category ? 'Editar categoria' : 'Nova categoria'}
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button type="submit" form="cat-form" loading={isSubmitting}>Salvar categoria</Button></>}>
      <form id="cat-form" noValidate onSubmit={submit} className="grid gap-x-6 gap-y-5 md:grid-cols-2">
        <FormError error={errors.root?.server} className="md:col-span-2" />
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-xl border border-line p-3">
            <CategoryIcon icon={icon} color={/^#[0-9a-f]{6}$/i.test(color) ? color : undefined} code={code} size="lg" />
            <div className="min-w-0">
              <p className="font-medium text-fg">{name || 'Sem nome'}</p>
              <p className="font-mono text-[11px] text-subtle">{code} · pré-visualização</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Código" required error={errors.code} hint={category ? 'Não pode ser alterado' : undefined}>
              <Select {...form.register('code')} disabled={!!category}
                options={(category ? [category.code] : freeCodes).map((c) => ({ value: c, label: `${c} · ${categoryFallback[c].name}` }))} />
            </Field>
            <Field label="Nome" required error={errors.name}><Input {...form.register('name')} maxLength={60} /></Field>
          </div>
          <Field label="Descrição" optional error={errors.description}><Textarea {...form.register('description')} maxLength={500} rows={2} /></Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Pontos por kg" required error={errors.pointsPerKg}>
              <Controller control={form.control} name="pointsPerKg" render={({ field }) => <NumberInput {...field} decimals={0} min={0} max={1000} />} />
            </Field>
            <Field label="CO₂ evitado/kg" required error={errors.co2FactorKg}>
              <Controller control={form.control} name="co2FactorKg" render={({ field }) => <NumberInput {...field} decimals={2} min={0} max={50} unit="kg" />} />
            </Field>
            <Field label="Máx. por descarte" required error={errors.maxKgPerDisposal}>
              <Controller control={form.control} name="maxKgPerDisposal" render={({ field }) => <NumberInput {...field} decimals={1} min={0.1} max={1000} unit="kg" />} />
            </Field>
          </div>
          <div className="flex flex-wrap gap-6">
            <Controller control={form.control} name="recyclable" render={({ field }) => <Switch checked={field.value} onChange={field.onChange} label="Reciclável" />} />
            <Controller control={form.control} name="active" render={({ field }) => <Switch checked={field.value} onChange={field.onChange} label="Ativa" description="Inativas somem do registro de descarte." />} />
          </div>
        </div>
        <div className="space-y-4">
          <Field label="Cor" required error={errors.color}>
            {(a11y) => <Controller control={form.control} name="color" render={({ field }) => <ColorPicker {...a11y} value={field.value} onChange={field.onChange} />} />}
          </Field>
          <Field label="Ícone" required error={errors.icon}>
            {(a11y) => <Controller control={form.control} name="icon" render={({ field }) => <IconPicker {...a11y} value={field.value} onChange={field.onChange} color={color} />} />}
          </Field>
          <Field label="Orientações de descarte" error={errors.guidance?.message ?? errors.guidance?.root?.message}>
            {(a11y) => <Controller control={form.control} name="guidance" render={({ field }) => <ListEditor {...a11y} value={field.value} onChange={field.onChange} placeholder="Ex.: Lave e seque as embalagens" />} />}
          </Field>
        </div>
      </form>
    </Modal>
  );
}
