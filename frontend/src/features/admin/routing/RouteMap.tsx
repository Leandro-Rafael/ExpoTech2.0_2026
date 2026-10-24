import { useMemo } from 'react';
import type { Route } from '@/api/types';
import { DepotMarker, MapView, NumberedMarker, PositionMarker, RoutePolyline, type LatLngTuple } from '@/components/map';
import { formatKg } from '@/lib/format';
import { tuple } from './shared';

interface Props {
  route: Route;
  color?: string;
  /** Mostra a posição atual (coletor). */
  position?: LatLngTuple | null;
  /** Parada destacada. */
  activeStopId?: string | null;
  onStopClick?: (stopId: string) => void;
  className?: string;
}

/** Uma rota: central, paradas numeradas (concluídas apagadas, próxima destacada) e trajeto. */
export function RouteMap({ route, color = '#34d399', position, activeStopId, onStopClick, className }: Props) {
  const stops = useMemo(() => [...route.stops].sort((a, b) => a.sequence - b.sequence), [route.stops]);
  const nextId = stops.find((s) => s.status === 'PENDING')?.id ?? null;
  const depot = tuple(route.depot);
  const path: LatLngTuple[] = [depot, ...stops.map(tuple), depot];
  // trecho já percorrido: central → última parada concluída (na sequência)
  const lastDone = stops.reduce((acc, s, i) => (s.status === 'DONE' ? i : acc), -1);
  const donePath: LatLngTuple[] = lastDone >= 0 ? [depot, ...stops.slice(0, lastDone + 1).map(tuple)] : [];
  const bounds = useMemo<LatLngTuple[]>(() => [depot, ...stops.map(tuple), ...(position ? [position] : [])],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [route.id, stops.length, position?.[0], position?.[1]]);

  return (
    <MapView className={className} bounds={bounds} fitPadding={40} ariaLabel={`Mapa da rota ${route.name}`}>
      <RoutePolyline positions={path} color={color} muted={route.status === 'DONE'} />
      {donePath.length > 1 && route.status !== 'DONE' && <RoutePolyline positions={donePath} variant="done" weight={5} />}
      {stops.map((s) => (
        <NumberedMarker
          key={s.id}
          position={tuple(s)}
          n={s.sequence}
          color={color}
          state={s.status === 'DONE' ? 'done' : s.id === nextId && route.status === 'IN_PROGRESS' ? 'next' : 'pending'}
          selected={activeStopId === s.id && s.status !== 'DONE'}
          label={`Parada ${s.sequence}: ${s.address}${s.status === 'DONE' ? ' (concluída)' : ''}`}
          tooltip={<span><b className="font-medium text-fg">{s.sequence}. {s.address}</b><br />{formatKg(s.estimatedKg)} estimados</span>}
          onClick={onStopClick ? () => onStopClick(s.id) : undefined}
        />
      ))}
      <DepotMarker position={depot} />
      {position && <PositionMarker position={position} />}
    </MapView>
  );
}
