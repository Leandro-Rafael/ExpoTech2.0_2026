import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CalendarCheck } from 'lucide-react';
import { applyServerErrors } from '@/api/forms';
import { useAdminCollectors, useCreateRoutes } from '@/api/queries';
import type { GeoPoint, Route } from '@/api/types';
import { Button, Field, FormError, Input, Select, toast } from '@/components/ui';
import { formatDate, todayISODate } from '@/lib/format';

const schema = z.object({
  name: z.string().trim().min(3, 'Mínimo de 3 caracteres').max(80, 'Máximo de 80 caracteres'),
  plannedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Escolha a data').refine((d) => d >= todayISODate(), 'A data não pode estar no passado'),
  collectorId: z.string(),
});
type Values = z.infer<typeof schema>;

interface Props {
  requestIds: string[];
  depot: GeoPoint;
  capacityKg: number;
  trips: number;
  disabled?: boolean;
  onCreated: (routes: Route[]) => void;
}

/** Transforma a otimização em rotas reais (uma por viagem), atribuídas a um coletor. */
export function CreateRoutesForm({ requestIds, depot, capacityKg, trips, disabled, onCreated }: Props) {
  const collectors = useAdminCollectors();
  const create = useCreateRoutes();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: `Coleta ${formatDate(todayISODate()).replace(/ de /g, ' ')}`, plannedDate: todayISODate(), collectorId: '' },
  });
  const { errors, isSubmitting } = form.formState;

  return (
    <form noValidate className="surface rounded-2xl p-5 sm:p-6"
      onSubmit={form.handleSubmit(async (v) => {
        try {
          const routes = await create.mutateAsync({
            name: v.name.trim(), plannedDate: v.plannedDate, collectorId: v.collectorId || null, requestIds, depot, vehicleCapacityKg: capacityKg,
          });
          toast.success(routes.length > 1 ? `${routes.length} rotas criadas e agendadas.` : 'Rota criada e agendada.');
          onCreated(routes);
        } catch (e) { applyServerErrors(e, form.setError, { knownFields: ['name', 'plannedDate', 'collectorId'] }); }
      })}>
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-[15px] font-semibold text-fg">Criar {trips > 1 ? `${trips} rotas` : 'rota'}</h3>
          <p className="mt-0.5 text-[13px] text-muted">As solicitações passam para “Agendada” e aparecem para o coletor.{trips > 1 && ' Cada viagem vira uma rota numerada.'}</p>
        </div>
      </div>
      <FormError error={errors.root?.server} className="mb-4" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome" required error={errors.name} className="sm:col-span-2">
          <Input {...form.register('name')} maxLength={80} />
        </Field>
        <Field label="Data" required error={errors.plannedDate}>
          <Input type="date" min={todayISODate()} {...form.register('plannedDate')} className="[color-scheme:dark]" />
        </Field>
        <Field label="Coletor" optional error={errors.collectorId} hint={collectors.isError ? 'Não foi possível carregar os coletores' : undefined}>
          <Select {...form.register('collectorId')} placeholder="Sem atribuição"
            options={(collectors.data ?? []).map((c) => ({ value: c.id, label: c.name }))} />
        </Field>
      </div>
      <div className="mt-5 flex justify-end">
        <Button type="submit" leftIcon={CalendarCheck} loading={isSubmitting} disabled={disabled}>
          Criar {trips > 1 ? `${trips} rotas` : 'rota'}
        </Button>
      </div>
    </form>
  );
}
