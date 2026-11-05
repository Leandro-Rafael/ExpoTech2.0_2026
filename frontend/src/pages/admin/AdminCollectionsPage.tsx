// Planejamento de coletas (aba "Planejar") e lista de rotas criadas (aba "Rotas").
import { useEffect, useMemo, useState } from 'react';
import { Crosshair, Cpu, MapPinned, RotateCcw, Sparkles, User, Warehouse } from 'lucide-react';
import { errorMessage } from '@/api/client';
import { useAdminCollectionRequests, useCategories, useOptimizeRoutes } from '@/api/queries';
import type { CollectionRequest, CollectionRequestStatus, CollectionSource, GeoPoint, RouteOptimization } from '@/api/types';
import { useSetTab } from '@/components/layout/TabbedPage';
import { Button, EmptyState, ErrorState, NumberInput, PageHeader, Skeleton, StatusPill, toast } from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatKg, formatRelative } from '@/lib/format';
import { categoryFallback, collectionRequestStatus } from '@/lib/labels';
import { SearchField, Segmented } from '@/features/admin/ui';
import { CollectionsMap } from '@/features/admin/routing/CollectionsMap';
import { OptimizationResult } from '@/features/admin/routing/OptimizationResult';
import { CreateRoutesForm } from '@/features/admin/routing/CreateRoutesForm';
import { RoutesTab } from '@/features/admin/routing/RoutesTab';
import { DEFAULT_CAPACITY_KG, DEFAULT_DEPOT, priorityTone } from '@/features/admin/routing/shared';

type StatusFilter = CollectionRequestStatus | 'OPEN' | 'ALL';
type SourceFilter = CollectionSource | 'ALL';

const OPEN: CollectionRequestStatus[] = ['REQUESTED', 'SCHEDULED', 'IN_ROUTE'];

