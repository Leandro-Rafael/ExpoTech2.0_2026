/**
 * Marcadores (divIcon renderizado por React via portal — nada de PNG padrão do Leaflet).
 *
 *   <MapMarker position={[lat, lon]} size={28} label="Ecoponto Centro" onClick={...}>{qualquer JSX}</MapMarker>
 *   <CategoryMarker position={p} code="PAPEL" color={cat.color} icon={cat.icon} selected label="..." />
 *   <NumberedMarker position={p} n={3} color="#34d399" state="pending|next|done" />
 *   <DotMarker position={p} color="#f5b544" selected />      // ponto simples (solicitações, ecopontos)
 *   <DepotMarker position={p} />                              // garagem / central
 *   <PositionMarker position={p} />                           // "você está aqui" (pulso)
 *
 * Todos aceitam `label` (title + aria), `tooltip` (texto ao passar o mouse), `onClick` e `zIndexOffset`.
 * São focáveis pelo teclado (Tab) e ativáveis com Enter quando têm onClick.
 */
import { useMemo, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Marker, Tooltip } from 'react-leaflet';
import { divIcon, type LatLngTuple, type LeafletMouseEvent } from 'leaflet';
import { Check, Warehouse } from 'lucide-react';
import type { CategoryCode } from '@/api/types';
import { iconByName } from '@/components/icons';
import { categoryColor, hexAlpha } from '@/lib/category';
import { categoryFallback } from '@/lib/labels';

export interface BaseMarkerProps {
  position: LatLngTuple;
  label?: string;
  tooltip?: ReactNode;
  /** Tooltip sempre visível. */
  permanentTooltip?: boolean;
  onClick?: (e: LeafletMouseEvent) => void;
  zIndexOffset?: number;
  draggable?: boolean;
  onDragEnd?: (p: LatLngTuple) => void;
}

export interface MapMarkerProps extends BaseMarkerProps {
  /** Lado do ícone em px (quadrado). */
  size?: number;
  /** Âncora (padrão: centro). Para pinos, use [size/2, size]. */
  anchor?: [number, number];
  children: ReactNode;
}

/** Marcador genérico com conteúdo React. */
export function MapMarker({ position, label, tooltip, permanentTooltip, onClick, zIndexOffset, draggable, onDragEnd, size = 28, anchor, children }: MapMarkerProps) {
  const el = useMemo(() => document.createElement('div'), []);
  const ax = anchor?.[0];
  const ay = anchor?.[1];
  const icon = useMemo(
    () => divIcon({ html: el, className: 'ez-marker', iconSize: [size, size], iconAnchor: [ax ?? size / 2, ay ?? size / 2], tooltipAnchor: [0, -size / 2] }),
    [el, size, ax, ay],
  );
  if (label) el.setAttribute('aria-label', label);
  const handlers = useMemo(() => ({
    ...(onClick ? { click: onClick } : {}),
    ...(onDragEnd ? { dragend: (e: { target: { getLatLng: () => { lat: number; lng: number } } }) => { const ll = e.target.getLatLng(); onDragEnd([ll.lat, ll.lng]); } } : {}),
  }), [onClick, onDragEnd]);

  return (
    <Marker
      position={position}
      icon={icon}
      title={label}
      keyboard={!!onClick || !!draggable}
      interactive={!!onClick || !!draggable || !!tooltip}
      draggable={draggable}
      zIndexOffset={zIndexOffset}
      eventHandlers={handlers}
      riseOnHover
    >
      {createPortal(children, el)}
      {tooltip && (
        <Tooltip className="ez-tooltip" direction="top" offset={[0, -4]} permanent={permanentTooltip} opacity={1}>
          {tooltip}
        </Tooltip>
      )}
    </Marker>
  );
}

// ------------------------------------------------------------------ variações

export interface CategoryMarkerProps extends BaseMarkerProps {
  code?: CategoryCode | null;
  color?: string | null;
  icon?: string | null;
  selected?: boolean;
  dimmed?: boolean;
}

/** Círculo tingido com o ícone da categoria. */
export function CategoryMarker({ code, color, icon, selected, dimmed, ...rest }: CategoryMarkerProps) {
  const hex = categoryColor(code ?? null, color);
  const Icon = iconByName(icon ?? (code ? categoryFallback[code].icon : null));
  const size = selected ? 38 : 32;
  return (
    <MapMarker {...rest} size={size} zIndexOffset={selected ? 800 : rest.zIndexOffset}>
      <div
        className="flex size-full items-center justify-center rounded-full border transition-[opacity,transform] duration-200"
        style={{
          color: hex, backgroundColor: '#0d120f', borderColor: hexAlpha(hex, selected ? 0.95 : 0.55),
          boxShadow: selected ? `0 0 0 4px ${hexAlpha(hex, 0.22)}, 0 6px 16px -6px rgb(0 0 0 / .8)` : '0 4px 12px -4px rgb(0 0 0 / .8)',
          opacity: dimmed ? 0.4 : 1,
        }}
      >
        <Icon aria-hidden className={selected ? 'size-[18px]' : 'size-4'} />
      </div>
    </MapMarker>
  );
}

