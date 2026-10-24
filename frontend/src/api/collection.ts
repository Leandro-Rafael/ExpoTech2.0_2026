import { api } from './client';
import type { CategoryCode, CollectionPoint, CollectionRequest, CreateCollectionRequest, UUID } from './types';

export interface CollectionPointParams { lat?: number; lon?: number; radiusKm?: number; category?: CategoryCode }

/** Ecopontos (/api/collection-points) e solicitações de coleta (/api/collection-requests). */
export const collectionApi = {
  points: (params: CollectionPointParams = {}) => api.get<CollectionPoint[]>('/collection-points', { query: { ...params }, silent401: true }),
  createRequest: (body: CreateCollectionRequest) => api.post<CollectionRequest>('/collection-requests', body),
  myRequests: () => api.get<CollectionRequest[]>('/collection-requests'),
  cancelRequest: (id: UUID) => api.post<CollectionRequest>(`/collection-requests/${id}/cancel`),
};