export default function AdminCollectionsPage({ tab }: { tab: 'plan' | 'routes' }) {
  const setTab = useSetTab();
  const [status, setStatus] = useState<StatusFilter>('REQUESTED');
  const [source, setSource] = useState<SourceFilter>('ALL');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [hovered, setHovered] = useState<string | null>(null);
  const [depot, setDepot] = useState<GeoPoint>(DEFAULT_DEPOT);
  const [capacity, setCapacity] = useState<number | null>(DEFAULT_CAPACITY_KG);
  const [pickingDepot, setPickingDepot] = useState(false);
  const [result, setResult] = useState<{ data: RouteOptimization; key: string; capacity: number } | null>(null);
  const [showNaive, setShowNaive] = useState(true);
  const [focused, setFocused] = useState<number | null>(null);
  const [created, setCreated] = useState<Set<string>>(new Set());

  // Busca todas e filtra no cliente (contagens por status sem várias requisições).
  const all = useAdminCollectionRequests();
  const categories = useCategories();
  const optimize = useOptimizeRoutes();

  const catColor = (code: keyof typeof categoryFallback) => categories.data?.find((c) => c.code === code)?.color ?? categoryFallback[code].color;

  const counts = useMemo(() => {
    const c: Record<string, number> = { REQUESTED: 0, OPEN: 0, ALL: 0, COLLECTED: 0 };
    all.data?.forEach((r) => { c.ALL++; c[r.status] = (c[r.status] ?? 0) + 1; if (OPEN.includes(r.status)) c.OPEN++; });
    return c;
  }, [all.data]);

  // 1. Lista as solicitações (de moradores ou de lixeiras cheias), das mais urgentes para as menos.
  const rows = useMemo(() => {
    const s = search.trim().toLocaleLowerCase('pt-BR');
    return (all.data ?? []).filter((r) =>
      (status === 'ALL' || (status === 'OPEN' ? OPEN.includes(r.status) : r.status === status))
      && (source === 'ALL' || r.source === source)
      && (!s || r.address.toLocaleLowerCase('pt-BR').includes(s) || r.requester?.name.toLocaleLowerCase('pt-BR').includes(s) || r.smartBin?.name.toLocaleLowerCase('pt-BR').includes(s)),
    ).sort((a, b) => b.priority - a.priority || a.createdAt.localeCompare(b.createdAt));
  }, [all.data, status, source, search]);

  // Seleção só de solicitações em aberto ("Solicitada"); limpa ids que sumiram.
  useEffect(() => {
    if (!all.data) return;
    const valid = new Set(all.data.filter((r) => r.status === 'REQUESTED').map((r) => r.id));
    setSelected((s) => { const n = new Set([...s].filter((id) => valid.has(id))); return n.size === s.size ? s : n; });
  }, [all.data]);

  // 2. O admin marca quais vai atender. Se mudar a seleção, a central ou a capacidade depois de otimizar,
  //    o resultado fica "desatualizado" (stale) e precisa otimizar de novo.
  const selectedReqs = useMemo(() => (all.data ?? []).filter((r) => selected.has(r.id)), [all.data, selected]);
  const selectedKg = selectedReqs.reduce((s, r) => s + r.estimatedKg, 0);
  const selectionKey = `${[...selected].sort().join(',')}|${depot.latitude},${depot.longitude}|${capacity}`;
  const stale = !!result && result.key !== selectionKey;
  const selectable = rows.filter((r) => r.status === 'REQUESTED');
  const allVisibleSelected = selectable.length > 0 && selectable.every((r) => selected.has(r.id));

  const toggle = (r: CollectionRequest) => {
    if (r.status !== 'REQUESTED') return;
    setSelected((s) => { const n = new Set(s); if (n.has(r.id)) n.delete(r.id); else n.add(r.id); return n; });
  };
  const toggleAllVisible = () => setSelected((s) => {
    const n = new Set(s);
    if (allVisibleSelected) selectable.forEach((r) => n.delete(r.id)); else selectable.forEach((r) => n.add(r.id));
    return n;
  });

  // 3. Otimizar: o servidor divide as paradas em viagens que cabem no caminhão e ordena cada uma
  //    para percorrer a menor distância, saindo e voltando da central.
  const capacityValid = capacity != null && capacity >= 10 && capacity <= 50_000;
  const run = () => {
    if (!selected.size) { toast.error('Selecione ao menos uma solicitação.'); return; }
    if (!capacityValid) { toast.error('Informe a capacidade do veículo entre 10 e 50.000 kg.'); return; }
    const key = selectionKey;
    optimize.mutate({ requestIds: [...selected], depot, vehicleCapacityKg: capacity }, {
      onSuccess: (data) => { setResult({ data, key, capacity: capacity! }); setFocused(null); },
      onError: (e) => toast.error(errorMessage(e)),
    });
  };

  const reset = () => { setResult(null); setSelected(new Set()); setFocused(null); };
  const visibleOnMap = result ? (all.data ?? []).filter((r) => selected.has(r.id) || rows.includes(r)) : rows;
  const optimized = !!result && !stale;

  return (
    <>
      <PageHeader
        eyebrow="Administração"
        title="Coletas e rotas"
        description="Escolha as solicitações em aberto, otimize o trajeto dos caminhões e transforme o plano em rotas para os coletores."
      />

      {tab === 'plan' && (
        <>
          <div className="grid gap-4 lg:grid-cols-[400px_minmax(0,1fr)]">
            {/* Lista */}
            <section aria-label="Solicitações de coleta" className="surface flex min-w-0 flex-col overflow-hidden rounded-2xl lg:h-[680px]">
              <div className="space-y-2.5 border-b border-line p-3">
                <Segmented<StatusFilter> label="Status" value={status} onChange={setStatus} className="w-full"
                  options={[
                    { value: 'REQUESTED', label: 'Solicitadas', count: counts.REQUESTED },
                    { value: 'OPEN', label: 'Em aberto', count: counts.OPEN },
                    { value: 'COLLECTED', label: 'Coletadas', count: counts.COLLECTED },
                    { value: 'ALL', label: 'Todas' },
                  ]} />
                <div className="flex gap-2">
                  <Segmented<SourceFilter> label="Origem" value={source} onChange={setSource}
                    options={[{ value: 'ALL', label: 'Todas' }, { value: 'USER', label: 'Morador' }, { value: 'SMART_BIN', label: 'Lixeira' }]} />
                  <SearchField value={search} onChange={setSearch} placeholder="Endereço" className="min-w-0 flex-1" />
                </div>
              </div>
              <div className="flex h-10 items-center justify-between border-b border-line px-3 text-xs">
                <label className={cn('inline-flex items-center gap-2 text-muted', !selectable.length && 'opacity-50')}>
                  <input type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisible} disabled={!selectable.length}
                    className="size-4 cursor-pointer accent-[#ecefea]" aria-label="Selecionar todas as solicitações visíveis" />
                  Selecionar visíveis
                </label>
                <span className="font-mono text-subtle tabular" title="Ordenadas por prioridade">{rows.length} · por prioridade</span>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto max-lg:max-h-[420px]" data-lenis-prevent>
                {all.error && !all.data ? <ErrorState error={all.error} onRetry={all.refetch} compact />
                  : all.isPending ? (
                    <div className="divide-y divide-line" role="status" aria-label="Carregando">
                      {Array.from({ length: 8 }, (_, i) => <div key={i} className="flex gap-3 px-3 py-3"><Skeleton className="size-4" /><div className="flex-1 space-y-2"><Skeleton className="h-3.5 w-2/3" /><Skeleton className="h-3 w-1/3" /></div></div>)}
                    </div>
                  ) : !rows.length ? (
                    <EmptyState compact icon={MapPinned} title="Nenhuma solicitação" description={status === 'REQUESTED' ? 'Não há coletas aguardando roteirização.' : 'Ajuste os filtros.'} />
                  ) : (
                    <ul className="divide-y divide-line/70">
                      {rows.map((r) => (
                        <RequestRow key={r.id} r={r} checked={selected.has(r.id)} onToggle={() => toggle(r)}
                          onHover={(h) => setHovered(h ? r.id : null)} catColor={catColor} />
                      ))}
                    </ul>
                  )}
              </div>

              {/* Parâmetros */}
              <div className="space-y-3 border-t border-line bg-bg-deep/30 p-3">
                <div className="flex items-end gap-2">
                  <div className="min-w-0 flex-1">
                    <label htmlFor="cap" className="mb-1 block text-xs text-muted">Capacidade do veículo</label>
                    <NumberInput id="cap" value={capacity} onChange={setCapacity} decimals={0} min={10} max={50_000} step={100} unit="kg" inputSize="sm" invalid={!capacityValid} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="mb-1 text-xs text-muted">Central (partida)</p>
                    <Button size="sm" variant={pickingDepot ? 'outline' : 'secondary'} leftIcon={pickingDepot ? Crosshair : Warehouse} fullWidth
                      aria-pressed={pickingDepot} onClick={() => setPickingDepot((p) => !p)}>
                      {pickingDepot ? 'Clique no mapa…' : 'Definir no mapa'}
                    </Button>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[13px] text-muted">
                    <span className="font-mono text-fg tabular">{selected.size}</span> selecionadas · <span className="font-mono text-fg-soft tabular">{formatKg(selectedKg)}</span>
                  </p>
                  <div className="flex items-center gap-1">
                    {(selected.size > 0 || result) && <Button size="sm" variant="ghost" leftIcon={RotateCcw} onClick={reset}>Limpar</Button>}
                    <Button size="sm" variant={optimized ? 'secondary' : 'primary'} leftIcon={Sparkles} onClick={run} loading={optimize.isPending} disabled={!selected.size}>
                      Otimizar rotas
                    </Button>
                  </div>
                </div>
              </div>
            </section>

            {/* Mapa */}
            <div className="relative min-w-0">
              <CollectionsMap
                className="h-[420px] rounded-2xl border border-line sm:h-[520px] lg:h-[680px]"
                requests={visibleOnMap}
                selected={selected}
                hovered={hovered}
                depot={depot}
                capacityKg={result?.capacity ?? capacity ?? DEFAULT_CAPACITY_KG}
                optimization={result && !stale ? result.data : null}
                showNaive={showNaive}
                focusedRoute={focused}
                pickingDepot={pickingDepot}
                onToggle={toggle}
                onPickDepot={(p) => { setDepot({ latitude: Number(p.latitude.toFixed(6)), longitude: Number(p.longitude.toFixed(6)) }); setPickingDepot(false); toast.success('Central definida.'); }}
              />
              <MapLegend optimized={optimized} picking={pickingDepot} />
            </div>
          </div>

          {/* 4. Resultado (comparação com a ordem de chegada) e formulário que cria as rotas para os coletores. */}
          {result && (
            <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
              <OptimizationResult result={result.data} capacityKg={result.capacity} showNaive={showNaive} onShowNaive={setShowNaive}
                focused={focused} onFocus={setFocused} stale={stale} />
              <CreateRoutesForm
                requestIds={[...selected]}
                depot={result.data.depot}
                capacityKg={result.capacity}
                trips={result.data.routes.length}
                disabled={stale}
                onCreated={(rs) => { setCreated(new Set(rs.map((r) => r.id))); reset(); setTab('rotas'); }}
              />
            </div>
          )}
        </>
      )}

      {tab === 'routes' && <RoutesTab highlight={created} />}
    </>
  );
}

