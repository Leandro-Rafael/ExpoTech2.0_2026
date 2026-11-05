import { useEffect, useMemo, useRef, useState } from 'react';
import { Clock, Crosshair, ExternalLink, LocateFixed, MapPin, Navigation } from 'lucide-react';
import { useCategories, useCollectionPoints } from '@/api/queries';
import type { CategoryCode, CollectionPoint } from '@/api/types';
import { CategoryIcon } from '@/components/CategoryIcon';
import { CategoryMarker, FitBounds, MapView, PositionMarker, type LatLngTuple } from '@/components/map';
import { Button, EmptyState, ErrorState, Select, SkeletonText } from '@/components/ui';
import { useGeolocation } from '@/hooks/useGeolocation';
import { cn } from '@/lib/cn';
import { categoryColor, hexAlpha } from '@/lib/category';
import { formatDistanceKm } from '@/lib/format';
import { categoryFallback, CATEGORY_CODES } from '@/lib/labels';

const RADII = [1, 3, 5, 10, 25];

/ Mapa e lista de ecopontos, filtrando por material e ordenando pela distância de quem está usando.
export function Ecopoints() {
  const geo = useGeolocation();
  const categories = useCategories();
  const [category, setCategory] = useState<CategoryCode | null>(null);
  const [radius, setRadius] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const located = geo.status === 'success' && geo.latitude != null;
  const q = useCollectionPoints({
    lat: located ? Number(geo.latitude!.toFixed(5)) : undefined,
    lon: located ? Number(geo.longitude!.toFixed(5)) : undefined,
    radiusKm: located && radius ? radius : undefined,
    category: category ?? undefined,
  });
  const points = useMemo(() => (q.data ?? []).filter((p) => p.active), [q.data]);
  const selected = points.find((p) => p.id === selectedId) ?? null;
  const catByCode = useMemo(() => new Map((categories.data ?? []).map((c) => [c.code, c])), [categories.data]);
  const listRef = useRef<HTMLUListElement>(null);

  // Mantém o item selecionado visível na lista.
  useEffect(() => {
    if (!selectedId) return;
    listRef.current?.querySelector(`[data-id="${CSS.escape(selectedId)}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selectedId]);

  const me: LatLngTuple | null = located ? [geo.latitude!, geo.longitude!] : null;
  const fitPoints: LatLngTuple[] = selected
    ? [[selected.latitude, selected.longitude]]
    : [...points.map((p) => [p.latitude, p.longitude] as LatLngTuple), ...(me ? [me] : [])];

  return (
    <div>
      {/* Filtros: uma linha, acima do mapa */}
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]" role="group" aria-label="Filtrar por material">
          <Chip active={category === null} onClick={() => setCategory(null)}>Todos</Chip>
          {CATEGORY_CODES.map((code) => {
            const c = catByCode.get(code);
            const color = categoryColor(code, c?.color);
            return (
              <Chip key={code} active={category === code} color={color} onClick={() => setCategory(category === code ? null : code)}>
                <span aria-hidden className="size-2 rounded-full" style={{ backgroundColor: color }} />{c?.name ?? categoryFallback[code].name}
              </Chip>
            );
          })}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {located ? (
            <Select inputSize="sm" aria-label="Distância máxima" value={radius ?? ''} onChange={(e) => setRadius(e.target.value ? Number(e.target.value) : null)} className="w-40">
              <option value="">Qualquer distância</option>
              {RADII.map((r) => <option key={r} value={r}>Até {r} km</option>)}
            </Select>
          ) : (
            <Button size="sm" variant="secondary" leftIcon={geo.status === 'loading' ? Crosshair : LocateFixed} loading={geo.status === 'loading'} onClick={geo.request}>
              Perto de mim
            </Button>
          )}
        </div>
      </div>
      {geo.status === 'error' && <p className="mb-4 text-sm text-warning">{geo.error} Os ecopontos aparecem sem ordenação por distância.</p>}

      <div className="grid grid-cols-1 overflow-hidden rounded-2xl border border-line lg:h-[640px] lg:grid-cols-[380px_minmax(0,1fr)]">
        <div className="order-2 flex min-h-0 flex-col border-line lg:order-1 lg:border-r">
          <div className="flex items-center justify-between border-b border-line px-4 py-3 text-xs text-subtle">
            <span aria-live="polite"><span className="font-mono text-fg-soft tabular">{points.length}</span> {points.length === 1 ? 'ecoponto' : 'ecopontos'}{located ? ' · do mais perto ao mais longe' : ''}</span>
          </div>
          {q.isPending ? <div className="p-4"><SkeletonText lines={8} /></div> : q.error ? <ErrorState compact error={q.error} onRetry={q.refetch} /> :
            points.length === 0 ? (
              <EmptyState compact icon={MapPin} title="Nenhum ecoponto com esses filtros"
                description={radius ? 'Aumente a distância ou escolha outro material.' : 'Escolha outro material.'}
                action={<Button size="sm" variant="secondary" onClick={() => { setCategory(null); setRadius(null); }}>Limpar filtros</Button>} />
            ) : (
              <ul ref={listRef} className="max-h-[420px] min-h-0 flex-1 divide-y divide-line overflow-y-auto lg:max-h-none" data-lenis-prevent>
                {points.map((p) => (
                  <PointItem key={p.id} p={p} selected={p.id === selectedId} onSelect={() => setSelectedId(p.id === selectedId ? null : p.id)} catByCode={catByCode} />
                ))}
              </ul>
            )}
        </div>
        <div className="relative order-1 h-[340px] lg:order-2 lg:h-auto">
          <MapView className="absolute inset-0" ariaLabel="Mapa de ecopontos" onMapClick={() => setSelectedId(null)}>
            {fitPoints.length > 0 && <FitBounds points={fitPoints} maxZoom={selected ? 16 : 15} />}
            {me && <PositionMarker position={me} label="Você está aqui" />}
            {points.map((p) => {
              const primary = category ?? p.categories[0];
              const c = catByCode.get(primary);
              return (
                <CategoryMarker key={p.id} position={[p.latitude, p.longitude]} code={primary} color={c?.color} icon={c?.icon}
                  selected={p.id === selectedId} dimmed={!!selectedId && p.id !== selectedId}
                  label={p.name} tooltip={p.name} onClick={() => setSelectedId(p.id)} zIndexOffset={p.id === selectedId ? 1000 : 0} />
              );
            })}
          </MapView>
        </div>
      </div>
    </div>
  );
}

function Chip({ active, onClick, children, color }: { active: boolean; onClick: () => void; children: React.ReactNode; color?: string }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active}
      className={cn('inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-xs whitespace-nowrap transition-colors',
        active ? 'border-transparent text-fg' : 'border-line text-muted hover:border-line-strong hover:text-fg')}
      style={active ? { backgroundColor: color ? hexAlpha(color, 0.12) : 'rgb(255 255 255 / 0.06)', boxShadow: `inset 0 0 0 1px ${color ? hexAlpha(color, 0.5) : 'rgb(236 239 234 / 0.24)'}` } : undefined}>
      {children}
    </button>
  );
}

function PointItem({ p, selected, onSelect, catByCode }: {
  p: CollectionPoint; selected: boolean; onSelect: () => void; catByCode: Map<CategoryCode, { color: string; icon: string; name: string }>;
}) {
  const directions = `https://www.google.com/maps/dir/?api=1&destination=${p.latitude},${p.longitude}`;
  return (
    <li data-id={p.id} className={cn('transition-colors', selected && 'bg-white/[0.035]')}>
      <button type="button" onClick={onSelect} aria-expanded={selected} className="flex w-full items-start gap-3 px-4 py-3.5 text-left hover:bg-white/[0.02]">
        <MapPin className={cn('mt-0.5 size-4 shrink-0', selected ? 'text-fg' : 'text-subtle')} aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-fg">{p.name}</span>
          <span className="block truncate text-xs text-subtle">{p.neighborhood}</span>
          <span className="mt-2 flex flex-wrap gap-1">
            {p.categories.map((code) => {
              const c = catByCode.get(code);
              return <CategoryIcon key={code} code={code} icon={c?.icon} color={c?.color} variant="plain" size="sm" label={c?.name ?? categoryFallback[code].name} />;
            })}
          </span>
        </span>
        {p.distanceKm != null && <span className="shrink-0 font-mono text-xs text-fg-soft tabular">{formatDistanceKm(p.distanceKm)}</span>}
      </button>
      {selected && (
        <div className="space-y-3 px-4 pb-4 pl-11 text-sm">
          <p className="text-fg-soft">{p.address}</p>
          <p className="flex items-start gap-2 text-muted"><Clock className="mt-0.5 size-3.5 shrink-0" aria-hidden />{p.openingHours}</p>
          <p className="text-xs text-subtle">Recebe: {p.categories.map((c) => catByCode.get(c)?.name ?? categoryFallback[c].name).join(', ')}</p>
          <a href={directions} target="_blank" rel="noopener noreferrer"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line-strong px-3 text-xs font-medium text-fg transition-colors hover:bg-white/[0.04]">
            <Navigation className="size-3.5" aria-hidden />Como chegar<ExternalLink className="size-3 text-subtle" aria-hidden />
            <span className="sr-only">(abre o Google Maps em nova aba)</span>
          </a>
        </div>
      )}
    </li>
  );
}
