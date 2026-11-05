import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CalendarDays, Cpu, Crosshair, LocateFixed, Truck, X } from 'lucide-react';
import { applyServerErrors, errorMessage } from '@/api';
import { useCancelCollectionRequest, useCategories, useCreateCollectionRequest, useMyCollectionRequests } from '@/api/queries';
import type { CategoryCode, CollectionRequest } from '@/api/types';
import { LocationPicker } from '@/components/map';
import {
  Button, ConfirmDialog, EmptyState, ErrorState, Field, FormError, Input, NumberInput, SkeletonText, StatusPill, Textarea, toast,
} from '@/components/ui';
import { useGeolocation } from '@/hooks/useGeolocation';
import { cn } from '@/lib/cn';
import { categoryColor, hexAlpha } from '@/lib/category';
import { formatDate, formatKg, formatNumber, formatRelative, todayISODate } from '@/lib/format';
import { categoryFallback, CATEGORY_CODES, collectionRequestStatus, collectionSource } from '@/lib/labels';

function addDays(iso: string, n: number) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

const schema = z.object({
  address: z.string().trim().min(5, 'Informe o endereço (mín. 5 caracteres)').max(200, 'Máximo de 200 caracteres'),
  latitude: z.number({ invalid_type_error: 'Marque o local no mapa', required_error: 'Marque o local no mapa' }).min(-90).max(90),
  longitude: z.number({ invalid_type_error: 'Marque o local no mapa', required_error: 'Marque o local no mapa' }).min(-180).max(180),
  categoryCodes: z.array(z.string()).min(1, 'Escolha ao menos um material'),
  estimatedKg: z.number({ invalid_type_error: 'Informe o peso estimado', required_error: 'Informe o peso estimado' }).min(0.5, 'Mínimo de 0,5 kg').max(2000, 'Máximo de 2.000 kg'),
  preferredDate: z.string().optional(),
  notes: z.string().max(500, 'Máximo de 500 caracteres').optional(),
}).refine((v) => !v.preferredDate || (v.preferredDate >= todayISODate() && v.preferredDate <= addDays(todayISODate(), 60)), {
  path: ['preferredDate'], message: 'Escolha uma data entre hoje e os próximos 60 dias',
});
type Values = z.infer<typeof schema>;

/ Pedido de coleta em casa (volumes grandes). Esses pedidos entram no planejamento de rotas do admin.
export function RequestForm({ onCreated }: { onCreated: () => void }) {
  const categories = useCategories();
  const create = useCreateCollectionRequest();
  const geo = useGeolocation();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { address: '', latitude: undefined, longitude: undefined, categoryCodes: [], estimatedKg: undefined, preferredDate: '', notes: '' },
  });
  const { register, control, handleSubmit, setValue, setError, watch, reset, formState: { errors, isSubmitting } } = form;
  const lat = watch('latitude');
  const lon = watch('longitude');
  const codes = watch('categoryCodes');

  useEffect(() => {
    if (geo.status === 'success' && geo.latitude != null && geo.longitude != null) {
      setValue('latitude', Math.round(geo.latitude * 1e6) / 1e6, { shouldValidate: true });
      setValue('longitude', Math.round(geo.longitude * 1e6) / 1e6, { shouldValidate: true });
    }
  }, [geo.status, geo.latitude, geo.longitude, setValue]);

  const toggle = (c: CategoryCode) => setValue('categoryCodes', codes.includes(c) ? codes.filter((x) => x !== c) : [...codes, c], { shouldValidate: true });

  const onSubmit = handleSubmit(async (v) => {
    try {
      await create.mutateAsync({
        address: v.address, latitude: v.latitude, longitude: v.longitude, categoryCodes: v.categoryCodes as CategoryCode[],
        estimatedKg: Number(v.estimatedKg.toFixed(2)), preferredDate: v.preferredDate || null, notes: v.notes?.trim() || null,
      });
      toast.success('Coleta solicitada! Acompanhe o status em “Minhas solicitações”.');
      reset();
      onCreated();
    } catch (e) { applyServerErrors(e, setError, { knownFields: ['address', 'latitude', 'longitude', 'categoryCodes', 'estimatedKg', 'preferredDate', 'notes'] }); }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-12">
      <div className="space-y-5">
        <p className="text-sm leading-relaxed text-muted">Para volumes grandes ou materiais que não cabem na coleta comum (móveis, eletrônicos, entulho reciclável). A coleta entra na rota otimizada do coletor mais próximo.</p>
        <FormError error={errors.root?.server} />
        <Field label="Endereço da coleta" required error={errors.address}>
          <Input {...register('address')} autoComplete="street-address" placeholder="Rua, número, complemento" />
        </Field>
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-fg-soft">Materiais <span className="text-danger">*</span></legend>
          <div className="flex flex-wrap gap-1.5" role="group" aria-invalid={errors.categoryCodes ? true : undefined}>
            {CATEGORY_CODES.map((code) => {
              const c = categories.data?.find((x) => x.code === code);
              const on = codes.includes(code);
              const color = categoryColor(code, c?.color);
              return (
                <button key={code} type="button" aria-pressed={on} onClick={() => toggle(code)}
                  className={cn('inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm transition-colors', on ? 'border-transparent text-fg' : 'border-line text-muted hover:border-line-strong hover:text-fg')}
                  style={on ? { backgroundColor: hexAlpha(color, 0.12), boxShadow: `inset 0 0 0 1px ${hexAlpha(color, 0.5)}` } : undefined}>
                  <span aria-hidden className="size-2 rounded-full" style={{ backgroundColor: color }} />{c?.name ?? categoryFallback[code].name}
                </button>
              );
            })}
          </div>
          {errors.categoryCodes && <p role="alert" className="mt-2 text-sm text-danger">{errors.categoryCodes.message}</p>}
        </fieldset>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field label="Peso estimado" required error={errors.estimatedKg} hint="De 0,5 a 2.000 kg">
            {(a11y) => <Controller control={control} name="estimatedKg" render={({ field }) => (
              <NumberInput {...field} {...a11y} value={field.value} unit="kg" decimals={1} min={0.5} max={2000} step={1} invalid={!!errors.estimatedKg} />
            )} />}
          </Field>
          <Field label="Data preferida" optional error={errors.preferredDate} hint="Até 60 dias">
            <Input type="date" leftIcon={CalendarDays} min={todayISODate()} max={addDays(todayISODate(), 60)} {...register('preferredDate')} />
          </Field>
        </div>
        <Field label="Observações" optional error={errors.notes}>
          <Textarea rows={3} maxLength={500} placeholder="Ex.: portão azul, interfone 12" {...register('notes')} />
        </Field>
        <Button type="submit" size="lg" leftIcon={Truck} loading={isSubmitting}>Solicitar coleta</Button>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium text-fg-soft">Local exato <span className="text-danger">*</span></p>
          <Button size="sm" variant="ghost" leftIcon={geo.status === 'loading' ? Crosshair : LocateFixed} loading={geo.status === 'loading'} onClick={geo.request}>Usar minha localização</Button>
        </div>
        <LocationPicker className="h-[340px] lg:h-[460px]" invalid={!!errors.latitude}
          value={lat != null && lon != null ? { latitude: lat, longitude: lon } : null}
          onChange={(p) => { setValue('latitude', p.latitude, { shouldValidate: true }); setValue('longitude', p.longitude, { shouldValidate: true }); }} />
        <p className={cn('text-xs', errors.latitude ? 'text-danger' : 'text-subtle')} aria-live="polite">
          {errors.latitude?.message ?? (lat != null && lon != null ? <span className="font-mono tabular">{formatNumber(lat, 5)}, {formatNumber(lon!, 5)}</span> : 'Toque no mapa ou arraste o pino para marcar o portão.')}
        </p>
        {geo.status === 'error' && <p className="text-xs text-warning">{geo.error}</p>}
      </div>
    </form>
  );
}

