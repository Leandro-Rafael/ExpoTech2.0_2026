import { api } from './client';
import type {
  AdminOverview, AdminUser, AuditEntry, Category, CategoryInput, Challenge, ChallengeInput, CollectionPoint,
  CollectionPointInput, CollectionRequest, CollectionRequestStatus, Disposal, DisposalStatus, GeoPoint, Goal,
  GoalInput, Organization, OrganizationType, Page, Reward, RewardInput, Role, Route, RouteOptimization, SmartBin,
  UUID, UserRef,
} from './types';

export interface AdminUsersParams { q?: string; role?: Role; page?: number; size?: number }
export interface AdminDisposalsParams { status?: DisposalStatus; flagged?: boolean; page?: number; size?: number }
export interface OptimizeRoutesInput { requestIds: UUID[]; depot?: GeoPoint; vehicleCapacityKg?: number }
export interface CreateRoutesInput extends OptimizeRoutesInput { name: string; collectorId?: UUID | null; plannedDate: string }

/** /api/admin — somente ADMIN. */
export const adminApi = {
  overview: () => api.get<AdminOverview>('/admin/overview'),

  users: (params: AdminUsersParams = {}) => api.get<Page<AdminUser>>('/admin/users', { query: { ...params } }),
  updateUser: (id: UUID, body: { role?: Role; enabled?: boolean }) => api.patch<AdminUser>(`/admin/users/${id}`, body),

  disposals: (params: AdminDisposalsParams = {}) =>
    api.get<Page<Disposal>>('/admin/disposals', { query: { ...params, flagged: params.flagged || undefined } }),
  approveDisposal: (id: UUID, body: { categoryId?: UUID; quantityKg?: number } = {}) =>
    api.post<Disposal>(`/admin/disposals/${id}/approve`, body),
  rejectDisposal: (id: UUID, reason: string) => api.post<Disposal>(`/admin/disposals/${id}/reject`, { reason }),

  createCategory: (body: CategoryInput) => api.post<Category>('/admin/categories', body),
  updateCategory: (id: UUID, body: CategoryInput) => api.put<Category>(`/admin/categories/${id}`, body),

  createCollectionPoint: (body: CollectionPointInput) => api.post<CollectionPoint>('/admin/collection-points', body),
  updateCollectionPoint: (id: UUID, body: CollectionPointInput) => api.put<CollectionPoint>(`/admin/collection-points/${id}`, body),
  deleteCollectionPoint: (id: UUID) => api.delete(`/admin/collection-points/${id}`),

  createReward: (body: RewardInput) => api.post<Reward>('/admin/rewards', body),
  updateReward: (id: UUID, body: RewardInput) => api.put<Reward>(`/admin/rewards/${id}`, body),

  challenges: () => api.get<Challenge[]>('/admin/challenges'),
  createChallenge: (body: ChallengeInput) => api.post<Challenge>('/admin/challenges', body),
  updateChallenge: (id: UUID, body: ChallengeInput) => api.put<Challenge>(`/admin/challenges/${id}`, body),

  organizations: () => api.get<Organization[]>('/admin/organizations'),
  createOrganization: (body: { name: string; type: OrganizationType }) => api.post<Organization>('/admin/organizations', body),

  goals: () => api.get<Goal[]>('/admin/goals'),
  createGoal: (body: GoalInput) => api.post<Goal>('/admin/goals', body),
  updateGoal: (id: UUID, body: GoalInput) => api.put<Goal>(`/admin/goals/${id}`, body),

  collectionRequests: (params: { status?: CollectionRequestStatus } = {}) =>
    api.get<CollectionRequest[]>('/admin/collection-requests', { query: { ...params } }),
  collectors: () => api.get<UserRef[]>('/admin/collectors'),
  optimizeRoutes: (body: OptimizeRoutesInput) => api.post<RouteOptimization>('/admin/routes/optimize', body),
  createRoutes: (body: CreateRoutesInput) => api.post<Route[]>('/admin/routes', body),
  routes: () => api.get<Route[]>('/admin/routes'),

  bins: () => api.get<SmartBin[]>('/admin/bins'),
  audit: (params: { page?: number; size?: number } = {}) => api.get<Page<AuditEntry>>('/admin/audit', { query: { ...params } }),

  /** CSV de descartes. `const { blob, filename } = await adminApi.disposalsCsv({ from, to }); saveBlob(blob, filename ?? 'descartes.csv')` */
  disposalsCsv: (params: { from?: string; to?: string } = {}) =>
    api.blob('/admin/reports/disposals.csv', { query: { ...params } }),
};
