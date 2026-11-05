/**
 * Mapas (Leaflet). Importe SOMENTE em páginas lazy — este módulo puxa o leaflet e o CSS dele.
 *
 *   import { MapView, CategoryMarker, NumberedMarker, DepotMarker, RoutePolyline, LocationPicker, toLatLng } from '@/components/map';
 *
 * Ver o comentário no topo de cada arquivo para exemplos de uso.
 */
export { MapView, type LatLngTuple } from './MapView';
export { FitBounds } from './FitBounds';
export { CategoryMarker, DotMarker, NumberedMarker, DepotMarker, PositionMarker } from './markers';
export { RoutePolyline } from './RoutePolyline';
export { LocationPicker } from './LocationPicker';
