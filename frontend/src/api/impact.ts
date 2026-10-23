import { api } from './client';
import type { ImpactSummary, PublicStats, SimulationInput, SimulationResult } from './types';

/** Impacto ambiental. `publicStats` não exige login (landing page). */
export const impactApi = {
  publicStats: () => api.get<PublicStats>('/public/stats', { skipRefresh: true, silent401: true }),
  summary: (params: { scope?: 'ME' | 'COMMUNITY'; months?: number } = {}) =>
    api.get<ImpactSummary>('/impact/summary', { query: { ...params } }),
  simulate: (body: SimulationInput) => api.post<SimulationResult>('/impact/simulate', body),
};
