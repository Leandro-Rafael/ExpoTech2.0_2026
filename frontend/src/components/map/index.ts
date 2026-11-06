/**
 * Mapas (Leaflet). Importe SOMENTE em páginas lazy — este módulo puxa o leaflet e o CSS dele.
 *
 *   import { MapView, CategoryMarker, NumberedMarker, DepotMarker, RoutePolyline, LocationPicker, toLatLng } from '@/components/map';
 *
 * Ver o comentário no topo de cada arquivo para exemplos de uso.
 */
export { Mapa as MapView, type LatLngTuple } from './MapView';
export { Enquadrar as FitBounds } from './FitBounds';
export { MarcadorCategoria as CategoryMarker, MarcadorPonto as DotMarker, MarcadorNumerado as NumberedMarker, MarcadorCentral as DepotMarker, MarcadorPosicao as PositionMarker } from './markers';
export { LinhaRota as RoutePolyline } from './RoutePolyline';
export { SeletorLocal as LocationPicker } from './LocationPicker';
