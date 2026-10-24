/**
 * Enquadra o mapa num conjunto de pontos de forma robusta:
 * - espera o contêiner ter tamanho real (montagem lazy, modal animado, aba recém-aberta) antes de enquadrar;
 * - chama invalidateSize() antes de cada enquadramento;
 * - re-enquadra quando o CONJUNTO de pontos muda (chave estável) e quando o contêiner muda de tamanho —
 *   a menos que o usuário já tenha arrastado/dado zoom (aí respeitamos a visão dele até o conjunto mudar).
 *
 *   <FitBounds points={[[lat, lon], ...]} padding={48} maxZoom={16} />
 *   const fit = useFitBounds(); fit(points)   // enquadramento sob demanda (ex.: botão "Centralizar")
 */
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useMap } from 'react-leaflet';
import { latLngBounds, type LatLngTuple, type Map as LeafletMap } from 'leaflet';

export interface FitBoundsProps { points: LatLngTuple[]; padding?: number; maxZoom?: number; animate?: boolean }

const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const hasSize = (map: LeafletMap) => { const el = map.getContainer(); return el.clientWidth > 0 && el.clientHeight > 0; };

function fitNow(map: LeafletMap, points: LatLngTuple[], padding: number, maxZoom: number, animate: boolean) {
  if (!points.length) return;
  map.invalidateSize({ pan: false });
  const anim = animate && !reducedMotion();
  if (points.length === 1) map.setView(points[0], Math.min(maxZoom, 15), { animate: anim });
  else {
    // Em contêineres estreitos (celular) o padding fixo "come" o mapa: limita a ~10% do menor lado.
    const el = map.getContainer();
    const pad = Math.max(16, Math.min(padding, Math.round(Math.min(el.clientWidth, el.clientHeight) * 0.1)));
    map.fitBounds(latLngBounds(points), { padding: [pad, pad], maxZoom, animate: anim });
  }
}

export function FitBounds({ points, padding = 48, maxZoom = 16, animate = true }: FitBoundsProps) {
  const map = useMap();
  const pointsRef = useRef(points);
  pointsRef.current = points;
  const userMoved = useRef(false);
  const fitting = useRef(false);
  const key = useMemo(() => points.map(([a, b]) => `${a.toFixed(5)},${b.toFixed(5)}`).sort().join('|'), [points]);

  const fit = useCallback((anim: boolean) => {
    fitting.current = true;
    fitNow(map, pointsRef.current, padding, maxZoom, anim);
    window.setTimeout(() => { fitting.current = false; }, anim ? 450 : 50);
  }, [map, padding, maxZoom]);

  // Conjunto mudou: espera o contêiner ter tamanho e enquadra.
  useEffect(() => {
    if (!pointsRef.current.length) return;
    userMoved.current = false;
    let raf = 0;
    let tries = 0;
    const attempt = (first: boolean) => {
      if (hasSize(map)) { fit(animate && !first); return; }
      if (++tries < 240) raf = requestAnimationFrame(() => attempt(first));
    };
    // 1º enquadramento sem animação (evita "voo" a partir do centro padrão).
    const firstRun = !(map as LeafletMap & { _ezFitted?: boolean })._ezFitted;
    (map as LeafletMap & { _ezFitted?: boolean })._ezFitted = true;
    raf = requestAnimationFrame(() => attempt(firstRun));
    return () => cancelAnimationFrame(raf);
  }, [key, map, fit, animate]);

  // Contêiner mudou de tamanho (rotação, painel, layout): re-enquadra se o usuário não mexeu.
  useEffect(() => {
    const el = map.getContainer();
    let last = { w: el.clientWidth, h: el.clientHeight };
    let raf = 0;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w === last.w && h === last.h) return;
      last = { w, h };
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        map.invalidateSize({ pan: false });
        if (!userMoved.current && w > 0 && h > 0) fit(false);
      });
    });
    ro.observe(el);
    const onUser = () => { if (!fitting.current) userMoved.current = true; };
    map.on('dragstart', onUser);
    map.on('zoomstart', onUser);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); map.off('dragstart', onUser); map.off('zoomstart', onUser); };
  }, [map, fit]);

  return null;
}

export function useFitBounds() {
  const map = useMap();
  return useCallback((points: LatLngTuple[], opts: { padding?: number; maxZoom?: number; animate?: boolean } = {}) => {
    const { padding = 48, maxZoom = 16, animate = true } = opts;
    fitNow(map, points, padding, maxZoom, animate);
  }, [map]);
}