export function MyRequests({ onNew }: { onNew: () => void }) {
  const q = useMyCollectionRequests();
  const cancel = useCancelCollectionRequest();
  const [target, setTarget] = useState<CollectionRequest | null>(null);
  if (q.isPending) return <SkeletonText lines={6} />;
  if (q.error) return <ErrorState error={q.error} onRetry={q.refetch} />;
  if (q.data.length === 0) {
    return <EmptyState icon={Truck} title="Nenhuma coleta solicitada" description="Peça uma coleta em casa para volumes grandes. Lixeiras inteligentes também pedem coletas sozinhas e aparecem aqui."
      action={<Button variant="secondary" onClick={onNew}>Solicitar coleta</Button>} />;
  }
  const list = [...q.data].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return (
    <>
      <ul className="divide-y divide-line border-y border-line">
        {list.map((r) => {
          const cancellable = r.status === 'REQUESTED' || r.status === 'SCHEDULED';
          return (
            <li key={r.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-medium text-fg">{r.address}</p>
                  {r.source === 'SMART_BIN' && <span className="inline-flex items-center gap-1 text-xs text-subtle"><Cpu className="size-3.5" aria-hidden />{collectionSource.SMART_BIN.label}{r.smartBin ? ` · ${r.smartBin.name}` : ''}</span>}
                </div>
                <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-subtle">
                  <span className="inline-flex items-center gap-1">{r.categoryCodes.map((c) => <span key={c} aria-hidden className="size-2 rounded-full" style={{ backgroundColor: categoryColor(c) }} />)}
                    <span className="ml-1">{r.categoryCodes.map((c) => categoryFallback[c].name).join(', ')}</span></span>
                  <span className="font-mono tabular">{formatKg(r.estimatedKg)}</span>
                  <span>{r.scheduledFor ? `agendada para ${formatDate(r.scheduledFor)}` : r.preferredDate ? `preferência ${formatDate(r.preferredDate)}` : `pedida ${formatRelative(r.createdAt)}`}</span>
                </p>
              </div>
              <div className="flex items-center gap-2 sm:justify-end">
                <StatusPill map={collectionRequestStatus} value={r.status} pulse={r.status === 'IN_ROUTE'} />
                {cancellable && <Button size="sm" variant="ghost" leftIcon={X} onClick={() => setTarget(r)}>Cancelar</Button>}
              </div>
            </li>
          );
        })}
      </ul>
      <ConfirmDialog open={!!target} onClose={() => setTarget(null)} tone="danger" loading={cancel.isPending}
        title="Cancelar esta coleta?" description="A solicitação sai da fila do coletor. Você pode pedir de novo quando quiser."
        confirmLabel="Cancelar coleta" cancelLabel="Manter"
        onConfirm={() => target && cancel.mutate(target.id, {
          onSuccess: () => { toast.success('Coleta cancelada'); setTarget(null); },
          onError: (e) => { toast.error(errorMessage(e)); setTarget(null); },
        })} />
    </>
  );
}
