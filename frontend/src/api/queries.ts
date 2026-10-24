/**
 * React Query: fábrica de chaves (`qk`) + hooks prontos para TODAS as rotas.
 *
 * Páginas devem usar apenas estes hooks:
 *   const { data, isPending, error } = useDisposals({ status: 'PENDING', page: 0 });
 *   const create = useCreateDisposal();  create.mutate({ body, idempotencyKey });
 *
 * Mutações já invalidam as queries afetadas (e o usuário, quando pontos mudam).
 * Para toasts, use `onSuccess`/`onError` no `mutate(..., { onSuccess })` da página.
 */
import {
  keepPreviousData, useMutation, useQuery, useQueryClient,
  type QueryClient, type UseQueryOptions,
} from '@tanstack/react-query';
import { authApi } from './auth';
import { adminApi, type AdminDisposalsParams, type AdminUsersParams, type AuditQuery, type CreateRoutesInput, type OptimizeRoutesInput } from './admin';
import { categoriesApi } from './catalog';
import { collectionApi, type CollectionPointParams } from './collection';
import { collectorApi } from './collector';
import { disposalsApi, type DisposalListParams } from './disposals';
import { gamificationApi } from './gamification';
import { householdApi, type CreateBinInput, type CreateHouseholdInput } from './household';
import { impactApi } from './impact';
import { photosApi } from './photos';
import { profileApi, type ChangePasswordInput, type UpdateProfileInput } from './profile';
import { rewardsApi } from './rewards';
import type { ApiError } from './client';
import type {
  CategoryInput, ChallengeInput, CollectionPointInput, CollectionRequestStatus, CreateCollectionRequest,
  CreateDisposal, GoalInput, OrganizationType, RankingPeriod, RankingScope, RewardInput, Role,
  SimulationInput, UUID, UserMe,
} from './types';

// ------------------------------------------------------------------ chaves

export const qk = {
  me: ['auth', 'me'] as const,
  organizations: ['organizations'] as const,
  categories: (all = false) => ['categories', { all }] as const,
  disposals: {
    all: ['disposals'] as const,
    list: (p: DisposalListParams) => ['disposals', 'list', p] as const,
    detail: (id: UUID) => ['disposals', 'detail', id] as const,
  },
  points: {
    all: ['points'] as const,
    transactions: (p: { page?: number; size?: number }) => ['points', 'transactions', p] as const,
  },
  gamification: ['gamification', 'summary'] as const,
  ranking: (scope: RankingScope, period: RankingPeriod) => ['ranking', scope, period] as const,
  rewards: ['rewards'] as const,
  redemptions: ['redemptions'] as const,
  collectionPoints: (p: CollectionPointParams) => ['collection-points', p] as const,
  collectionRequests: ['collection-requests', 'mine'] as const,
  household: ['household'] as const,
  bins: ['household', 'bins'] as const,
  publicStats: ['public', 'stats'] as const,
  impact: (scope: 'ME' | 'COMMUNITY', months: number) => ['impact', scope, months] as const,
  collectorRoutes: ['collector', 'routes'] as const,
  admin: {
    all: ['admin'] as const,
    overview: ['admin', 'overview'] as const,
    users: (p: AdminUsersParams) => ['admin', 'users', p] as const,
    disposals: (p: AdminDisposalsParams) => ['admin', 'disposals', p] as const,
    challenges: ['admin', 'challenges'] as const,
    /** Sob ['rewards'] para ser invalidada junto com a lista pública. */
    rewards: ['rewards', 'admin-all'] as const,
    /** Sob ['collection-points'] para ser invalidada pelas mutações de ecoponto. */
    collectionPoints: ['collection-points', 'admin-all'] as const,
    organizations: ['admin', 'organizations'] as const,
    goals: ['admin', 'goals'] as const,
    collectionRequests: (status?: CollectionRequestStatus) => ['admin', 'collection-requests', status ?? 'ALL'] as const,
    collectors: ['admin', 'collectors'] as const,
    routes: ['admin', 'routes'] as const,
    bins: ['admin', 'bins'] as const,
    audit: (p: AuditQuery) => ['admin', 'audit', p] as const,
  },
};

