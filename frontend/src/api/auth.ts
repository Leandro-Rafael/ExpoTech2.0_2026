import { api, ensureCsrf } from './client';
import type { UserMe } from './types';

export interface LoginInput { email: string; password: string }
export interface RegisterInput { name: string; email: string; password: string }

/** /api/auth — sessão por cookies HttpOnly. */
export const authApi = {
  csrf: () => ensureCsrf(true),
  me: () => api.get<UserMe>('/auth/me', { silent401: true }),
  login: (body: LoginInput) => api.post<UserMe>('/auth/login', body, { skipRefresh: true }),
  register: (body: RegisterInput) => api.post<UserMe>('/auth/register', body, { skipRefresh: true }),
  refresh: () => api.post<UserMe>('/auth/refresh', undefined, { skipRefresh: true, silent401: true }),
  logout: () => api.post<void>('/auth/logout', undefined, { skipRefresh: true, silent401: true }),
};
