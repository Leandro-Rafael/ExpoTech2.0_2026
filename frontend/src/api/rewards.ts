import { api } from './client';
import type { Redemption, Reward, UUID } from './types';

/** /api/rewards e /api/redemptions */
export const apiRecompensas = {
  listar: () => api.get<Reward[]>('/rewards'),
  resgatar: (id: UUID) => api.post<Redemption>(`/rewards/${id}/redeem`),
  resgates: () => api.get<Redemption[]>('/redemptions'),
};
