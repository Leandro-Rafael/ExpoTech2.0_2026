import { api } from './client';
import type { GamificationSummary, Page, PointTransaction, Ranking, RankingPeriod, RankingScope } from './types';

/** Pontos, níveis, medalhas, desafios e ranking. */
export const apiGamificacao = {
  transacoes: (params: { page?: number; size?: number } = {}) =>
    api.get<Page<PointTransaction>>('/points/transactions', { query: { ...params } }),
  resumo: () => api.get<GamificationSummary>('/gamification/summary'),
  ranking: (params: { scope?: RankingScope; period?: RankingPeriod } = {}) =>
    api.get<Ranking>('/ranking', { query: { ...params } }),
};