function RequestRow({ r, checked, onToggle, onHover, catColor }: {
  r: CollectionRequest; checked: boolean; onToggle: () => void; onHover: (h: boolean) => void; catColor: (c: keyof typeof categoryFallback) => string;
}) {
  const selectable = r.status === 'REQUESTED';
  const tone = priorityTone(r.priority);
  const id = `req-${r.id}`;
  return (
    <li onMouseEnter={() => onHover(true)} onMouseLeave={() => onHover(false)}
      className={cn('relative flex items-start gap-3 px-3 py-3 transition-colors', checked && 'bg-white/[0.04]', selectable && 'hover:bg-white/[0.025]')}>
      <input id={id} type="checkbox" checked={checked} onChange={onToggle} disabled={!selectable}
        onFocus={() => onHover(true)} onBlur={() => onHover(false)}
        className="mt-0.5 size-4 shrink-0 cursor-pointer accent-[#ecefea] disabled:cursor-not-allowed disabled:opacity-30" />
      <label htmlFor={id} className={cn('min-w-0 flex-1', selectable ? 'cursor-pointer' : 'cursor-default')}>
        <span className="flex items-start justify-between gap-2">
          <span className="truncate text-[13.5px] font-medium text-fg">{r.address}</span>
          <span title="Prioridade (0–100)" className={cn('shrink-0 font-mono text-[12.5px] tabular', tone === 'danger' ? 'text-danger' : tone === 'warning' ? 'text-warning' : 'text-subtle')}>
            P{r.priority}
          </span>
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted">
          <span className="inline-flex items-center gap-1">
            {r.source === 'SMART_BIN' ? <Cpu className="size-3" aria-hidden /> : <User className="size-3" aria-hidden />}
            {r.source === 'SMART_BIN' ? r.smartBin?.name ?? 'Lixeira' : r.requester?.name ?? 'Morador'}
          </span>
          <span className="font-mono tabular">{formatKg(r.estimatedKg)}</span>
          <span className="inline-flex items-center gap-1" aria-label={`Materiais: ${r.categoryCodes.map((c) => categoryFallback[c].name).join(', ')}`}>
            {r.categoryCodes.map((c) => <span key={c} className="size-1.5 rounded-full" style={{ backgroundColor: catColor(c) }} title={categoryFallback[c].name} />)}
          </span>
          <span>{formatRelative(r.createdAt)}</span>
          {r.status !== 'REQUESTED' && <StatusPill map={collectionRequestStatus} value={r.status} className="h-5 px-2 text-[11px]" />}
        </span>
      </label>
    </li>
  );
}

function MapLegend({ optimized, picking }: { optimized: boolean; picking: boolean }) {
  return (
    <div className="pointer-events-none absolute top-3 left-3 z-[500] max-w-[calc(100%-24px)] rounded-xl border border-line-strong bg-[#0a0e0c]/85 px-3 py-2 text-[11.5px] text-muted">
      {picking ? (
        <span className="flex items-center gap-2 text-fg-soft"><Crosshair className="size-3.5" aria-hidden /> Clique no mapa para posicionar a central</span>
      ) : optimized ? (
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-brand-300" />Otimizada</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-0 w-4 border-t-2 border-dashed border-fg-soft/60" />Ordem de chegada</span>
          <span className="inline-flex items-center gap-1.5"><Warehouse className="size-3" aria-hidden />Central</span>
        </span>
      ) : (
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-danger" />Urgente</span>
          <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-warning" />Média</span>
          <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-muted" />Normal</span>
          <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full border border-muted" />Lixeira</span>
          <span className="text-subtle">· clique para selecionar</span>
        </span>
      )}
    </div>
  );
}
