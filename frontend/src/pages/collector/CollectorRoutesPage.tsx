import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Check, CheckCircle2, Clock, Crosshair, Navigation, Play, Truck } from 'lucide-react';
import { applyServerErrors } from '@/api/forms';
import { errorMessage } from '@/api/client';
import { useCollectorRoutes, useCompleteStop, useStartRoute } from '@/api/queries';
import type { Route, RouteStop } from '@/api/types';
import { Button, Drawer, buttonClasses, EmptyState, ErrorState, Field, FormError, NumberInput, PageHeader, ProgressBar, Skeleton, StatusPill, toast } from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatDate, formatDateShort, formatDistanceKm, formatKg, formatMinutes, formatNumber, todayISODate } from '@/lib/format';
import { routeStatus } from '@/lib/labels';
import { useGeolocation } from '@/hooks/useGeolocation';
import { RouteMap } from '@/features/admin/routing/RouteMap';
import { googleMapsDir } from '@/features/admin/routing/shared';

const sortStops = (r: Route) => [...r.stops].sort((a, b) => a.sequence - b.sequence);

function pickDefault(routes: Route[]): string | null {
  return (routes.find((r) => r.status === 'IN_PROGRESS') ?? routes.find((r) => r.status === 'PLANNED') ?? routes[0])?.id ?? null;
}

