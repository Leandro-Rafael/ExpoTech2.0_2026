import { useMemo, useState } from 'react';
import { Check, Route as RouteIcon } from 'lucide-react';
import { useAdminRoutes } from '@/api/queries';
import type { Route, RouteStatus } from '@/api/types';
import { Drawer, EmptyState, StatusPill } from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatDate, formatDistanceKm, formatKg, formatMinutes, formatNumber } from '@/lib/format';
import { routeStatus } from '@/lib/labels';
import { AdminTable, Detail, Meter, SearchField, Segmented, type AdminColumn } from '../ui';
import { RouteMap } from './RouteMap';

type Filter = RouteStatus | 'ALL';

export function RoutesTab({ highlight }: { highlight?: Set<string> }) {
  const routes = useAdminRoutes();
  const [filter, setFilter] = useState<Filter>('ALL');
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState<Route | null>(null);

  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: 0, PLANNED: 0, IN_PROGRESS: 0, DONE: 0 };
    routes.data?.forEach((r) => { c.ALL++; c[r.status]++; });
    return c;
  }, [routes.data]);

  const rows = useMemo(() => {
    const s = search.trim().toLocaleLowerCase('pt-BR');
    return routes.data?.filter((r) => (filter === 'ALL' || r.status === filter)
      && (!s || r.name.toLocaleLowerCase('pt-BR').includes(s) || r.collector?.name.toLocaleLowerCase('pt-BR').includes(s)));
  }, [routes.data, filter, search]);

  const columns: AdminColumn<Route>[] = [
    {
      key: 'name', header: 'Rota', mobile: 'title', sort: (r) => r.name,
      cell: (r) => (
        <span className="min-w-0">
          <span className="flex items-center gap-2 font-medium text-fg">{r.name}{highlight?.has(r.id) && <span className="text-[11px] font-normal text-success">nova</span>}</span>
          <span className="block text-xs text-muted">{r.collector?.name ?? 'Sem coletor'}</span>
        </span>
      ),
    },
    { key: 'status', header: 'Status', mobile: 'aside', sort: (r) => r.status, cell: (r) => <StatusPill map={routeStatus} value={r.status} pulse={r.status === 'IN_PROGRESS'} /> },
    { key: 'date', header: 'Data', sort: (r) => r.plannedDate, cell: (r) => <span className="font-mono text-[12.5px] tabular">{formatDate(r.plannedDate)}</span> },
    {
      key: 'progress', header: 'Paradas', sort: (r) => r.stops.filter((s) => s.status === 'DONE').length / Math.max(1, r.stops.length),
      cell: (r) => {
        const done = r.stops.filter((s) => s.status === 'DONE').length;
        return (
          <span className="flex min-w-28 items-center gap-2.5">
            <Meter value={done / Math.max(1, r.stops.length)} label={`${done} de ${r.stops.length} paradas`} />
            <span className="shrink-0 font-mono text-[12px] text-muted tabular">{done}/{r.stops.length}</span>
          </span>
        );
      },
    },
    {
      key: 'km', header: 'Distância', align: 'right', sort: (r) => r.totalDistanceKm,
      cell: (r) => {
        const save = r.naiveDistanceKm > 0 ? 1 - r.totalDistanceKm / r.naiveDistanceKm : 0;
        return (
          <span className="font-mono tabular">
            <span className="text-fg">{formatDistanceKm(r.totalDistanceKm)}</span>
            {save > 0.001 && <span className="block text-[11px] text-success">−{formatNumber(save * 100)}% vs. ingênua</span>}
          </span>
        );
      },
    },
    { key: 'time', header: 'Tempo', align: 'right', mobile: 'hidden', className: 'max-lg:hidden', sort: (r) => r.estimatedMinutes, cell: (r) => <span className="font-mono tabular">{formatMinutes(r.estimatedMinutes)}</span> },
    { key: 'load', header: 'Carga', align: 'right', sort: (r) => r.loadKg, cell: (r) => <span className="font-mono tabular">{formatKg(r.loadKg)}</span> },
  ];

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Segmented<Filter> label="Status da rota" value={filter} onChange={setFilter}
          options={[
            { value: 'ALL', label: 'Todas', count: counts.ALL },
            { value: 'PLANNED', label: 'Planejadas', count: counts.PLANNED },
            { value: 'IN_PROGRESS', label: 'Em andamento', count: counts.IN_PROGRESS },
            { value: 'DONE', label: 'Concluídas', count: counts.DONE },
          ]} />
        <SearchField value={search} onChange={setSearch} placeholder="Buscar rota ou coletor" className="w-full sm:w-72" />
      </div>
      <AdminTable
        caption="Rotas de coleta"
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        loading={routes.isPending}
        error={routes.error}
        onRetry={routes.refetch}
        onRowClick={setOpen}
        defaultSort={{ key: 'date', dir: 'desc' }}
        rowClassName={(r) => cn(highlight?.has(r.id) && 'bg-brand-500/[0.05]')}
        empty={<EmptyState compact icon={RouteIcon} title="Nenhuma rota" description="Selecione solicitações no planejamento e crie rotas otimizadas." />}
      />

      <Drawer open={!!open} onClose={() => setOpen(null)} title={open?.name} description={open ? `${formatDate(open.plannedDate)} · ${open.collector?.name ?? 'Sem coletor'}` : undefined} className="w-[min(560px,96vw)]">
        {open && (
          <div className="space-y-5">
            <RouteMap route={open} className="h-72 rounded-xl border border-line" />
            <dl className="grid grid-cols-3 gap-4">
              <Detail label="Distância" mono>{formatDistanceKm(open.totalDistanceKm)}</Detail>
              <Detail label="Ingênua" mono>{formatDistanceKm(open.naiveDistanceKm)}</Detail>
              <Detail label="Tempo" mono>{formatMinutes(open.estimatedMinutes)}</Detail>
              <Detail label="Carga" mono>{formatKg(open.loadKg)}</Detail>
              <Detail label="Status"><StatusPill map={routeStatus} value={open.status} /></Detail>
            </dl>
            <ol className="divide-y divide-line border-y border-line">
              {[...open.stops].sort((a, b) => a.sequence - b.sequence).map((s) => (
                <li key={s.id} className="flex items-center gap-3 py-2.5 text-[13px]">
                  <span className={cn('inline-flex size-6 shrink-0 items-center justify-center rounded-full border font-mono text-[11px] tabular',
                    s.status === 'DONE' ? 'border-line text-subtle' : 'border-brand-300/60 text-brand-300')}>
                    {s.status === 'DONE' ? <Check className="size-3" aria-label="Concluída" /> : s.sequence}
                  </span>
                  <span className={cn('min-w-0 flex-1 truncate', s.status === 'DONE' ? 'text-muted line-through decoration-line-strong' : 'text-fg-soft')}>{s.address}</span>
                  <span className="shrink-0 font-mono text-muted tabular">{formatKg(s.estimatedKg)}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </Drawer>
    </>
  );
}
