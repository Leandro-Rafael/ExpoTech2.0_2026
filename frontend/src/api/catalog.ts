import { api } from './client';
import type { Category } from './types';

/** /api/categories — `all=true` só para ADMIN (inclui inativas). */
export const categoriesApi = {
  list: (opts: { all?: boolean } = {}) => api.get<Category[]>('/categories', { query: { all: opts.all || undefined } }),
};
