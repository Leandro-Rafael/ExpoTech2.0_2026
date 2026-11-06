import { useMemo } from 'react';
import type { CollectionRequest, GeoPoint, RouteOptimization } from '@/api/types';
import { DepotMarker, DotMarker, MapView, NumberedMarker, RoutePolyline, type LatLngTuple } from '@/components/map';
import { formatarKg } from '@/lib/format';
import { caminhosIngenuos, corDaPrioridade, corDaRota, paraCoordenada } from './shared';

interface Props {
  solicitacoes: CollectionRequest[];
  selecionadas: Set<string>;
  destacada: string | null;
  central: GeoPoint;
  capacidadeKg: number;
  otimizacao: RouteOptimization | null;
  mostrarIngenua: boolean;
  rotaEmFoco: number | null;
  escolhendoCentral: boolean;
  aoAlternar: (r: CollectionRequest) => void;
  aoEscolherCentral: (p: GeoPoint) => void;
  className?: string;
}

/** Mapa de planejamento: solicitações, central, rotas otimizadas e a rota ingênua (fantasma). */
export function MapaColetas({ solicitacoes, selecionadas, destacada, central, capacidadeKg, otimizacao, mostrarIngenua, rotaEmFoco, escolhendoCentral, aoAlternar, aoEscolherCentral, className }: Props) {
  const solicitacoesSelecionadas = useMemo(() => solicitacoes.filter((r) => selecionadas.has(r.id)), [solicitacoes, selecionadas]);
  const ingenuas = useMemo(() => (otimizacao && mostrarIngenua ? caminhosIngenuos(solicitacoesSelecionadas, otimizacao.depot, capacidadeKg) : []), [otimizacao, mostrarIngenua, solicitacoesSelecionadas, capacidadeKg]);
  const naRota = useMemo(() => new Set(otimizacao?.routes.flatMap((r) => r.stops.map((s) => s.requestId)) ?? []), [otimizacao]);

  const limites = useMemo<LatLngTuple[]>(() => {
    const pontos = otimizacao
      ? [paraCoordenada(otimizacao.depot), ...otimizacao.routes.flatMap((r) => r.stops.map((s) => paraCoordenada(s)))]
      : [paraCoordenada(central), ...solicitacoes.map(paraCoordenada)];
    return pontos;
  }, [otimizacao, solicitacoes, central]);

  return (
    <MapView
      className={className}
      bounds={limites}
      margemEnquadramento={56}
      modoEscolha={escolhendoCentral}
      aoClicarMapa={escolhendoCentral ? aoEscolherCentral : undefined}
      ariaLabel="Mapa de solicitações de coleta e rotas"
    >
      {ingenuas.map((caminho, i) => <RoutePolyline key={`n${i}`} positions={caminho} variant="ghost" />)}

      {otimizacao?.routes.map((r, i) => (
        <RoutePolyline key={`r${i}`} cor={corDaRota(i)} destaque={rotaEmFoco === i}
          atenuada={rotaEmFoco != null && rotaEmFoco !== i}
          positions={[paraCoordenada(otimizacao.depot), ...r.stops.map((s) => paraCoordenada(s)), paraCoordenada(otimizacao.depot)]} />
      ))}

      {solicitacoes.filter((r) => !naRota.has(r.id)).map((r) => {
        const selecionada = selecionadas.has(r.id);
        const selecionavel = r.status === 'REQUESTED';
        return (
          <DotMarker
            key={r.id}
            position={paraCoordenada(r)}
            cor={corDaPrioridade(r.priority)}
            anel={r.source === 'SMART_BIN'}
            selecionado={selecionada || destacada === r.id}
            esmaecido={!!otimizacao && !selecionada}
            size={selecionada ? 14 : 12}
            label={`${r.address}, prioridade ${r.priority}${selecionada ? ', selecionada' : ''}`}
            tooltip={<span><b className="font-medium text-fg">{r.address}</b><br />{formatarKg(r.estimatedKg)} · prioridade {r.priority}</span>}
            onClick={selecionavel && !escolhendoCentral ? () => aoAlternar(r) : undefined}
          />
        );
      })}

      {otimizacao?.routes.map((r, i) => r.stops.map((s) => (
        <NumberedMarker
          key={s.requestId}
          position={paraCoordenada(s)}
          n={s.sequence}
          color={corDaRota(i)}
          selecionado={destacada === s.requestId}
          zIndexOffset={rotaEmFoco === i ? 500 : 0}
          label={`Viagem ${i + 1}, parada ${s.sequence}: ${s.address}`}
          tooltip={<span><b className="font-medium text-fg">{i + 1}.{s.sequence} · {s.address}</b><br />{formatarKg(s.estimatedKg)}</span>}
        />
      )))}

      <DepotMarker position={paraCoordenada(otimizacao?.depot ?? central)} />
    </MapView>
  );
}
