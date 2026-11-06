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
import { iconePorNome } from '@/components/icons';
import { corDaCategoria, hexComAlfa } from '@/lib/category';
import { categoriaPadrao } from '@/lib/labels';

export interface PropsMarcadorBase {
  position: LatLngTuple;
  label?: string;
  tooltip?: ReactNode;
  /** Tooltip sempre visível. */
  dicaFixa?: boolean;
  onClick?: (e: LeafletMouseEvent) => void;
  zIndexOffset?: number;
  draggable?: boolean;
  aoSoltar?: (p: LatLngTuple) => void;
}

export interface PropsMarcadorMapa extends PropsMarcadorBase {
  /** Lado do ícone em px (quadrado). */
  size?: number;
  /** Âncora (padrão: centro). Para pinos, use [size/2, size]. */
  ancora?: [number, number];
  children: ReactNode;
}

/** Marcador genérico com conteúdo React. */
export function MarcadorMapa({ position, label, tooltip, dicaFixa, onClick, zIndexOffset, draggable, aoSoltar, size = 28, ancora, children }: PropsMarcadorMapa) {
  const elemento = useMemo(() => document.createElement('div'), []);
  const ax = ancora?.[0];
  const ay = ancora?.[1];
  const icone = useMemo(
    () => divIcon({ html: elemento, className: 'ez-marker', iconSize: [size, size], iconAnchor: [ax ?? size / 2, ay ?? size / 2], tooltipAnchor: [0, -size / 2] }),
    [elemento, size, ax, ay],
  );
  if (label) elemento.setAttribute('aria-label', label);
  const eventos = useMemo(() => ({
    ...(onClick ? { click: onClick } : {}),
    ...(aoSoltar ? { dragend: (e: { target: { getLatLng: () => { lat: number; lng: number } } }) => { const ll = e.target.getLatLng(); aoSoltar([ll.lat, ll.lng]); } } : {}),
  }), [onClick, aoSoltar]);

  return (
    <Marker
      position={position}
      icon={icone}
      title={label}
      keyboard={!!onClick || !!draggable}
      interactive={!!onClick || !!draggable || !!tooltip}
      draggable={draggable}
      zIndexOffset={zIndexOffset}
      eventHandlers={eventos}
      riseOnHover
    >
      {createPortal(children, elemento)}
      {tooltip && (
        <Tooltip className="ez-tooltip" direction="top" offset={[0, -4]} permanent={dicaFixa} opacity={1}>
          {tooltip}
        </Tooltip>
      )}
    </Marker>
  );
}

// ------------------------------------------------------------------ variações

export interface PropsMarcadorCategoria extends PropsMarcadorBase {
  codigo?: CategoryCode | null;
  cor?: string | null;
  icon?: string | null;
  selecionado?: boolean;
  esmaecido?: boolean;
}

/** Círculo tingido com o ícone da categoria. */
export function MarcadorCategoria({ codigo, cor, icon, selecionado, esmaecido, ...rest }: PropsMarcadorCategoria) {
  const hex = corDaCategoria(codigo ?? null, cor);
  const Icone = iconePorNome(icon ?? (codigo ? categoriaPadrao[codigo].icon : null));
  const tamanho = selecionado ? 38 : 32;
  return (
    <MarcadorMapa {...rest} size={tamanho} zIndexOffset={selecionado ? 800 : rest.zIndexOffset}>
      <div
        className="flex size-full items-center justify-center rounded-full border transition-[opacity,transform] duration-200"
        style={{
          color: hex, backgroundColor: '#0d120f', borderColor: hexComAlfa(hex, selecionado ? 0.95 : 0.55),
          boxShadow: selecionado ? `0 0 0 4px ${hexComAlfa(hex, 0.22)}, 0 6px 16px -6px rgb(0 0 0 / .8)` : '0 4px 12px -4px rgb(0 0 0 / .8)',
          opacity: esmaecido ? 0.4 : 1,
        }}
      >
        <Icone aria-hidden className={selecionado ? 'size-[18px]' : 'size-4'} />
      </div>
    </MarcadorMapa>
  );
}

