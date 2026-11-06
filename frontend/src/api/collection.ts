import { api } from './client';
import type { CategoryCode, CollectionPoint, CollectionRequest, CreateCollectionRequest, UUID } from './types';

export interface FiltroEcopontos { lat?: number; lon?: number; radiusKm?: number; category?: CategoryCode }

/** Ecopontos (/api/collection-points) e solicitações de coleta (/api/collection-requests). */
export const apiColeta = {
  ecopontos: (params: FiltroEcopontos = {}) => api.get<CollectionPoint[]>('/collection-points', { query: { ...params }, silent401: true }),
  criarSolicitacao: (body: CreateCollectionRequest) => api.post<CollectionRequest>('/collection-requests', body),
  minhasSolicitacoes: () => api.get<CollectionRequest[]>('/collection-requests'),
  cancelarSolicitacao: (id: UUID) => api.post<CollectionRequest>(`/collection-requests/${id}/cancel`),
};