type QOpts<T> = Omit<UseQueryOptions<T, ApiError>, 'queryKey' | 'queryFn'>;

/** Recarrega o usuário (pontos/nível mudaram). */
export function refreshMe(qc: QueryClient) {
  return qc.invalidateQueries({ queryKey: qk.me });
}
export function setMe(qc: QueryClient, user: UserMe | null) {
  qc.setQueryData(qk.me, user);
}

// ------------------------------------------------------------------ catálogo / perfil

export const useCategories = (opts: { all?: boolean } = {}, q?: QOpts<Awaited<ReturnType<typeof categoriesApi.list>>>) =>
  useQuery({ queryKey: qk.categories(!!opts.all), queryFn: () => categoriesApi.list(opts), staleTime: 10 * 60_000, ...q });

export const useOrganizations = () =>
  useQuery({ queryKey: qk.organizations, queryFn: profileApi.organizations, staleTime: 10 * 60_000 });

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation<UserMe, ApiError, UpdateProfileInput>({
    mutationFn: profileApi.update,
    onSuccess: (user) => setMe(qc, user),
  });
}
export const useChangePassword = () =>
  useMutation<void, ApiError, ChangePasswordInput>({ mutationFn: profileApi.changePassword });

// ------------------------------------------------------------------ fotos / descartes

export const useUploadPhoto = () =>
  useMutation({ mutationFn: (file: File | Blob) => photosApi.upload(file) });

export const useDisposals = (params: DisposalListParams = {}) =>
  useQuery({ queryKey: qk.disposals.list(params), queryFn: () => disposalsApi.list(params), placeholderData: keepPreviousData });

export const useDisposal = (id: UUID | undefined) =>
  useQuery({ queryKey: qk.disposals.detail(id ?? ''), queryFn: () => disposalsApi.get(id!), enabled: !!id });

export function useCreateDisposal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ body, idempotencyKey }: { body: CreateDisposal; idempotencyKey: string }) =>
      disposalsApi.create(body, idempotencyKey),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.disposals.all });
      qc.invalidateQueries({ queryKey: qk.gamification });
      qc.invalidateQueries({ queryKey: ['impact'] });
    },
  });
}

// ------------------------------------------------------------------ gamificação

export const usePointTransactions = (params: { page?: number; size?: number } = {}) =>
  useQuery({ queryKey: qk.points.transactions(params), queryFn: () => gamificationApi.transactions(params), placeholderData: keepPreviousData });

export const useGamificationSummary = () =>
  useQuery({ queryKey: qk.gamification, queryFn: gamificationApi.summary });

export const useRanking = (scope: RankingScope = 'USER', period: RankingPeriod = 'MONTH') =>
  useQuery({ queryKey: qk.ranking(scope, period), queryFn: () => gamificationApi.ranking({ scope, period }), placeholderData: keepPreviousData });

// ------------------------------------------------------------------ recompensas

export const useRewards = () => useQuery({ queryKey: qk.rewards, queryFn: rewardsApi.list });
export const useRedemptions = () => useQuery({ queryKey: qk.redemptions, queryFn: rewardsApi.redemptions });

export function useRedeemReward() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rewardId: UUID) => rewardsApi.redeem(rewardId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.rewards });
      qc.invalidateQueries({ queryKey: qk.redemptions });
      qc.invalidateQueries({ queryKey: qk.points.all });
      qc.invalidateQueries({ queryKey: qk.gamification });
      refreshMe(qc);
    },
  });
}

// ------------------------------------------------------------------ ecopontos / coletas

export const useCollectionPoints = (params: CollectionPointParams = {}) =>
  useQuery({ queryKey: qk.collectionPoints(params), queryFn: () => collectionApi.points(params), placeholderData: keepPreviousData, staleTime: 5 * 60_000 });

export const useMyCollectionRequests = () =>
  useQuery({ queryKey: qk.collectionRequests, queryFn: collectionApi.myRequests });

export function useCreateCollectionRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateCollectionRequest) => collectionApi.createRequest(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.collectionRequests }),
  });
}
export function useCancelCollectionRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: UUID) => collectionApi.cancelRequest(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.collectionRequests }),
  });
}

// ------------------------------------------------------------------ residência / lixeiras

