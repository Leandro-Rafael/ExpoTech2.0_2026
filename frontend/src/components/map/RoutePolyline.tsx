/**
 * Linha de rota com "contorno" escuro para contraste sobre os tiles.
 *
 *   <RoutePolyline positions={[depot, ...stops, depot]} color="#34d399" />
 *   <RoutePolyline positions={naive} variant="ghost" />      // comparação (tracejado cinza)
 *   <RoutePolyline positions={done} variant="done" />        // trecho já percorrido
 */
import { Polyline } from 'react-leaflet';
import type { LatLngTuple } from 'leaflet';

export interface RoutePolylineProps {
  positions: LatLngTuple[];
  color?: string;
  variant?: 'solid' | 'ghost' | 'done';
  weight?: number;
  /** Destaca (mais espessa) — ex.: rota selecionada. */
  emphasis?: boolean;
  /** Atenua (rotas não selecionadas). */
  muted?: boolean;
}

export function RoutePolyline({ positions, color = '#34d399', variant = 'solid', weight, emphasis, muted }: RoutePolylineProps) {
  if (positions.length < 2) return null;
  if (variant === 'ghost') {
    return (
      <Polyline
        positions={positions}
        interactive={false}
        pathOptions={{ color: '#c8cec9', weight: weight ?? 2, opacity: muted ? 0.25 : 0.55, dashArray: '4 8', lineCap: 'round', lineJoin: 'round', className: 'ez-route-naive' }}
      />
    );
  }
  const w = weight ?? (emphasis ? 5 : 3.5);
  const c = variant === 'done' ? '#7d8680' : color;
  const opacity = muted ? 0.35 : variant === 'done' ? 0.6 : 0.95;
  return (
    <>
      <Polyline positions={positions} interactive={false} pathOptions={{ color: '#050706', weight: w + 4, opacity: muted ? 0.3 : 0.7, lineCap: 'round', lineJoin: 'round' }} />
      <Polyline positions={positions} interactive={false} pathOptions={{ color: c, weight: w, opacity, lineCap: 'round', lineJoin: 'round', dashArray: variant === 'done' ? '1 7' : undefined }} />
    </>
  );
}
