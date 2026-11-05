import { useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Clock, MapPinned, Pencil, Plus, Trash2 } from 'lucide-react';
import { applyServerErrors } from '@/api/forms';
import { errorMessage } from '@/api/client';
import { useAdminCollectionPoints, useCategories, useDeleteCollectionPoint, useSaveCollectionPoint } from '@/api/queries';
import type { CategoryCode, CollectionPoint } from '@/api/types';
import { Button, ConfirmDialog, EmptyState, ErrorState, Field, FormError, IconButton, Input, Modal, PageHeader, Skeleton, Switch, toast } from '@/components/ui';
import { DotMarker, LocationPicker, MapView, type LatLngTuple } from '@/components/map';
import { cn } from '@/lib/cn';
import { categoryFallback } from '@/lib/labels';
import { SearchField, Segmented } from '@/features/admin/ui';
import { CategoryCodesPicker, FormNumber } from '@/features/admin/formControls';

type ActiveFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';
const HOURS_PRESETS = ['Seg a sex, 8h às 17h', 'Seg a sáb, 8h às 18h', 'Todos os dias, 24 horas', 'Seg a sex, 7h às 19h; sáb, 8h às 12h'];

// Cadastro dos ecopontos que aparecem no mapa dos moradores.
export default function AdminCollectionPointsPage() {
  const points = useAdminCollectionPoints();
  const categories = useCategories();
  const del = useDeleteCollectionPoint();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<ActiveFilter>('ALL');
  const [cat, setCat] = useState<CategoryCode | 'ALL'>('ALL');
  const [editing, setEditing] = useState<CollectionPoint | 'new' | null>(null);
  const [removing, setRemoving] = useState<CollectionPoint | null>(null);
  const [focus, setFocus] = useState<string | null>(null);

  const colors = useMemo(() => Object.fromEntries((categories.data ?? []).map((c) => [c.code, c.color])) as Partial<Record<CategoryCode, string>>, [categories.data]);

  const rows = useMemo(() => {
    const s = search.trim().toLocaleLowerCase('pt-BR');
    return (points.data ?? []).filter((p) =>
      (filter === 'ALL' || (filter === 'ACTIVE' ? p.active : !p.active))
      && (cat === 'ALL' || p.categories.includes(cat))
      && (!s || [p.name, p.address, p.neighborhood].some((x) => x.toLocaleLowerCase('pt-BR').includes(s))),
    ).sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name, 'pt-BR'));
  }, [points.data, filter, cat, search]);

  const counts = useMemo(() => ({
    ALL: points.data?.length ?? 0, ACTIVE: points.data?.filter((p) => p.active).length ?? 0, INACTIVE: points.data?.filter((p) => !p.active).length ?? 0,
  }), [points.data]);

  const bounds = useMemo<LatLngTuple[]>(() => rows.map((p) => [p.latitude, p.longitude]), [rows]);

  const confirmDelete = () => {
    const p = removing!;
    del.mutate(p.id, {
      onSuccess: () => { toast.success(`Ecoponto “${p.name}” removido.`); setRemoving(null); },
      onError: (e) => toast.error(errorMessage(e)),
    });
  };

  return (
    <>
      <PageHeader
        eyebrow="Administração"
        title="Ecopontos"
        description="Pontos de entrega voluntária exibidos no mapa dos moradores: localização, materiais aceitos e horário."
        actions={<Button leftIcon={Plus} onClick={() => setEditing('new')}>Novo ecoponto</Button>}
      />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Segmented<ActiveFilter> label="Situação" value={filter} onChange={setFilter}
            options={[{ value: 'ALL', label: 'Todos', count: counts.ALL }, { value: 'ACTIVE', label: 'Ativos', count: counts.ACTIVE }, { value: 'INACTIVE', label: 'Inativos', count: counts.INACTIVE }]} />
          <select value={cat} onChange={(e) => setCat(e.target.value as CategoryCode | 'ALL')} aria-label="Filtrar por material"
            className="h-9 cursor-pointer rounded-[10px] border border-line bg-bg-deep/60 px-3 text-[13px] text-fg-soft focus:outline-none [&>option]:bg-surface">
            <option value="ALL">Todos os materiais</option>
            {Object.entries(categoryFallback).map(([c, m]) => <option key={c} value={c}>{m.name}</option>)}
          </select>
        </div>
        <SearchField value={search} onChange={setSearch} placeholder="Buscar nome, endereço ou bairro" className="w-full lg:w-80" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <section aria-label="Lista de ecopontos" className="surface min-w-0 overflow-hidden rounded-2xl lg:max-h-[640px] lg:overflow-y-auto" data-lenis-prevent>
          {points.error && !points.data ? <ErrorState error={points.error} onRetry={points.refetch} compact />
            : points.isPending ? (
              <div className="divide-y divide-line" role="status" aria-label="Carregando">
                {Array.from({ length: 6 }, (_, i) => <div key={i} className="space-y-2 p-4"><Skeleton className="h-4 w-1/2" /><Skeleton className="h-3 w-3/4" /></div>)}
              </div>
            ) : !rows.length ? (
              <EmptyState compact icon={MapPinned} title="Nenhum ecoponto" description={search || cat !== 'ALL' || filter !== 'ALL' ? 'Ajuste os filtros.' : 'Cadastre o primeiro ponto de entrega.'} />
            ) : (
              <ul className="divide-y divide-line/70">
                {rows.map((p) => (
                  <li key={p.id} onMouseEnter={() => setFocus(p.id)} onMouseLeave={() => setFocus(null)}
                    className={cn('group flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-white/[0.02]', !p.active && 'opacity-60')}>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2">
                        <span className="truncate text-[14px] font-medium text-fg">{p.name}</span>
                        {!p.active && <span className="rounded border border-line-strong px-1.5 text-[11px] text-muted">Inativo</span>}
                      </p>
                      <p className="mt-0.5 truncate text-[12.5px] text-muted">{p.address} · {p.neighborhood}</p>
                      <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-subtle">
                        <span className="inline-flex items-center gap-1"><Clock className="size-3" aria-hidden />{p.openingHours}</span>
                        <span className="inline-flex items-center gap-1" aria-label={`Aceita: ${p.categories.map((c) => categoryFallback[c].name).join(', ')}`}>
                          {p.categories.map((c) => <span key={c} title={categoryFallback[c].name} className="size-2 rounded-full" style={{ backgroundColor: colors[c] ?? categoryFallback[c].color }} />)}
                        </span>
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-0.5">
                      <IconButton icon={Pencil} size="sm" label={`Editar ${p.name}`} onClick={() => setEditing(p)} onFocus={() => setFocus(p.id)} />
                      <IconButton icon={Trash2} size="sm" variant="danger" label={`Excluir ${p.name}`} onClick={() => setRemoving(p)} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
        </section>

        <div className="min-w-0">
          <MapView className="h-[380px] rounded-2xl border border-line lg:sticky lg:top-[calc(var(--header-h)+16px)] lg:h-[640px]" bounds={bounds} ariaLabel="Mapa de ecopontos">
            {rows.map((p) => (
              <DotMarker key={p.id} position={[p.latitude, p.longitude]} color={p.active ? '#34d399' : '#7d8680'} selected={focus === p.id} size={13}
                label={p.name} tooltip={<span><b className="font-medium text-fg">{p.name}</b><br />{p.neighborhood}</span>} onClick={() => setEditing(p)} />
            ))}
          </MapView>
        </div>
      </div>

      <PointForm key={editing === 'new' ? 'new' : editing?.id ?? 'none'} point={editing} onClose={() => setEditing(null)} colors={colors}
        context={(points.data ?? []).filter((p) => editing === 'new' || p.id !== (editing as CollectionPoint | null)?.id).map((p) => [p.latitude, p.longitude] as LatLngTuple)} />

      <ConfirmDialog open={!!removing} onClose={() => setRemoving(null)} onConfirm={confirmDelete} loading={del.isPending} tone="danger"
        title="Excluir ecoponto?" confirmLabel="Excluir"
        description={`“${removing?.name}” deixa de aparecer no mapa dos moradores. Se houver descartes vinculados, ele é apenas desativado para preservar o histórico.`} />
    </>
  );
}

const schema = z.object({
  name: z.string().trim().min(3, 'Mínimo de 3 caracteres').max(120, 'Máximo de 120 caracteres'),
  address: z.string().trim().min(5, 'Mínimo de 5 caracteres').max(200, 'Máximo de 200 caracteres'),
  neighborhood: z.string().trim().min(2, 'Informe o bairro').max(80, 'Máximo de 80 caracteres'),
  latitude: z.number({ invalid_type_error: 'Informe a latitude', required_error: 'Informe a latitude' }).min(-90, 'Entre -90 e 90').max(90, 'Entre -90 e 90'),
  longitude: z.number({ invalid_type_error: 'Informe a longitude', required_error: 'Informe a longitude' }).min(-180, 'Entre -180 e 180').max(180, 'Entre -180 e 180'),
  openingHours: z.string().trim().min(3, 'Informe o horário').max(120, 'Máximo de 120 caracteres'),
  categories: z.array(z.enum(['PLASTICO', 'PAPEL', 'VIDRO', 'METAL', 'ORGANICO', 'ELETRONICO', 'REJEITO'])).min(1, 'Selecione ao menos um material'),
  active: z.boolean(),
});
type Values = z.infer<typeof schema>;

function PointForm({ point, onClose, colors, context }: {
  point: CollectionPoint | 'new' | null; onClose: () => void; colors: Partial<Record<CategoryCode, string>>; context: LatLngTuple[];
}) {
  const save = useSaveCollectionPoint();
  const existing = point && point !== 'new' ? point : null;
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: existing
      ? { name: existing.name, address: existing.address, neighborhood: existing.neighborhood, latitude: existing.latitude, longitude: existing.longitude, openingHours: existing.openingHours, categories: existing.categories, active: existing.active }
      : { name: '', address: '', neighborhood: '', latitude: undefined, longitude: undefined, openingHours: '', categories: [], active: true },
  });
  const { errors, isSubmitting } = form.formState;
  const lat = form.watch('latitude');
  const lon = form.watch('longitude');

  const submit = form.handleSubmit(async (v) => {
    try {
      const saved = await save.mutateAsync({ id: existing?.id, body: { ...v, name: v.name.trim(), address: v.address.trim(), neighborhood: v.neighborhood.trim(), openingHours: v.openingHours.trim() } });
      toast.success(existing ? `“${saved.name}” atualizado.` : `“${saved.name}” cadastrado.`);
      onClose();
    } catch (e) { applyServerErrors(e, form.setError); }
  });

  return (
    <Modal open={!!point} onClose={onClose} size="xl" closeOnBackdrop={false}
      title={existing ? 'Editar ecoponto' : 'Novo ecoponto'}
      description="Clique no mapa para posicionar o ponto; as coordenadas também podem ser digitadas."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" form="point-form" loading={isSubmitting}>{existing ? 'Salvar alterações' : 'Cadastrar ecoponto'}</Button>
        </>
      }>
      <form id="point-form" noValidate onSubmit={submit} className="grid gap-5 md:grid-cols-2">
        <div className="space-y-4">
          <FormError error={errors.root?.server} />
          <Field label="Nome" required error={errors.name}><Input {...form.register('name')} maxLength={120} placeholder="Ecoponto Jardim Maria Rosa" /></Field>
          <Field label="Endereço" required error={errors.address}><Input {...form.register('address')} maxLength={200} placeholder="Rua, número" /></Field>
          <Field label="Bairro" required error={errors.neighborhood}><Input {...form.register('neighborhood')} maxLength={80} /></Field>
          <Field label="Horário de funcionamento" required error={errors.openingHours}>
            <Input {...form.register('openingHours')} maxLength={120} list="hours-presets" placeholder="Seg a sex, 8h às 17h" />
          </Field>
          <datalist id="hours-presets">{HOURS_PRESETS.map((h) => <option key={h} value={h} />)}</datalist>
          <Field label="Materiais aceitos" required error={errors.categories?.message ?? errors.categories?.root?.message}>
            {(a11y) => (
              <Controller control={form.control} name="categories"
                render={({ field }) => <CategoryCodesPicker {...a11y} value={field.value} onChange={field.onChange} colors={colors} />} />
            )}
          </Field>
          <Controller control={form.control} name="active"
            render={({ field }) => <Switch checked={field.value} onChange={field.onChange} label="Ativo" description="Inativos não aparecem para os moradores." />} />
        </div>
        <div className="space-y-3">
          <LocationPicker
            className="h-72 md:h-[360px]"
            value={lat != null && lon != null ? { latitude: lat, longitude: lon } : null}
            invalid={!!(errors.latitude || errors.longitude)}
            context={context}
            onChange={(p) => {
              form.setValue('latitude', p.latitude, { shouldValidate: true, shouldDirty: true });
              form.setValue('longitude', p.longitude, { shouldValidate: true, shouldDirty: true });
            }}
          />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Latitude" required error={errors.latitude}>
              <FormNumber control={form.control} name="latitude" decimals={6} min={-90} max={90} step={0.001} allowNegative inputSize="sm" />
            </Field>
            <Field label="Longitude" required error={errors.longitude}>
              <FormNumber control={form.control} name="longitude" decimals={6} min={-180} max={180} step={0.001} allowNegative inputSize="sm" />
            </Field>
          </div>
        </div>
      </form>
    </Modal>
  );
}
