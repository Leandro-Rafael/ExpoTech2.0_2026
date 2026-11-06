/**
 * Seletor de localização: clique no mapa (ou arraste o pino) para definir lat/lon.
 * Para acessibilidade, combine com campos numéricos de latitude/longitude no formulário.
 *
 *   <LocationPicker value={{ latitude, longitude }} onChange={(p) => { setValue('latitude', p.latitude); ... }} className="h-72" />
 */
import { useCallback } from 'react';
import type { LatLngTuple } from 'leaflet';
import { MapPin } from 'lucide-react';
import { cn } from '@/lib/cn';
import { CENTRO_PADRAO, Mapa, type LatLon } from './MapView';
import { MarcadorMapa } from './markers';

export interface PropsSeletorLocal {
  value: LatLon | null;
  onChange: (p: LatLon) => void;
  /** Centro quando ainda não há valor. */
  centroPadrao?: LatLngTuple;
  className?: string;
  /** Outros pontos de referência (ex.: ecopontos existentes), em cinza. */
  referencias?: LatLngTuple[];
  invalido?: boolean;
}

const arredondar6 = (n: number) => Math.round(n * 1e6) / 1e6;

export function SeletorLocal({ value, onChange, centroPadrao = CENTRO_PADRAO, className, referencias, invalido }: PropsSeletorLocal) {
  const definir = useCallback((p: LatLon) => onChange({ latitude: arredondar6(p.latitude), longitude: arredondar6(p.longitude) }), [onChange]);
  const posicao: LatLngTuple | null = value ? [value.latitude, value.longitude] : null;
  return (
    <div className={cn('relative overflow-hidden rounded-xl border', invalido ? 'border-danger/70' : 'border-line-strong', className)}>
      <Mapa
        className="absolute inset-0"
        center={posicao ?? centroPadrao}
        zoom={posicao ? 15 : 13}
        aoClicarMapa={definir}
        modoEscolha
        scrollWheelZoom
        ariaLabel="Mapa para escolher a localização"
      >
        {referencias?.map((c, i) => (
          <MarcadorMapa key={i} position={c} size={10}><span className="block size-2.5 rounded-full border border-[#0a0e0c] bg-[#7d8680]" /></MarcadorMapa>
        ))}
        {posicao && (
          <MarcadorMapa position={posicao} size={36} ancora={[18, 34]} draggable label="Local escolhido (arraste para ajustar)"
            aoSoltar={(p) => definir({ latitude: p[0], longitude: p[1] })}>
            <div className="flex size-full items-start justify-center">
              <MapPin aria-hidden className="size-9 fill-accent text-[#0a0e0c] drop-shadow-[0_6px_8px_rgb(0_0_0/0.7)]" strokeWidth={1.6} />
            </div>
          </MarcadorMapa>
        )}
      </Mapa>
      <p className="pointer-events-none absolute top-2.5 left-2.5 z-[500] rounded-md bg-[#070a08]/80 px-2 py-1 text-[11.5px] text-fg-soft">
        {posicao ? 'Clique ou arraste o pino para ajustar' : 'Clique no mapa para marcar o local'}
      </p>
    </div>
  );
}
