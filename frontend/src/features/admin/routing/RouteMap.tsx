import { useMemo } from 'react';
import type { Route } from '@/api/types';
import { DepotMarker, MapView, NumberedMarker, PositionMarker, RoutePolyline, type LatLngTuple } from '@/components/map';
import { formatarKg } from '@/lib/format';
import { paraCoordenada } from './shared';

interface Props {
  rota: Route;
  cor?: string;
  /** Mostra a posição atual (coletor). */
  posicao?: LatLngTuple | null;
  /** Parada destacada. */
  idParadaAtiva?: string | null;
  aoClicarParada?: (stopId: string) => void;
  className?: string;
}

/** Uma rota: central, paradas numeradas (concluídas apagadas, próxima destacada) e trajeto. */
export function MapaRota({ rota, cor = '#34d399', posicao, idParadaAtiva, aoClicarParada, className }: Props) {
  const paradas = useMemo(() => [...rota.stops].sort((a, b) => a.sequence - b.sequence), [rota.stops]);
  const idProxima = paradas.find((s) => s.status === 'PENDING')?.id ?? null;
  const central = paraCoordenada(rota.depot);
  const caminho: LatLngTuple[] = [central, ...paradas.map(paraCoordenada), central];
  // trecho já percorrido: central → última parada concluída (na sequência)
  const ultimaConcluida = paradas.reduce((acc, s, i) => (s.status === 'DONE' ? i : acc), -1);
  const caminhoPercorrido: LatLngTuple[] = ultimaConcluida >= 0 ? [central, ...paradas.slice(0, ultimaConcluida + 1).map(paraCoordenada)] : [];
  const limites = useMemo<LatLngTuple[]>(() => [central, ...paradas.map(paraCoordenada), ...(posicao ? [posicao] : [])],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rota.id, paradas.length, posicao?.[0], posicao?.[1]]);

  return (
    <MapView className={className} bounds={limites} margemEnquadramento={40} ariaLabel={`Mapa da rota ${rota.name}`}>
      <RoutePolyline positions={caminho} cor={cor} atenuada={rota.status === 'DONE'} />
      {caminhoPercorrido.length > 1 && rota.status !== 'DONE' && <RoutePolyline positions={caminhoPercorrido} variant="done" weight={5} />}
      {paradas.map((s) => (
        <NumberedMarker
          key={s.id}
          position={paraCoordenada(s)}
          n={s.sequence}
          color={cor}
          estado={s.status === 'DONE' ? 'done' : s.id === idProxima && rota.status === 'IN_PROGRESS' ? 'next' : 'pending'}
          selecionado={idParadaAtiva === s.id && s.status !== 'DONE'}
          label={`Parada ${s.sequence}: ${s.address}${s.status === 'DONE' ? ' (concluída)' : ''}`}
          tooltip={<span><b className="font-medium text-fg">{s.sequence}. {s.address}</b><br />{formatarKg(s.estimatedKg)} estimados</span>}
          onClick={aoClicarParada ? () => aoClicarParada(s.id) : undefined}
        />
      ))}
      <DepotMarker position={central} />
      {posicao && <PositionMarker position={posicao} />}
    </MapView>
  );
}
