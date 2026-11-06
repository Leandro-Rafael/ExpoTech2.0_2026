import { useCallback, useEffect, useRef, useState } from 'react';

export interface EstadoGeo {
  status: 'idle' | 'loading' | 'success' | 'error' | 'unsupported';
  latitude: number | null;
  longitude: number | null;
  precisao: number | null;
  erro: string | null;
}

const ERROS: Record<number, string> = {
  1: 'Permissão de localização negada. Habilite-a nas configurações do navegador.',
  2: 'Não foi possível determinar sua localização.',
  3: 'A localização demorou demais para responder.',
};

/**
 * Localização do navegador sob demanda.
 *   const geo = useGeolocation();          // não pede permissão até chamar request()
 *   const geo = useGeolocation({ auto: true }); // pede ao montar
 */
export function useGeolocalizacao(opcoes: { auto?: boolean; highAccuracy?: boolean } = {}) {
  const { auto = false, highAccuracy = true } = opcoes;
  const suportado = typeof navigator !== 'undefined' && 'geolocation' in navigator;
  const [estado, setEstado] = useState<EstadoGeo>({
    status: suportado ? 'idle' : 'unsupported', latitude: null, longitude: null, precisao: null,
    erro: suportado ? null : 'Seu navegador não suporta geolocalização.',
  });
  const montado = useRef(true);
  useEffect(() => () => { montado.current = false; }, []);

  const solicitar = useCallback(() => {
    if (!suportado) return;
    setEstado((s) => ({ ...s, status: 'loading', erro: null }));
    navigator.geolocation.getCurrentPosition(
      (posicao) => montado.current && setEstado({
        status: 'success', latitude: posicao.coords.latitude, longitude: posicao.coords.longitude,
        precisao: posicao.coords.accuracy, erro: null,
      }),
      (falha) => montado.current && setEstado((s) => ({ ...s, status: 'error', erro: ERROS[falha.code] ?? falha.message })),
      { enableHighAccuracy: highAccuracy, timeout: 12000, maximumAge: 60000 },
    );
  }, [suportado, highAccuracy]);

  useEffect(() => { if (auto) solicitar(); }, [auto, solicitar]);

  return { ...estado, request: solicitar, supported: suportado };
}
