import { useMemo } from 'react';
import type { CollectionRequest, GeoPoint, RouteOptimization } from '@/api/types';
import { DepotMarker, DotMarker, MapView, NumberedMarker, RoutePolyline, type LatLngTuple } from '@/components/map';
import { formatKg } from '@/lib/format';
import { naivePaths, priorityColor, routeColor, tuple } from './shared';

interface Props {
  requests: CollectionRequest[];
  selected: Set<string>;
  hovered: string | null;
  depot: GeoPoint;
  capacityKg: number;
  optimization: RouteOptimization | null;
  showNaive: boolean;
  focusedRoute: number | null;
  pickingDepot: boolean;
  onToggle: (r: CollectionRequest) => void;
  onPickDepot: (p: GeoPoint) => void;
  className?: string;
}

/** Mapa de planejamento: solicitações, central, rotas otimizadas e a rota ingênua (fantasma). */
export function CollectionsMap({ requests, selected, hovered, depot, capacityKg, optimization, showNaive, focusedRoute, pickingDepot, onToggle, onPickDepot, className }: Props) {
  const selectedReqs = useMemo(() => requests.filter((r) => selected.has(r.id)), [requests, selected]);
  const naive = useMemo(() => (optimization && showNaive ? naivePaths(selectedReqs, optimization.depot, capacityKg) : []), [optimization, showNaive, selectedReqs, capacityKg]);
  const inRoute = useMemo(() => new Set(optimization?.routes.flatMap((r) => r.stops.map((s) => s.requestId)) ?? []), [optimization]);

  const bounds = useMemo<LatLngTuple[]>(() => {
    const base = optimization
      ? [tuple(optimization.depot), ...optimization.routes.flatMap((r) => r.stops.map((s) => tuple(s)))]
      : [tuple(depot), ...requests.map(tuple)];
    return base;
  }, [optimization, requests, depot]);

  return (
    <MapView
      className={className}
      bounds={bounds}
      fitPadding={56}
      picking={pickingDepot}
      onMapClick={pickingDepot ? onPickDepot : undefined}
      ariaLabel="Mapa de solicitações de coleta e rotas"
    >
      {naive.map((path, i) => <RoutePolyline key={`n${i}`} positions={path} variant="ghost" />)}

      {optimization?.routes.map((r, i) => (
        <RoutePolyline key={`r${i}`} color={routeColor(i)} emphasis={focusedRoute === i}
          muted={focusedRoute != null && focusedRoute !== i}
          positions={[tuple(optimization.depot), ...r.stops.map((s) => tuple(s)), tuple(optimization.depot)]} />
      ))}

      {requests.filter((r) => !inRoute.has(r.id)).map((r) => {
        const sel = selected.has(r.id);
        const selectable = r.status === 'REQUESTED';
        return (
          <DotMarker
            key={r.id}
            position={tuple(r)}
            color={priorityColor(r.priority)}
            ring={r.source === 'SMART_BIN'}
            selected={sel || hovered === r.id}
            dimmed={!!optimization && !sel}
            size={sel ? 14 : 12}
            label={`${r.address}, prioridade ${r.priority}${sel ? ', selecionada' : ''}`}
            tooltip={<span><b className="font-medium text-fg">{r.address}</b><br />{formatKg(r.estimatedKg)} · prioridade {r.priority}</span>}
            onClick={selectable && !pickingDepot ? () => onToggle(r) : undefined}
          />
        );
      })}

      {optimization?.routes.map((r, i) => r.stops.map((s) => (
        <NumberedMarker
          key={s.requestId}
          position={tuple(s)}
          n={s.sequence}
          color={routeColor(i)}
          selected={hovered === s.requestId}
          zIndexOffset={focusedRoute === i ? 500 : 0}
          label={`Viagem ${i + 1}, parada ${s.sequence}: ${s.address}`}
          tooltip={<span><b className="font-medium text-fg">{i + 1}.{s.sequence} · {s.address}</b><br />{formatKg(s.estimatedKg)}</span>}
        />
      )))}

      <DepotMarker position={tuple(optimization?.depot ?? depot)} />
    </MapView>
  );
}
