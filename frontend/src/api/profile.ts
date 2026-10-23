import { api } from './client';
import type { Organization, UUID, UserMe } from './types';

export interface UpdateProfileInput { name?: string; organizationId?: UUID | null }
export interface ChangePasswordInput { currentPassword: string; newPassword: string }

/** /api/me e /api/organizations */
export const profileApi = {
  update: (body: UpdateProfileInput) => api.patch<UserMe>('/me', body),
  changePassword: (body: ChangePasswordInput) => api.post<void>('/me/password', body),
  organizations: () => api.get<Organization[]>('/organizations'),
};