export default function CollectorRoutesPage() {
  const q = useCollectorRoutes();
  const [activeId, setActiveId] = useState<string | null>(null);
  const routes = q.data ?? [];
  const route = routes.find((r) => r.id === activeId) ?? routes.find((r) => r.id === pickDefault(routes)) ?? null;

  return (
    <>
      <PageHeader eyebrow="Coletor" title="Minhas rotas" description="Siga as paradas na ordem otimizada e registre o peso coletado em cada endereço." />
      {q.error && !q.data ? <ErrorState error={q.error} onRetry={q.refetch} />
        : q.isPending ? (
          <div className="space-y-4" role="status" aria-label="Carregando rotas">
            <div className="flex gap-2">{Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-20 w-56 rounded-xl" />)}</div>
            <Skeleton className="h-[44vh] rounded-2xl" />
          </div>
        ) : !routes.length ? (
          <div className="surface rounded-2xl"><EmptyState icon={Truck} title="Nenhuma rota atribuída" description="Quando a administração criar uma rota para você, ela aparece aqui com o mapa e as paradas." /></div>
        ) : (
          <>
            <RoutePicker routes={routes} activeId={route?.id ?? null} onPick={setActiveId} />
            {route && <RouteView key={route.id} route={route} />}
          </>
        )}
    </>
  );
}

function RoutePicker({ routes, activeId, onPick }: { routes: Route[]; activeId: string | null; onPick: (id: string) => void }) {
  return (
    <div role="tablist" aria-label="Rotas" className="-mx-4 mb-5 flex snap-x gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0">
      {routes.map((r) => {
        const done = r.stops.filter((s) => s.status === 'DONE').length;
        const active = r.id === activeId;
        const today = r.plannedDate === todayISODate();
        return (
          <button key={r.id} type="button" role="tab" aria-selected={active} onClick={() => onPick(r.id)}
            className={cn('w-60 shrink-0 snap-start rounded-xl border p-3 text-left transition-colors',
              active ? 'border-line-strong bg-surface-2' : 'border-line bg-surface/60 hover:border-line-strong', r.status === 'DONE' && !active && 'opacity-60')}>
            <span className="flex items-center justify-between gap-2">
              <span className="font-mono text-[11px] text-subtle uppercase tabular">{today ? 'Hoje' : formatDateShort(r.plannedDate)}</span>
              <StatusPill map={routeStatus} value={r.status} pulse={r.status === 'IN_PROGRESS'} className="h-5 px-2 text-[11px]" />
            </span>
            <span className="mt-1.5 block truncate text-[14px] font-medium text-fg">{r.name}</span>
            <span className="mt-2 flex items-center gap-2">
              <ProgressBar value={done / Math.max(1, r.stops.length)} size="xs" valueLabel={null} />
              <span className="shrink-0 font-mono text-[11px] text-muted tabular">{done}/{r.stops.length}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function RouteView({ route }: { route: Route }) {
  const start = useStartRoute();
  const geo = useGeolocation();
  const [completing, setCompleting] = useState<RouteStop | null>(null);
  const [focusStop, setFocusStop] = useState<string | null>(null);
  const stops = useMemo(() => sortStops(route), [route]);
  const next = stops.find((s) => s.status === 'PENDING') ?? null;
  const done = stops.filter((s) => s.status === 'DONE');
  const doneKg = done.reduce((s, x) => s + x.estimatedKg, 0);
  const progress = done.length / Math.max(1, stops.length);
  const inProgress = route.status === 'IN_PROGRESS';
  const position = geo.latitude != null && geo.longitude != null ? [geo.latitude, geo.longitude] as [number, number] : null;

  // Pede a localização só quando a rota está em andamento (permissão sob demanda).
  const { status: geoStatus, request: geoRequest } = geo;
  useEffect(() => { if (inProgress && geoStatus === 'idle') geoRequest(); }, [inProgress, geoStatus, geoRequest]);

  const onStart = () => start.mutate(route.id, {
    onSuccess: () => { toast.success('Rota iniciada. Boa coleta!'); geo.request(); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] [&>*]:min-w-0">
      <div className="space-y-4 lg:order-2">
        {/* Resumo */}
        <section aria-label="Resumo da rota" className="surface rounded-2xl p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="font-sans text-lg font-semibold tracking-tight text-fg">{route.name}</h2>
              <p className="mt-0.5 text-[13px] text-muted">{formatDate(route.plannedDate)}</p>
            </div>
            <StatusPill map={routeStatus} value={route.status} pulse={inProgress} />
          </div>
          <div className="mt-4">
            <ProgressBar value={progress} label={`${done.length} de ${stops.length} paradas`} valueLabel={formatKg(doneKg) + ' coletados'} size="sm" />
          </div>
          <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-line pt-3.5">
            <div><dt className="text-[11px] tracking-[0.06em] text-subtle uppercase">Distância</dt><dd className="mt-0.5 font-mono text-[14px] text-fg tabular">{formatDistanceKm(route.totalDistanceKm)}</dd></div>
            <div><dt className="text-[11px] tracking-[0.06em] text-subtle uppercase">Tempo</dt><dd className="mt-0.5 font-mono text-[14px] text-fg tabular">{formatMinutes(route.estimatedMinutes)}</dd></div>
            <div><dt className="text-[11px] tracking-[0.06em] text-subtle uppercase">Carga</dt><dd className="mt-0.5 font-mono text-[14px] text-fg tabular">{formatKg(route.loadKg)}</dd></div>
          </dl>
          {route.status === 'PLANNED' && (
            <Button size="lg" fullWidth leftIcon={Play} className="mt-4" loading={start.isPending} onClick={onStart}>Iniciar rota</Button>
          )}
          {route.status === 'DONE' && (
            <p className="mt-4 flex items-center gap-2 text-[13.5px] text-success"><CheckCircle2 className="size-4" aria-hidden /> Rota concluída. Obrigado!</p>
          )}
        </section>

        {/* Próxima parada */}
        {inProgress && next && (
          <section aria-label="Próxima parada" className="rounded-2xl border border-brand-300/30 bg-brand-500/[0.06] p-4 sm:p-5">
            <p className="label-mono text-brand-300">Próxima parada · {next.sequence} de {stops.length}</p>
            <p className="mt-2 text-[16px] leading-snug font-medium text-fg">{next.address}</p>
            <p className="mt-1 text-[13px] text-muted"><span className="font-mono tabular">{formatKg(next.estimatedKg)}</span> estimados</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <a href={googleMapsDir(next)} target="_blank" rel="noopener noreferrer"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-line-strong text-[15px] font-medium text-fg hover:bg-white/[0.04]">
                <Navigation className="size-[18px]" aria-hidden /> Navegar
              </a>
              <Button size="lg" leftIcon={Check} onClick={() => setCompleting(next)}>Concluir</Button>
            </div>
          </section>
        )}
      </div>

      {/* Mapa */}
      <div className="relative lg:order-1">
        <RouteMap route={route} position={position} activeStopId={focusStop ?? next?.id} onStopClick={setFocusStop}
          className="h-[46vh] min-h-[300px] rounded-2xl border border-line lg:sticky lg:top-[calc(var(--header-h)+16px)] lg:h-[620px]" />
        {inProgress && geo.status !== 'success' && (
          <button type="button" onClick={geo.request}
            className="absolute top-3 right-3 z-[500] inline-flex h-9 items-center gap-1.5 rounded-lg border border-line-strong bg-[#0a0e0c]/90 px-3 text-[12.5px] text-fg-soft">
            <Crosshair className="size-4" aria-hidden /> {geo.status === 'loading' ? 'Localizando…' : 'Minha posição'}
          </button>
        )}
      </div>

      {/* Paradas */}
      <section aria-labelledby="stops-title" className="lg:order-3 lg:col-span-2">
        <h3 id="stops-title" className="label-mono mb-2.5">Paradas</h3>
        <ol className="surface divide-y divide-line overflow-hidden rounded-2xl">
          {stops.map((s) => {
            const isDone = s.status === 'DONE';
            const isNext = inProgress && s.id === next?.id;
            return (
              <li key={s.id} className={cn('flex items-center gap-3 px-4 py-3', isNext && 'bg-white/[0.03]')}
                onMouseEnter={() => setFocusStop(s.id)} onMouseLeave={() => setFocusStop(null)}>
                <span className={cn('inline-flex size-8 shrink-0 items-center justify-center rounded-full border font-mono text-[12px] font-semibold tabular',
                  isDone ? 'border-line text-subtle' : isNext ? 'border-transparent bg-brand-300 text-bg' : 'border-brand-300/50 text-brand-300')}>
                  {isDone ? <Check className="size-4" aria-label="Concluída" /> : s.sequence}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={cn('truncate text-[14px]', isDone ? 'text-muted' : 'text-fg')}>{s.address}</p>
                  <p className="mt-0.5 flex items-center gap-2 text-xs text-muted">
                    <span className="font-mono tabular">{formatKg(s.estimatedKg)}</span>
                    {isDone && s.completedAt && <span className="inline-flex items-center gap-1"><Clock className="size-3" aria-hidden />{new Date(s.completedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>}
                  </p>
                </div>
                {!isDone && (
                  <div className="flex shrink-0 items-center gap-1">
                    <a href={googleMapsDir(s)} target="_blank" rel="noopener noreferrer" aria-label={`Navegar até ${s.address}`}
                      className={buttonClasses({ variant: 'ghost', size: 'sm' })}>
                      <Navigation aria-hidden /><span className="max-sm:hidden">Navegar</span>
                    </a>
                    {inProgress && !isNext && (
                      <Button variant="secondary" size="sm" onClick={() => setCompleting(s)} aria-label={`Concluir parada ${s.sequence}`}>Concluir</Button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </section>

      <CompleteStopDrawer route={route} stop={completing} onClose={() => setCompleting(null)} />
    </div>
  );
}

const schema = z.object({
  collectedKg: z.number({ invalid_type_error: 'Informe o peso coletado', required_error: 'Informe o peso coletado' }).min(0, 'Não pode ser negativo').max(5000, 'Máximo de 5.000 kg'),
});
type Values = z.infer<typeof schema>;

function CompleteStopDrawer({ route, stop, onClose }: { route: Route; stop: RouteStop | null; onClose: () => void }) {
  const complete = useCompleteStop();
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { collectedKg: undefined } });
  useEffect(() => { if (stop) form.reset({ collectedKg: stop.estimatedKg }); }, [stop, form]);
  const { errors, isSubmitting } = form.formState;
  const remaining = route.stops.filter((s) => s.status === 'PENDING').length;

  return (
    <Drawer open={!!stop} onClose={onClose} side="bottom" title={stop ? `Concluir parada ${stop.sequence}` : undefined} description={stop?.address}
      className="sm:mx-auto sm:max-w-lg sm:rounded-3xl sm:border sm:bottom-4">
      <form noValidate className="space-y-4 pt-2" onSubmit={form.handleSubmit(async (v) => {
        try {
          const r = await complete.mutateAsync({ routeId: route.id, stopId: stop!.id, collectedKg: v.collectedKg });
          toast.success(r.status === 'DONE' ? 'Última parada concluída. Rota finalizada!' : `Parada concluída · ${formatNumber(v.collectedKg, 2)} kg`);
          onClose();
        } catch (e) { applyServerErrors(e, form.setError); }
      })}>
        <FormError error={errors.root?.server} />
        <Field label="Peso coletado" required error={errors.collectedKg} hint={stop ? `Estimado: ${formatKg(stop.estimatedKg)}` : undefined}>
          <Controller control={form.control} name="collectedKg"
            render={({ field }) => <NumberInput {...field} unit="kg" decimals={2} min={0} max={5000} step={0.5} stepper inputSize="lg" data-autofocus />} />
        </Field>
        <div className="grid grid-cols-2 gap-2 pb-1">
          <Button variant="ghost" size="lg" onClick={onClose}>Cancelar</Button>
          <Button type="submit" size="lg" leftIcon={Check} loading={isSubmitting}>{remaining <= 1 ? 'Finalizar rota' : 'Concluir'}</Button>
        </div>
      </form>
    </Drawer>
  );
}
