import { api } from './client';
import type {
  AdminOverview, AdminUser, AuditEntry, Category, CategoryInput, Challenge, ChallengeInput, CollectionPoint,
  CollectionPointInput, CollectionRequest, CollectionRequestStatus, Disposal, DisposalStatus, GeoPoint, Goal,
  GoalInput, Organization, OrganizationType, Page, Reward, RewardInput, Role, Route, RouteOptimization, SmartBin,
  UUID, UserRef,
} from './types';

export interface FiltroUsuariosAdmin { q?: string; role?: Role; page?: number; size?: number }
export interface FiltroDescartesAdmin { status?: DisposalStatus; flagged?: boolean; page?: number; size?: number }
export interface EntradaOtimizarRotas { requestIds: UUID[]; depot?: GeoPoint; vehicleCapacityKg?: number }
export interface EntradaCriarRotas extends EntradaOtimizarRotas { name: string; collectorId?: UUID | null; plannedDate: string }

/** /api/admin — somente ADMIN. */
export interface FiltroAuditoria { page?: number; size?: number; action?: string[]; q?: string }

export const apiAdmin = {
  visaoGeral: () => api.get<AdminOverview>('/admin/overview'),

  usuarios: (params: FiltroUsuariosAdmin = {}) => api.get<Page<AdminUser>>('/admin/users', { query: { ...params } }),
  atualizarUsuario: (id: UUID, body: { role?: Role; enabled?: boolean }) => api.patch<AdminUser>(`/admin/users/${id}`, body),

  descartes: (params: FiltroDescartesAdmin = {}) =>
    api.get<Page<Disposal>>('/admin/disposals', { query: { ...params, flagged: params.flagged || undefined } }),
  aprovarDescarte: (id: UUID, body: { categoryId?: UUID; quantityKg?: number } = {}) =>
    api.post<Disposal>(`/admin/disposals/${id}/approve`, body),
  recusarDescarte: (id: UUID, motivo: string) => api.post<Disposal>(`/admin/disposals/${id}/reject`, { reason: motivo }),

  criarCategoria: (body: CategoryInput) => api.post<Category>('/admin/categories', body),
  atualizarCategoria: (id: UUID, body: CategoryInput) => api.put<Category>(`/admin/categories/${id}`, body),

  criarEcoponto: (body: CollectionPointInput) => api.post<CollectionPoint>('/admin/collection-points', body),
  atualizarEcoponto: (id: UUID, body: CollectionPointInput) => api.put<CollectionPoint>(`/admin/collection-points/${id}`, body),
  excluirEcoponto: (id: UUID) => api.delete(`/admin/collection-points/${id}`),

  /** Todas as recompensas, inclusive inativas. */
  recompensas: () => api.get<Reward[]>('/admin/rewards'),
  /** Todos os ecopontos, inclusive inativos (`?all=true` só vale para ADMIN). */
  ecopontos: () => api.get<CollectionPoint[]>('/collection-points', { query: { all: true } }),
  criarRecompensa: (body: RewardInput) => api.post<Reward>('/admin/rewards', body),
  atualizarRecompensa: (id: UUID, body: RewardInput) => api.put<Reward>(`/admin/rewards/${id}`, body),

  desafios: () => api.get<Challenge[]>('/admin/challenges'),
  criarDesafio: (body: ChallengeInput) => api.post<Challenge>('/admin/challenges', body),
  atualizarDesafio: (id: UUID, body: ChallengeInput) => api.put<Challenge>(`/admin/challenges/${id}`, body),

  organizacoes: () => api.get<Organization[]>('/admin/organizations'),
  criarOrganizacao: (body: { name: string; type: OrganizationType }) => api.post<Organization>('/admin/organizations', body),

  metas: () => api.get<Goal[]>('/admin/goals'),
  criarMeta: (body: GoalInput) => api.post<Goal>('/admin/goals', body),
  atualizarMeta: (id: UUID, body: GoalInput) => api.put<Goal>(`/admin/goals/${id}`, body),

  solicitacoesColeta: (params: { status?: CollectionRequestStatus } = {}) =>
    api.get<CollectionRequest[]>('/admin/collection-requests', { query: { ...params } }),
  coletores: () => api.get<UserRef[]>('/admin/collectors'),
  otimizarRotas: (body: EntradaOtimizarRotas) => api.post<RouteOptimization>('/admin/routes/optimize', body),
  criarRotas: (body: EntradaCriarRotas) => api.post<Route[]>('/admin/routes', body),
  rotas: () => api.get<Route[]>('/admin/routes'),

  lixeiras: () => api.get<SmartBin[]>('/admin/bins'),
  /** `action`: um ou mais códigos (OU); `q`: texto em autor, detalhes, entidade ou IP. */
  auditoria: (params: FiltroAuditoria = {}) =>
    api.get<Page<AuditEntry>>('/admin/audit', { query: { page: params.page, size: params.size, action: params.action, q: params.q } }),

  /** CSV de descartes. `const { blob, filename } = await adminApi.disposalsCsv({ from, to }); saveBlob(blob, filename ?? 'descartes.csv')` */
  descartesCsv: (params: { from?: string; to?: string } = {}) =>
    api.blob('/admin/reports/disposals.csv', { query: { ...params } }),
};