export interface DotMarkerProps extends BaseMarkerProps {
  color?: string;
  selected?: boolean;
  dimmed?: boolean;
  /** Diâmetro em px (padrão 14). */
  size?: number;
  /** Anel interno (ex.: lixeira inteligente). */
  ring?: boolean;
}

/** Ponto compacto: bom para muitos itens (solicitações, ecopontos). */
export function DotMarker({ color = '#34d399', selected, dimmed, size = 14, ring, ...rest }: DotMarkerProps) {
  const box = size + 14; // área de toque maior que o ponto
  return (
    <MapMarker {...rest} size={box} zIndexOffset={selected ? 700 : rest.zIndexOffset}>
      <div className="flex size-full items-center justify-center" style={{ opacity: dimmed ? 0.35 : 1 }}>
        <span
          className="block rounded-full transition-transform duration-200"
          style={{
            width: size, height: size,
            backgroundColor: ring ? '#0d120f' : color,
            border: `2px solid ${ring ? color : '#0a0e0c'}`,
            boxShadow: selected ? `0 0 0 3px #0a0e0c, 0 0 0 5px ${color}` : '0 2px 6px rgb(0 0 0 / .7)',
            transform: selected ? 'scale(1.15)' : undefined,
          }}
        />
      </div>
    </MapMarker>
  );
}

export interface NumberedMarkerProps extends BaseMarkerProps {
  n: number;
  color?: string;
  /** pending: contorno; next: preenchido (próxima parada); done: apagado com ✓. */
  state?: 'pending' | 'next' | 'done';
  selected?: boolean;
}

/** Parada numerada de rota. */
export function NumberedMarker({ n, color = '#34d399', state = 'pending', selected, ...rest }: NumberedMarkerProps) {
  const size = state === 'next' || selected ? 32 : 26;
  const filled = state === 'next' || selected;
  return (
    <MapMarker {...rest} size={size} zIndexOffset={filled ? 900 : state === 'done' ? -100 : rest.zIndexOffset}>
      <div
        className="flex size-full items-center justify-center rounded-full border-2 font-mono text-[12px] leading-none font-semibold tabular"
        style={state === 'done'
          ? { backgroundColor: '#161c18', borderColor: 'rgb(236 239 234 / .18)', color: '#7d8680' }
          : filled
            ? { backgroundColor: color, borderColor: '#0a0e0c', color: '#0a0e0c', boxShadow: `0 0 0 3px ${hexAlpha(color, 0.3)}, 0 6px 14px -6px rgb(0 0 0 / .9)` }
            : { backgroundColor: '#0d120f', borderColor: color, color, boxShadow: '0 3px 10px -3px rgb(0 0 0 / .8)' }}
      >
        {state === 'done' ? <Check aria-hidden className="size-3.5" strokeWidth={3} /> : n}
      </div>
    </MapMarker>
  );
}

/** Garagem / central de coleta (ponto de partida e chegada). */
export function DepotMarker(props: BaseMarkerProps) {
  return (
    <MapMarker label="Central de coleta" tooltip="Central de coleta (início e fim)" {...props} size={34} zIndexOffset={1000}>
      <div className="flex size-full items-center justify-center rounded-[10px] border border-[rgb(236_239_234/0.5)] bg-[#ecefea] text-[#0a0e0c] shadow-[0_6px_16px_-6px_rgb(0_0_0/0.9)]">
        <Warehouse aria-hidden className="size-[18px]" />
      </div>
    </MapMarker>
  );
}

/** Posição atual do usuário (pulso discreto). */
export function PositionMarker(props: BaseMarkerProps) {
  return (
    <MapMarker label="Sua posição" tooltip="Você está aqui" {...props} size={40} zIndexOffset={1100}>
      <div className="relative flex size-full items-center justify-center">
        <span aria-hidden className="ez-pulse absolute size-4 rounded-full bg-[#7cc4f0]" />
        <span aria-hidden className="relative size-3.5 rounded-full border-2 border-[#0a0e0c] bg-[#7cc4f0] shadow-[0_0_0_2px_#7cc4f0]" />
      </div>
    </MapMarker>
  );
}
