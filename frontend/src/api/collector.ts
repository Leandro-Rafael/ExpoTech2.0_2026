import { api } from './client';
import type { Route, UUID } from './types';

/** /api/collector — COLLECTOR ou ADMIN. */
export const apiColetor = {
  rotas: () => api.get<Route[]>('/collector/routes'),
  iniciar: (id: UUID) => api.post<Route>(`/collector/routes/${id}/start`),
  concluirParada: (idRota: UUID, idParada: UUID, body: { collectedKg?: number | null } = {}) =>
    api.post<Route>(`/collector/routes/${idRota}/stops/${idParada}/complete`, body),
};
