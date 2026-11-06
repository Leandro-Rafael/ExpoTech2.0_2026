import { api } from './client';
import type { Organization, UUID, UserMe } from './types';

export interface EntradaAtualizarPerfil { name?: string; organizationId?: UUID | null }
export interface EntradaTrocarSenha { currentPassword: string; newPassword: string }

/** /api/me e /api/organizations */
export const apiPerfil = {
  atualizar: (body: EntradaAtualizarPerfil) => api.patch<UserMe>('/me', body),
  trocarSenha: (body: EntradaTrocarSenha) => api.post<void>('/me/password', body),
  organizacoes: () => api.get<Organization[]>('/organizations'),
};
