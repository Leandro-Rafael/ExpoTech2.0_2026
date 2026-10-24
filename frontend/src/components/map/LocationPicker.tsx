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
import { DEFAULT_CENTER, MapView, type LatLon } from './MapView';
import { MapMarker } from './markers';

export interface LocationPickerProps {
  value: LatLon | null;
  onChange: (p: LatLon) => void;
  /** Centro quando ainda não há valor. */
  fallbackCenter?: LatLngTuple;
  className?: string;
  /** Outros pontos de referência (ex.: ecopontos existentes), em cinza. */
  context?: LatLngTuple[];
  invalid?: boolean;
}

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

export function LocationPicker({ value, onChange, fallbackCenter = DEFAULT_CENTER, className, context, invalid }: LocationPickerProps) {
  const set = useCallback((p: LatLon) => onChange({ latitude: round6(p.latitude), longitude: round6(p.longitude) }), [onChange]);
  const pos: LatLngTuple | null = value ? [value.latitude, value.longitude] : null;
  return (
    <div className={cn('relative overflow-hidden rounded-xl border', invalid ? 'border-danger/70' : 'border-line-strong', className)}>
      <MapView
        className="absolute inset-0"
        center={pos ?? fallbackCenter}
        zoom={pos ? 15 : 13}
        onMapClick={set}
        picking
        scrollWheelZoom
        ariaLabel="Mapa para escolher a localização"
      >
        {context?.map((c, i) => (
          <MapMarker key={i} position={c} size={10}><span className="block size-2.5 rounded-full border border-[#0a0e0c] bg-[#7d8680]" /></MapMarker>
        ))}
        {pos && (
          <MapMarker position={pos} size={36} anchor={[18, 34]} draggable label="Local escolhido (arraste para ajustar)"
            onDragEnd={(p) => set({ latitude: p[0], longitude: p[1] })}>
            <div className="flex size-full items-start justify-center">
              <MapPin aria-hidden className="size-9 fill-accent text-[#0a0e0c] drop-shadow-[0_6px_8px_rgb(0_0_0/0.7)]" strokeWidth={1.6} />
            </div>
          </MapMarker>
        )}
      </MapView>
      <p className="pointer-events-none absolute top-2.5 left-2.5 z-[500] rounded-md bg-[#070a08]/80 px-2 py-1 text-[11.5px] text-fg-soft">
        {pos ? 'Clique ou arraste o pino para ajustar' : 'Clique no mapa para marcar o local'}
      </p>
    </div>
  );
}
