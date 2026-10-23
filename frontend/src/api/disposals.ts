import { api, newIdempotencyKey } from './client';
import type { CreateDisposal, Disposal, DisposalStatus, Page, UUID } from './types';

export interface DisposalListParams { status?: DisposalStatus; page?: number; size?: number }

/** /api/disposals — descartes do usuário logado. */
export const disposalsApi = {
  /** Sempre passe a MESMA idempotencyKey em re-tentativas da mesma submissão. */
  create: (body: CreateDisposal, idempotencyKey: string = newIdempotencyKey()) =>
    api.post<Disposal>('/disposals', body, { idempotencyKey }),
  list: (params: DisposalListParams = {}) => api.get<Page<Disposal>>('/disposals', { query: { ...params } }),
  get: (id: UUID) => api.get<Disposal>(`/disposals/${id}`),
};
