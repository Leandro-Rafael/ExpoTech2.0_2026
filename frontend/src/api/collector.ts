import { api } from './client';
import type { Route, UUID } from './types';

/** /api/collector — COLLECTOR ou ADMIN. */
export const collectorApi = {
  routes: () => api.get<Route[]>('/collector/routes'),
  start: (id: UUID) => api.post<Route>(`/collector/routes/${id}/start`),
  completeStop: (routeId: UUID, stopId: UUID, body: { collectedKg?: number | null } = {}) =>
    api.post<Route>(`/collector/routes/${routeId}/stops/${stopId}/complete`, body),
};
