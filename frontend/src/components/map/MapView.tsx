/**
 * MapView — mapa base (Leaflet + react-leaflet) com tiles do OpenStreetMap escurecidos por CSS e controles do design system.
 * (Os basemaps escuros da CARTO passaram a exigir chave de API — "API KEY REQUIRED" —; por isso usamos o
 *  tile padrão do OSM com filtro escuro. Para voltar à CARTO com chave, defina VITE_CARTO_API_KEY.)
 * Use SOMENTE em páginas lazy (o leaflet fica no chunk "leaflet"; o CSS também é carregado só aqui).
 *
 *   <MapView className="h-[420px]" bounds={points.map(p => [p.latitude, p.longitude])}>
 *     {points.map(p => <CategoryMarker key={p.id} position={[p.latitude, p.longitude]} code="PAPEL" />)}
 *   </MapView>
 *
 * Props principais:
 *   center / zoom   visão inicial (padrão: centro de Taboão da Serra, zoom 13)
 *   bounds          pontos para enquadrar automaticamente (re-enquadra quando o conjunto muda)
 *   onMapClick      clique no mapa → { latitude, longitude } (use com `picking` para o cursor de mira)
 *   scrollWheelZoom padrão false (não "sequestra" o scroll da página); o zoom fica nos botões / pinça
 */
import 'leaflet/dist/leaflet.css';
import './map.css';
import { useEffect, type ReactNode } from 'react';
import { AttributionControl, MapContainer, TileLayer, ZoomControl, useMap, useMapEvents } from 'react-leaflet';
import type { LatLngTuple } from 'leaflet';
import { cn } from '@/lib/cn';
import { FitBounds } from './FitBounds';

export type { LatLngTuple };
export interface LatLon { latitude: number; longitude: number }

/** Centro padrão (Taboão da Serra / SP — mesma região dos dados de demonstração). */
export const DEFAULT_CENTER: LatLngTuple = [-23.609, -46.758];

const CARTO_KEY = import.meta.env.VITE_CARTO_API_KEY as string | undefined;
/** true = tiles já escuros (CARTO); false = OSM claro invertido por CSS. */
export const TILES_DARK = !!CARTO_KEY;
export const TILE_URL = CARTO_KEY
  ? `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png?api_key=${encodeURIComponent(CARTO_KEY)}`
  : 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export const TILE_ATTRIBUTION = CARTO_KEY
  ? '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions" target="_blank" rel="noopener noreferrer">CARTO</a>'
  : '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>';

/** Converte {latitude, longitude} → [lat, lon]. */
export const toLatLng = (p: LatLon): LatLngTuple => [p.latitude, p.longitude];

export interface MapViewProps {
  center?: LatLngTuple;
  zoom?: number;
  /** Pontos para enquadrar (fitBounds). Re-enquadra quando o conjunto muda. */
  bounds?: LatLngTuple[];
  /** Padding do enquadramento em px (padrão 48). */
  fitPadding?: number;
  /** Zoom máximo ao enquadrar (padrão 16). */
  maxFitZoom?: number;
  onMapClick?: (p: LatLon) => void;
  /** Cursor de mira (modo "clique para escolher"). */
  picking?: boolean;
  scrollWheelZoom?: boolean;
  /** Mostra os botões de zoom (padrão true). */
  zoomControl?: boolean;
  zoomPosition?: 'topleft' | 'topright' | 'bottomleft' | 'bottomright';
  /** Rótulo acessível da região do mapa. */
  ariaLabel?: string;
  className?: string;
  children?: ReactNode;
}

export function MapView({
  center = DEFAULT_CENTER, zoom = 13, bounds, fitPadding = 48, maxFitZoom = 16, onMapClick, picking,
  scrollWheelZoom = false, zoomControl = true, zoomPosition = 'bottomright', ariaLabel = 'Mapa', className, children,
}: MapViewProps) {
  return (
    <div role="region" aria-label={ariaLabel} className={cn('relative isolate overflow-hidden', className)}>
      <MapContainer
        center={center}
        zoom={zoom}
        zoomControl={false}
        attributionControl={false}
        scrollWheelZoom={scrollWheelZoom}
        className={cn('ez-map absolute inset-0 h-full w-full', !TILES_DARK && 'ez-map-invert', picking && 'ez-picking')}
        minZoom={3}
        maxZoom={19}
        worldCopyJump
      >
        <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} subdomains="abcd" maxZoom={19} detectRetina={false} />
        <AttributionControl position="bottomleft" prefix={false} />
        {zoomControl && <ZoomControl position={zoomPosition} zoomInTitle="Aproximar" zoomOutTitle="Afastar" />}
        <AutoResize />
        {onMapClick && <ClickHandler onClick={onMapClick} />}
        {bounds && bounds.length > 0 && <FitBounds points={bounds} padding={fitPadding} maxZoom={maxFitZoom} />}
        {children}
      </MapContainer>
    </div>
  );
}

/** Recalcula o tamanho quando o contêiner muda (abas, modais, painéis). */
function AutoResize() {
  const map = useMap();
  useEffect(() => {
    const el = map.getContainer();
    let raf = 0;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => map.invalidateSize({ pan: false }));
    });
    ro.observe(el);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [map]);
  return null;
}

function ClickHandler({ onClick }: { onClick: (p: LatLon) => void }) {
  useMapEvents({ click: (e) => onClick({ latitude: e.latlng.lat, longitude: e.latlng.lng }) });
  return null;
}