export const useHousehold = () => useQuery({ queryKey: qk.household, queryFn: householdApi.get });
/** Lixeiras da casa. Atualiza a cada `refetchInterval` ms (pausa com a aba oculta). */
export const useHouseholdBins = (enabled = true, refetchInterval: number | false = 20_000) =>
  useQuery({ queryKey: qk.bins, queryFn: householdApi.bins, enabled, refetchInterval, refetchIntervalInBackground: false });

function useHouseholdMutation<TVars, TData>(fn: (v: TVars) => Promise<TData>) {
  const qc = useQueryClient();
  return useMutation<TData, ApiError, TVars>({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.household });
      refreshMe(qc);
    },
  });
}
export const useCreateHousehold = () => useHouseholdMutation((b: CreateHouseholdInput) => householdApi.create(b));
export const useJoinHousehold = () => useHouseholdMutation((code: string) => householdApi.join(code));
export const useLeaveHousehold = () => useHouseholdMutation((_: void) => householdApi.leave());
export const useCreateBin = () => useHouseholdMutation((b: CreateBinInput) => householdApi.createBin(b));
export const useDeleteBin = () => useHouseholdMutation((id: UUID) => householdApi.deleteBin(id));
export const useSendBinReading = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { device: { deviceId: string; deviceKey: string }; reading: { fillLevel: number; batteryLevel: number } }) =>
      householdApi.sendReading(v.device, v.reading),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.bins }),
  });
};

// ------------------------------------------------------------------ impacto

export const usePublicStats = () =>
  useQuery({ queryKey: qk.publicStats, queryFn: impactApi.publicStats, staleTime: 5 * 60_000, retry: 0 });

export const useImpactSummary = (scope: 'ME' | 'COMMUNITY' = 'ME', months = 12) =>
  useQuery({ queryKey: qk.impact(scope, months), queryFn: () => impactApi.summary({ scope, months }), placeholderData: keepPreviousData });

export const useSimulate = () => useMutation({ mutationFn: (input: SimulationInput) => impactApi.simulate(input) });

// ------------------------------------------------------------------ coletor

export const useCollectorRoutes = () => useQuery({ queryKey: qk.collectorRoutes, queryFn: collectorApi.routes });

function useCollectorMutation<TVars>(fn: (v: TVars) => ReturnType<typeof collectorApi.start>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.collectorRoutes });
      qc.invalidateQueries({ queryKey: qk.admin.routes });
    },
  });
}
export const useStartRoute = () => useCollectorMutation((id: UUID) => collectorApi.start(id));
export const useCompleteStop = () =>
  useCollectorMutation((v: { routeId: UUID; stopId: UUID; collectedKg?: number | null }) =>
    collectorApi.completeStop(v.routeId, v.stopId, { collectedKg: v.collectedKg }));

// ------------------------------------------------------------------ admin (queries)

export const useAdminOverview = () => useQuery({ queryKey: qk.admin.overview, queryFn: adminApi.overview, refetchInterval: 60_000 });
export const useAdminUsers = (p: AdminUsersParams = {}) =>
  useQuery({ queryKey: qk.admin.users(p), queryFn: () => adminApi.users(p), placeholderData: keepPreviousData });
export const useAdminDisposals = (p: AdminDisposalsParams = {}) =>
  useQuery({ queryKey: qk.admin.disposals(p), queryFn: () => adminApi.disposals(p), placeholderData: keepPreviousData });
export const useAdminRewards = () => useQuery({ queryKey: qk.admin.rewards, queryFn: adminApi.rewards });
export const useAdminCollectionPoints = () => useQuery({ queryKey: qk.admin.collectionPoints, queryFn: adminApi.collectionPoints });
export const useAdminChallenges = () => useQuery({ queryKey: qk.admin.challenges, queryFn: adminApi.challenges });
export const useAdminOrganizations = () => useQuery({ queryKey: qk.admin.organizations, queryFn: adminApi.organizations });
export const useAdminGoals = () => useQuery({ queryKey: qk.admin.goals, queryFn: adminApi.goals });
export const useAdminCollectionRequests = (status?: CollectionRequestStatus) =>
  useQuery({ queryKey: qk.admin.collectionRequests(status), queryFn: () => adminApi.collectionRequests({ status }) });
