/**
 * Enquadra o mapa num conjunto de pontos. Só re-enquadra quando o CONJUNTO muda
 * (chave estável), não a cada render — o usuário pode dar zoom/arrastar à vontade.
 *
 *   <FitBounds points={[[lat, lon], ...]} padding={48} maxZoom={16} />
 *   const fit = useFitBounds(); fit(points)   // enquadramento sob demanda (ex.: botão "Centralizar")
 */
import { useCallback, useEffect, useMemo } from 'react';
import { useMap } from 'react-leaflet';
import { latLngBounds, type LatLngTuple } from 'leaflet';

export interface FitBoundsProps { points: LatLngTuple[]; padding?: number; maxZoom?: number; animate?: boolean }

export function FitBounds({ points, padding = 48, maxZoom = 16, animate = true }: FitBoundsProps) {
  const fit = useFitBounds();
  const key = useMemo(() => points.map(([a, b]) => `${a.toFixed(5)},${b.toFixed(5)}`).sort().join('|'), [points]);
  useEffect(() => {
    if (points.length) fit(points, { padding, maxZoom, animate });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, padding, maxZoom]);
  return null;
}

export function useFitBounds() {
  const map = useMap();
  return useCallback((points: LatLngTuple[], opts: { padding?: number; maxZoom?: number; animate?: boolean } = {}) => {
    if (!points.length) return;
    const { padding = 48, maxZoom = 16, animate = true } = opts;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (points.length === 1) {
      map.setView(points[0], Math.min(maxZoom, 15), { animate: animate && !reduced });
      return;
    }
    map.fitBounds(latLngBounds(points), { padding: [padding, padding], maxZoom, animate: animate && !reduced });
  }, [map]);
}
