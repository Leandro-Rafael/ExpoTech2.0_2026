import type { GeoPoint } from '@/api/types';

/** Distância em km entre dois pontos (fórmula de Haversine). */
export function distanciaHaversineKm(a: GeoPoint, b: GeoPoint): number {
  const R = 6371;
  const paraRad = (d: number) => (d * Math.PI) / 180;
  const dLat = paraRad(b.latitude - a.latitude);
  const dLon = paraRad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(paraRad(a.latitude)) * Math.cos(paraRad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Central de coleta (Taboão da Serra) — mesma do back-end. */
export const DEPOSITO_PADRAO: GeoPoint = { latitude: -23.6019, longitude: -46.7526 };

/** Coordenadas aproximadas dos bairros usados na demo. */
const BAIRROS: Record<string, GeoPoint> = {
  'Jardim Maria Rosa': { latitude: -23.6040, longitude: -46.7555 },
  'Parque Pinheiros': { latitude: -23.6125, longitude: -46.7680 },
  'Centro': { latitude: -23.6225, longitude: -46.7835 },
  'Jardim Record': { latitude: -23.6175, longitude: -46.7800 },
  'Vila Iasi': { latitude: -23.6070, longitude: -46.7750 },
  'Jardim Helena': { latitude: -23.6150, longitude: -46.7600 },
  'Vila Sônia': { latitude: -23.5935, longitude: -46.7405 },
  'Jardim Mituzi': { latitude: -23.6300, longitude: -46.7760 },
  'Jardim Santa Rosa': { latitude: -23.6100, longitude: -46.7475 },
  'Jardim Bonfiglioli': { latitude: -23.5865, longitude: -46.7335 },
  'Parque Laguna': { latitude: -23.6200, longitude: -46.7925 },
  'Jardim Umarizal': { latitude: -23.6285, longitude: -46.7485 },
};

const CENTRO_CIDADE: GeoPoint = { latitude: -23.6090, longitude: -46.7580 };

export function pontoDoBairro(nome: string): GeoPoint {
  return BAIRROS[nome] ?? CENTRO_CIDADE;
}
