import { api } from './client';
import type { Category } from './types';

/** /api/categories — `all=true` só para ADMIN (inclui inativas). */
export const apiCategorias = {
  listar: (opcoes: { all?: boolean } = {}) => api.get<Category[]>('/categories', { query: { all: opcoes.all || undefined }, silent401: !opcoes.all }),
};