export const useAdminCollectors = () => useQuery({ queryKey: qk.admin.collectors, queryFn: adminApi.collectors, staleTime: 5 * 60_000 });
export const useAdminRoutes = () => useQuery({ queryKey: qk.admin.routes, queryFn: adminApi.routes });
export const useAdminBins = () => useQuery({ queryKey: qk.admin.bins, queryFn: adminApi.bins, refetchInterval: 30_000 });
export const useAdminAudit = (p: AuditQuery = {}) =>
  useQuery({ queryKey: qk.admin.audit(p), queryFn: () => adminApi.audit(p), placeholderData: keepPreviousData });

// ------------------------------------------------------------------ admin (mutações)

/** Mutação admin genérica: invalida as chaves dadas ao terminar com sucesso. */
function useAdminMutation<TVars, TData>(fn: (v: TVars) => Promise<TData>, invalidate: readonly (readonly unknown[])[]) {
  const qc = useQueryClient();
  return useMutation<TData, ApiError, TVars>({
    mutationFn: fn,
    onSuccess: () => {
      invalidate.forEach((queryKey) => qc.invalidateQueries({ queryKey }));
      qc.invalidateQueries({ queryKey: qk.admin.overview });
    },
  });
}

export const useUpdateAdminUser = () =>
  useAdminMutation((v: { id: UUID; role?: Role; enabled?: boolean }) => adminApi.updateUser(v.id, { role: v.role, enabled: v.enabled }), [['admin', 'users']]);

export const useApproveDisposal = () =>
  useAdminMutation((v: { id: UUID; categoryId?: UUID; quantityKg?: number }) =>
    adminApi.approveDisposal(v.id, { categoryId: v.categoryId, quantityKg: v.quantityKg }), [['admin', 'disposals'], qk.disposals.all]);
export const useRejectDisposal = () =>
  useAdminMutation((v: { id: UUID; reason: string }) => adminApi.rejectDisposal(v.id, v.reason), [['admin', 'disposals'], qk.disposals.all]);

export const useSaveCategory = () =>
  useAdminMutation((v: { id?: UUID; body: CategoryInput }) =>
    v.id ? adminApi.updateCategory(v.id, v.body) : adminApi.createCategory(v.body), [['categories']]);

export const useSaveCollectionPoint = () =>
  useAdminMutation((v: { id?: UUID; body: CollectionPointInput }) =>
    v.id ? adminApi.updateCollectionPoint(v.id, v.body) : adminApi.createCollectionPoint(v.body), [['collection-points']]);
export const useDeleteCollectionPoint = () =>
  useAdminMutation((id: UUID) => adminApi.deleteCollectionPoint(id), [['collection-points']]);

export const useSaveReward = () =>
  useAdminMutation((v: { id?: UUID; body: RewardInput }) =>
    v.id ? adminApi.updateReward(v.id, v.body) : adminApi.createReward(v.body), [qk.rewards]);

export const useSaveChallenge = () =>
  useAdminMutation((v: { id?: UUID; body: ChallengeInput }) =>
    v.id ? adminApi.updateChallenge(v.id, v.body) : adminApi.createChallenge(v.body), [qk.admin.challenges, qk.gamification]);

export const useCreateOrganization = () =>
  useAdminMutation((b: { name: string; type: OrganizationType }) => adminApi.createOrganization(b), [qk.admin.organizations, qk.organizations]);

export const useSaveGoal = () =>
  useAdminMutation((v: { id?: UUID; body: GoalInput }) =>
    v.id ? adminApi.updateGoal(v.id, v.body) : adminApi.createGoal(v.body), [qk.admin.goals, ['impact']]);

export const useOptimizeRoutes = () => useMutation<Awaited<ReturnType<typeof adminApi.optimizeRoutes>>, ApiError, OptimizeRoutesInput>({ mutationFn: adminApi.optimizeRoutes });
export const useCreateRoutes = () =>
  useAdminMutation((b: CreateRoutesInput) => adminApi.createRoutes(b), [qk.admin.routes, ['admin', 'collection-requests'], qk.collectorRoutes]);

/** Exposto para o AuthProvider. */
export { authApi };
