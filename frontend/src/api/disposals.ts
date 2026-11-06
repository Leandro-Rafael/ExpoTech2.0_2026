import { api, novaChaveIdempotencia } from './client';
import type { CreateDisposal, Disposal, DisposalStatus, Page, UUID } from './types';

export interface FiltroDescartes { status?: DisposalStatus; page?: number; size?: number }

/** /api/disposals — descartes do usuário logado. */
export const apiDescartes = {
  /** Sempre passe a MESMA idempotencyKey em re-tentativas da mesma submissão. */
  criar: (body: CreateDisposal, chaveIdempotencia: string = novaChaveIdempotencia()) =>
    api.post<Disposal>('/disposals', body, { idempotencyKey: chaveIdempotencia }),
  listar: (params: FiltroDescartes = {}) => api.get<Page<Disposal>>('/disposals', { query: { ...params } }),
  obter: (id: UUID) => api.get<Disposal>(`/disposals/${id}`),
};
