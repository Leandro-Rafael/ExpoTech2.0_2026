import { api } from './client';
import type { Redemption, Reward, UUID } from './types';

/** /api/rewards e /api/redemptions */
export const rewardsApi = {
  list: () => api.get<Reward[]>('/rewards'),
  redeem: (id: UUID) => api.post<Redemption>(`/rewards/${id}/redeem`),
  redemptions: () => api.get<Redemption[]>('/redemptions'),
};
