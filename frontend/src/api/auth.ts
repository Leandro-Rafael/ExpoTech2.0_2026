import { api, garantirCsrf } from './client';
import type { UserMe } from './types';

export interface EntradaLogin { email: string; password: string }
export interface EntradaCadastro { name: string; email: string; password: string }

/** /api/auth — sessão por cookies HttpOnly. */
export const apiAuth = {
  csrf: () => garantirCsrf(true),
  me: () => api.get<UserMe>('/auth/me', { silent401: true }),
  /** Boot: 200 UserMe, ou `undefined` (204) para visitante — sem 401 no console de quem não entrou. */
  sessao: () => api.get<UserMe | undefined>('/auth/session', { silent401: true }),
  login: (body: EntradaLogin) => api.post<UserMe>('/auth/login', body, { skipRefresh: true }),
  cadastrar: (body: EntradaCadastro) => api.post<UserMe>('/auth/register', body, { skipRefresh: true }),
  renovar: () => api.post<UserMe>('/auth/refresh', undefined, { skipRefresh: true, silent401: true }),
  logout: () => api.post<void>('/auth/logout', undefined, { skipRefresh: true, silent401: true }),
};
