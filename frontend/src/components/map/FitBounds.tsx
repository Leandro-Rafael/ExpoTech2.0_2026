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

export interface PropsEnquadrar { pontos: LatLngTuple[]; padding?: number; maxZoom?: number; animate?: boolean }

const movimentoReduzido = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const temTamanho = (mapa: LeafletMap) => { const el = mapa.getContainer(); return el.clientWidth > 0 && el.clientHeight > 0; };

function enquadrarAgora(mapa: LeafletMap, pontos: LatLngTuple[], padding: number, maxZoom: number, animate: boolean) {
  if (!pontos.length) return;
  mapa.invalidateSize({ pan: false });
  const animar = animate && !movimentoReduzido();
  if (pontos.length === 1) mapa.setView(pontos[0], Math.min(maxZoom, 15), { animate: animar });
  else {
    // Em contêineres estreitos (celular) o padding fixo "come" o mapa: limita a ~10% do menor lado.
    const el = mapa.getContainer();
    const pad = Math.max(16, Math.min(padding, Math.round(Math.min(el.clientWidth, el.clientHeight) * 0.1)));
    mapa.fitBounds(latLngBounds(pontos), { padding: [pad, pad], maxZoom, animate: animar });
  }
}

export function Enquadrar({ pontos, padding = 48, maxZoom = 16, animate = true }: PropsEnquadrar) {
  const mapa = useMap();
  const pontosRef = useRef(pontos);
  pontosRef.current = pontos;
  const usuarioMexeu = useRef(false);
  const enquadrando = useRef(false);
  const chave = useMemo(() => pontos.map(([a, b]) => `${a.toFixed(5)},${b.toFixed(5)}`).sort().join('|'), [pontos]);

  const enquadrar = useCallback((animar: boolean) => {
    enquadrando.current = true;
    enquadrarAgora(mapa, pontosRef.current, padding, maxZoom, animar);
    window.setTimeout(() => { enquadrando.current = false; }, animar ? 450 : 50);
  }, [mapa, padding, maxZoom]);

  // Conjunto mudou: espera o contêiner ter tamanho e enquadra.
  useEffect(() => {
    if (!pontosRef.current.length) return;
    usuarioMexeu.current = false;
    let raf = 0;
    let tentativas = 0;
    const tentar = (primeira: boolean) => {
      if (temTamanho(mapa)) { enquadrar(animate && !primeira); return; }
      if (++tentativas < 240) raf = requestAnimationFrame(() => tentar(primeira));
    };
    // 1º enquadramento sem animação (evita "voo" a partir do centro padrão).
    const primeiraVez = !(mapa as LeafletMap & { _ezFitted?: boolean })._ezFitted;
    (mapa as LeafletMap & { _ezFitted?: boolean })._ezFitted = true;
    raf = requestAnimationFrame(() => tentar(primeiraVez));
    return () => cancelAnimationFrame(raf);
  }, [chave, mapa, enquadrar, animate]);

  // Contêiner mudou de tamanho (rotação, painel, layout): re-enquadra se o usuário não mexeu.
  useEffect(() => {
    const elemento = mapa.getContainer();
    let ultimo = { w: elemento.clientWidth, h: elemento.clientHeight };
    let raf = 0;
    const ro = new ResizeObserver(() => {
      const w = elemento.clientWidth;
      const h = elemento.clientHeight;
      if (w === ultimo.w && h === ultimo.h) return;
      ultimo = { w, h };
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        mapa.invalidateSize({ pan: false });
        if (!usuarioMexeu.current && w > 0 && h > 0) enquadrar(false);
      });
    });
    ro.observe(elemento);
    const aoUsuarioMexer = () => { if (!enquadrando.current) usuarioMexeu.current = true; };
    mapa.on('dragstart', aoUsuarioMexer);
    mapa.on('zoomstart', aoUsuarioMexer);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); mapa.off('dragstart', aoUsuarioMexer); mapa.off('zoomstart', aoUsuarioMexer); };
  }, [mapa, enquadrar]);

  return null;
}

