import { useCallback, useEffect, useRef, useState } from 'react';

export interface GeoState {
  status: 'idle' | 'loading' | 'success' | 'error' | 'unsupported';
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  error: string | null;
}

const ERRORS: Record<number, string> = {
  1: 'Permissão de localização negada. Habilite-a nas configurações do navegador.',
  2: 'Não foi possível determinar sua localização.',
  3: 'A localização demorou demais para responder.',
};

/**
 * Localização do navegador sob demanda.
 *   const geo = useGeolocation();          // não pede permissão até chamar request()
 *   const geo = useGeolocation({ auto: true }); // pede ao montar
 */
export function useGeolocation(options: { auto?: boolean; highAccuracy?: boolean } = {}) {
  const { auto = false, highAccuracy = true } = options;
  const supported = typeof navigator !== 'undefined' && 'geolocation' in navigator;
  const [state, setState] = useState<GeoState>({
    status: supported ? 'idle' : 'unsupported', latitude: null, longitude: null, accuracy: null,
    error: supported ? null : 'Seu navegador não suporta geolocalização.',
  });
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  const request = useCallback(() => {
    if (!supported) return;
    setState((s) => ({ ...s, status: 'loading', error: null }));
    navigator.geolocation.getCurrentPosition(
      (pos) => mounted.current && setState({
        status: 'success', latitude: pos.coords.latitude, longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy, error: null,
      }),
      (err) => mounted.current && setState((s) => ({ ...s, status: 'error', error: ERRORS[err.code] ?? err.message })),
      { enableHighAccuracy: highAccuracy, timeout: 12000, maximumAge: 60000 },
    );
  }, [supported, highAccuracy]);

  useEffect(() => { if (auto) request(); }, [auto, request]);

  return { ...state, request, supported };
}