export interface PropsMarcadorPonto extends PropsMarcadorBase {
  cor?: string;
  selecionado?: boolean;
  esmaecido?: boolean;
  /** Diâmetro em px (padrão 14). */
  size?: number;
  /** Anel interno (ex.: lixeira inteligente). */
  anel?: boolean;
}

/** Ponto compacto: bom para muitos itens (solicitações, ecopontos). */
export function MarcadorPonto({ cor = '#34d399', selecionado, esmaecido, size = 14, anel, ...rest }: PropsMarcadorPonto) {
  const areaToque = size + 14; // área de toque maior que o ponto
  return (
    <MarcadorMapa {...rest} size={areaToque} zIndexOffset={selecionado ? 700 : rest.zIndexOffset}>
      <div className="flex size-full items-center justify-center" style={{ opacity: esmaecido ? 0.35 : 1 }}>
        <span
          className="block rounded-full transition-transform duration-200"
          style={{
            width: size, height: size,
            backgroundColor: anel ? '#0d120f' : cor,
            border: `2px solid ${anel ? cor : '#0a0e0c'}`,
            boxShadow: selecionado ? `0 0 0 3px #0a0e0c, 0 0 0 5px ${cor}` : '0 2px 6px rgb(0 0 0 / .7)',
            transform: selecionado ? 'scale(1.15)' : undefined,
          }}
        />
      </div>
    </MarcadorMapa>
  );
}

export interface PropsMarcadorNumerado extends PropsMarcadorBase {
  n: number;
  color?: string;
  /** pending: contorno; next: preenchido (próxima parada); done: apagado com ✓. */
  estado?: 'pending' | 'next' | 'done';
  selecionado?: boolean;
}

/** Parada numerada de rota. */
export function MarcadorNumerado({ n, color = '#34d399', estado = 'pending', selecionado, ...rest }: PropsMarcadorNumerado) {
  const tamanho = estado === 'next' || selecionado ? 32 : 26;
  const preenchido = estado === 'next' || selecionado;
  return (
    <MarcadorMapa {...rest} size={tamanho} zIndexOffset={preenchido ? 900 : estado === 'done' ? -100 : rest.zIndexOffset}>
      <div
        className="flex size-full items-center justify-center rounded-full border-2 font-mono text-[12px] leading-none font-semibold tabular"
        style={estado === 'done'
          ? { backgroundColor: '#161c18', borderColor: 'rgb(236 239 234 / .18)', color: '#7d8680' }
          : preenchido
            ? { backgroundColor: color, borderColor: '#0a0e0c', color: '#0a0e0c', boxShadow: `0 0 0 3px ${hexComAlfa(color, 0.3)}, 0 6px 14px -6px rgb(0 0 0 / .9)` }
            : { backgroundColor: '#0d120f', borderColor: color, color, boxShadow: '0 3px 10px -3px rgb(0 0 0 / .8)' }}
      >
        {estado === 'done' ? <Check aria-hidden className="size-3.5" strokeWidth={3} /> : n}
      </div>
    </MarcadorMapa>
  );
}

/** Garagem / central de coleta (ponto de partida e chegada). */
export function MarcadorCentral(props: PropsMarcadorBase) {
  return (
    <MarcadorMapa label="Central de coleta" tooltip="Central de coleta (início e fim)" {...props} size={34} zIndexOffset={1000}>
      <div className="flex size-full items-center justify-center rounded-[10px] border border-[rgb(236_239_234/0.5)] bg-[#ecefea] text-[#0a0e0c] shadow-[0_6px_16px_-6px_rgb(0_0_0/0.9)]">
        <Warehouse aria-hidden className="size-[18px]" />
      </div>
    </MarcadorMapa>
  );
}

/** Posição atual do usuário (pulso discreto). */
export function MarcadorPosicao(props: PropsMarcadorBase) {
  return (
    <MarcadorMapa label="Sua posição" tooltip="Você está aqui" {...props} size={40} zIndexOffset={1100}>
      <div className="relative flex size-full items-center justify-center">
        <span aria-hidden className="ez-pulse absolute size-4 rounded-full bg-[#7cc4f0]" />
        <span aria-hidden className="relative size-3.5 rounded-full border-2 border-[#0a0e0c] bg-[#7cc4f0] shadow-[0_0_0_2px_#7cc4f0]" />
      </div>
    </MarcadorMapa>
  );
}
