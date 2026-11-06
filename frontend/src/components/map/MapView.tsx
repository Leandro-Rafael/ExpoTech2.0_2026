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
import { Enquadrar } from './FitBounds';

export type { LatLngTuple };
export interface LatLon { latitude: number; longitude: number }

/** Centro padrão (Taboão da Serra / SP — mesma região dos dados de demonstração). */
export const CENTRO_PADRAO: LatLngTuple = [-23.609, -46.758];

const CHAVE_CARTO = import.meta.env.VITE_CARTO_API_KEY as string | undefined;
/** true = tiles já escuros (CARTO); false = OSM claro invertido por CSS. */
const MAPA_ESCURO = !!CHAVE_CARTO;
const URL_MAPA = CHAVE_CARTO
  ? `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png?api_key=${encodeURIComponent(CHAVE_CARTO)}`
  : 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATRIBUICAO_MAPA = CHAVE_CARTO
  ? '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions" target="_blank" rel="noopener noreferrer">CARTO</a>'
  : '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>';

export interface PropsMapa {
  center?: LatLngTuple;
  zoom?: number;
  /** Pontos para enquadrar (fitBounds). Re-enquadra quando o conjunto muda. */
  bounds?: LatLngTuple[];
  /** Padding do enquadramento em px (padrão 48). */
  margemEnquadramento?: number;
  /** Zoom máximo ao enquadrar (padrão 16). */
  zoomMaxEnquadramento?: number;
  aoClicarMapa?: (p: LatLon) => void;
  /** Cursor de mira (modo "clique para escolher"). */
  modoEscolha?: boolean;
  scrollWheelZoom?: boolean;
  /** Mostra os botões de zoom (padrão true). */
  zoomControl?: boolean;
  posicaoZoom?: 'topleft' | 'topright' | 'bottomleft' | 'bottomright';
  /** Rótulo acessível da região do mapa. */
  ariaLabel?: string;
  className?: string;
  children?: ReactNode;
}

/** className já posiciona o contêiner (sem prefixo responsivo)? Então não forçamos `relative`. */
const JA_POSICIONADO = /(^|\s)(absolute|fixed|sticky)(\s|$)/;

export function Mapa({
  center = CENTRO_PADRAO, zoom = 13, bounds, margemEnquadramento = 48, zoomMaxEnquadramento = 16, aoClicarMapa, modoEscolha,
  scrollWheelZoom = false, zoomControl = true, posicaoZoom = 'bottomright', ariaLabel = 'Mapa', className, children,
}: PropsMapa) {
  return (
    <div role="region" aria-label={ariaLabel} className={cn(!JA_POSICIONADO.test(className ?? '') && 'relative', 'isolate overflow-hidden', className)}>
      <MapContainer
        center={center}
        zoom={zoom}
        zoomControl={false}
        attributionControl={false}
        scrollWheelZoom={scrollWheelZoom}
        className={cn('ez-map absolute inset-0 h-full w-full', !MAPA_ESCURO && 'ez-map-invert', modoEscolha && 'ez-picking')}
        minZoom={3}
        maxZoom={19}
        worldCopyJump
      >
        <TileLayer url={URL_MAPA} attribution={ATRIBUICAO_MAPA} subdomains="abcd" maxZoom={19} detectRetina={false} />
        <AttributionControl position="bottomleft" prefix={false} />
        {zoomControl && <ZoomControl position={posicaoZoom} zoomInTitle="Aproximar" zoomOutTitle="Afastar" />}
        <AutoRedimensionar />
        {aoClicarMapa && <OuvinteClique aoClicar={aoClicarMapa} />}
        {bounds && bounds.length > 0 && <Enquadrar pontos={bounds} padding={margemEnquadramento} maxZoom={zoomMaxEnquadramento} />}
        {children}
      </MapContainer>
    </div>
  );
}

/** Recalcula o tamanho quando o contêiner muda (abas, modais, painéis). */
function AutoRedimensionar() {
  const mapa = useMap();
  useEffect(() => {
    const el = mapa.getContainer();
    let raf = 0;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => mapa.invalidateSize({ pan: false }));
    });
    ro.observe(el);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [mapa]);
  return null;
}

function OuvinteClique({ aoClicar }: { aoClicar: (p: LatLon) => void }) {
  useMapEvents({ click: (e) => aoClicar({ latitude: e.latlng.lat, longitude: e.latlng.lng }) });
  return null;
}
