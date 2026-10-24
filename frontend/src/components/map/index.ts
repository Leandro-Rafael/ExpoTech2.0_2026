/**
 * Mapas (Leaflet). Importe SOMENTE em páginas lazy — este módulo puxa o leaflet e o CSS dele.
 *
 *   import { MapView, CategoryMarker, NumberedMarker, DepotMarker, RoutePolyline, LocationPicker, toLatLng } from '@/components/map';
 *
 * Ver o comentário no topo de cada arquivo para exemplos de uso.
 */
export { MapView, DEFAULT_CENTER, TILE_URL, TILE_ATTRIBUTION, TILES_DARK, toLatLng, type MapViewProps, type LatLon, type LatLngTuple } from './MapView';
export { FitBounds, useFitBounds } from './FitBounds';
export { MapMarker, CategoryMarker, DotMarker, NumberedMarker, DepotMarker, PositionMarker } from './markers';
export { RoutePolyline } from './RoutePolyline';
export { LocationPicker } from './LocationPicker';
