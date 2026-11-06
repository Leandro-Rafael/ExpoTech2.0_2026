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
import { apiAdmin, type FiltroDescartesAdmin, type FiltroUsuariosAdmin, type FiltroAuditoria, type EntradaCriarRotas, type EntradaOtimizarRotas } from './admin';
import { apiCategorias } from './catalog';
import { apiColeta, type FiltroEcopontos } from './collection';
import { apiColetor } from './collector';
import { apiDescartes, type FiltroDescartes } from './disposals';
import { apiGamificacao } from './gamification';
import { apiResidencia, type EntradaCriarLixeira, type EntradaCriarResidencia } from './household';
import { apiImpacto } from './impact';
import { apiFotos } from './photos';
import { apiPerfil, type EntradaTrocarSenha, type EntradaAtualizarPerfil } from './profile';
import { apiRecompensas } from './rewards';
import type { ErroApi } from './client';
import type {
  CategoryInput, ChallengeInput, CollectionPointInput, CollectionRequestStatus, CreateCollectionRequest,
  CreateDisposal, GoalInput, OrganizationType, RankingPeriod, RankingScope, RewardInput, Role,
  SimulationInput, UUID, UserMe,
} from './types';

// ------------------------------------------------------------------ chaves

export const qk = {
  me: ['auth', 'me'] as const,
  organizations: ['organizations'] as const,
  categories: (todos = false) => ['categories', { all: todos }] as const,
  disposals: {
    all: ['disposals'] as const,
    list: (p: FiltroDescartes) => ['disposals', 'list', p] as const,
    detail: (id: UUID) => ['disposals', 'detail', id] as const,
  },
  points: {
    all: ['points'] as const,
    transactions: (p: { page?: number; size?: number }) => ['points', 'transactions', p] as const,
  },
  gamification: ['gamification', 'summary'] as const,
  ranking: (escopo: RankingScope, periodo: RankingPeriod) => ['ranking', escopo, periodo] as const,
  rewards: ['rewards'] as const,
  redemptions: ['redemptions'] as const,
  collectionPoints: (p: FiltroEcopontos) => ['collection-points', p] as const,
  collectionRequests: ['collection-requests', 'mine'] as const,
  household: ['household'] as const,
  bins: ['household', 'bins'] as const,
  publicStats: ['public', 'stats'] as const,
  impact: (escopo: 'ME' | 'COMMUNITY', meses: number) => ['impact', escopo, meses] as const,
  collectorRoutes: ['collector', 'routes'] as const,
  admin: {
    all: ['admin'] as const,
    overview: ['admin', 'overview'] as const,
    users: (p: FiltroUsuariosAdmin) => ['admin', 'users', p] as const,
    disposals: (p: FiltroDescartesAdmin) => ['admin', 'disposals', p] as const,
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
    audit: (p: FiltroAuditoria) => ['admin', 'audit', p] as const,
  },
};

type OpcoesConsulta<T> = Omit<UseQueryOptions<T, ErroApi>, 'queryKey' | 'queryFn'>;

/** Recarrega o usuário (pontos/nível mudaram). */
export function recarregarUsuario(qc: QueryClient) {
  return qc.invalidateQueries({ queryKey: qk.me });
}
function definirUsuario(qc: QueryClient, usuario: UserMe | null) {
  qc.setQueryData(qk.me, usuario);
}

// ------------------------------------------------------------------ catálogo / perfil

export const useCategorias = (opcoes: { all?: boolean } = {}, q?: OpcoesConsulta<Awaited<ReturnType<typeof apiCategorias.listar>>>) =>
  useQuery({ queryKey: qk.categories(!!opcoes.all), queryFn: () => apiCategorias.listar(opcoes), staleTime: 10 * 60_000, ...q });

export const useOrganizacoes = () =>
  useQuery({ queryKey: qk.organizations, queryFn: apiPerfil.organizacoes, staleTime: 10 * 60_000 });

export function useAtualizarPerfil() {
  const qc = useQueryClient();
  return useMutation<UserMe, ErroApi, EntradaAtualizarPerfil>({
    mutationFn: apiPerfil.atualizar,
    onSuccess: (usuario) => definirUsuario(qc, usuario),
  });
}
export const useTrocarSenha = () =>
  useMutation<void, ErroApi, EntradaTrocarSenha>({ mutationFn: apiPerfil.trocarSenha });

// ------------------------------------------------------------------ fotos / descartes

export const useEnviarFoto = () =>
  useMutation({ mutationFn: (arquivo: File | Blob) => apiFotos.enviar(arquivo) });

export const useDescartes = (params: FiltroDescartes = {}) =>
  useQuery({ queryKey: qk.disposals.list(params), queryFn: () => apiDescartes.listar(params), placeholderData: keepPreviousData });

export const useDescarte = (id: UUID | undefined) =>
  useQuery({ queryKey: qk.disposals.detail(id ?? ''), queryFn: () => apiDescartes.obter(id!), enabled: !!id });

export function useCriarDescarte() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ body, idempotencyKey: chaveIdempotencia }: { body: CreateDisposal; idempotencyKey: string }) =>
      apiDescartes.criar(body, chaveIdempotencia),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.disposals.all });
      qc.invalidateQueries({ queryKey: qk.gamification });
      qc.invalidateQueries({ queryKey: ['impact'] });
    },
  });
}

// ------------------------------------------------------------------ gamificação

export const useExtratoPontos = (params: { page?: number; size?: number } = {}) =>
  useQuery({ queryKey: qk.points.transactions(params), queryFn: () => apiGamificacao.transacoes(params), placeholderData: keepPreviousData });

export const useResumoGamificacao = () =>
  useQuery({ queryKey: qk.gamification, queryFn: apiGamificacao.resumo });

export const useRanking = (escopo: RankingScope = 'USER', periodo: RankingPeriod = 'MONTH') =>
  useQuery({ queryKey: qk.ranking(escopo, periodo), queryFn: () => apiGamificacao.ranking({ scope: escopo, period: periodo }), placeholderData: keepPreviousData });

// ------------------------------------------------------------------ recompensas

export const useRecompensas = () => useQuery({ queryKey: qk.rewards, queryFn: apiRecompensas.listar });
export const useResgates = () => useQuery({ queryKey: qk.redemptions, queryFn: apiRecompensas.resgates });

export function useResgatarRecompensa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (idRecompensa: UUID) => apiRecompensas.resgatar(idRecompensa),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.rewards });
      qc.invalidateQueries({ queryKey: qk.redemptions });
      qc.invalidateQueries({ queryKey: qk.points.all });
      qc.invalidateQueries({ queryKey: qk.gamification });
      recarregarUsuario(qc);
    },
  });
}

// ------------------------------------------------------------------ ecopontos / coletas

export const useEcopontos = (params: FiltroEcopontos = {}) =>
  useQuery({ queryKey: qk.collectionPoints(params), queryFn: () => apiColeta.ecopontos(params), placeholderData: keepPreviousData, staleTime: 5 * 60_000 });

export const useMinhasSolicitacoesColeta = () =>
  useQuery({ queryKey: qk.collectionRequests, queryFn: apiColeta.minhasSolicitacoes });

export function useCriarSolicitacaoColeta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateCollectionRequest) => apiColeta.criarSolicitacao(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.collectionRequests }),
  });
}
export function useCancelarSolicitacaoColeta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: UUID) => apiColeta.cancelarSolicitacao(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.collectionRequests }),
  });
}

// ------------------------------------------------------------------ residência / lixeiras

export const useResidencia = () => useQuery({ queryKey: qk.household, queryFn: apiResidencia.obter });
/** Lixeiras da casa. Atualiza a cada `refetchInterval` ms (pausa com a aba oculta). */
export const useLixeirasResidencia = (ativo = true, intervaloAtualizacao: number | false = 20_000) =>
  useQuery({ queryKey: qk.bins, queryFn: apiResidencia.lixeiras, enabled: ativo, refetchInterval: intervaloAtualizacao, refetchIntervalInBackground: false });

function useMutacaoResidencia<TVars, TData>(fn: (v: TVars) => Promise<TData>) {
  const qc = useQueryClient();
  return useMutation<TData, ErroApi, TVars>({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.household });
      recarregarUsuario(qc);
    },
  });
}
export const useCriarResidencia = () => useMutacaoResidencia((b: EntradaCriarResidencia) => apiResidencia.criar(b));
export const useEntrarResidencia = () => useMutacaoResidencia((codigo: string) => apiResidencia.entrar(codigo));
export const useSairResidencia = () => useMutacaoResidencia((_: void) => apiResidencia.sair());
export const useCriarLixeira = () => useMutacaoResidencia((b: EntradaCriarLixeira) => apiResidencia.criarLixeira(b));
export const useExcluirLixeira = () => useMutacaoResidencia((id: UUID) => apiResidencia.excluirLixeira(id));
export const useEnviarLeituraLixeira = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { device: { deviceId: string; deviceKey: string }; reading: { fillLevel: number; batteryLevel: number } }) =>
      apiResidencia.enviarLeitura(v.device, v.reading),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.bins }),
  });
};

// ------------------------------------------------------------------ impacto

export const useEstatisticasPublicas = () =>
  useQuery({ queryKey: qk.publicStats, queryFn: apiImpacto.estatisticasPublicas, staleTime: 5 * 60_000, retry: 0 });

export const useResumoImpacto = (escopo: 'ME' | 'COMMUNITY' = 'ME', meses = 12) =>
  useQuery({ queryKey: qk.impact(escopo, meses), queryFn: () => apiImpacto.resumo({ scope: escopo, months: meses }), placeholderData: keepPreviousData });

export const useSimular = () => useMutation({ mutationFn: (entrada: SimulationInput) => apiImpacto.simular(entrada) });

// ------------------------------------------------------------------ coletor

export const useRotasColetor = () => useQuery({ queryKey: qk.collectorRoutes, queryFn: apiColetor.rotas });

function useMutacaoColetor<TVars>(fn: (v: TVars) => ReturnType<typeof apiColetor.iniciar>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.collectorRoutes });
      qc.invalidateQueries({ queryKey: qk.admin.routes });
    },
  });
}
export const useIniciarRota = () => useMutacaoColetor((id: UUID) => apiColetor.iniciar(id));
export const useConcluirParada = () =>
  useMutacaoColetor((v: { routeId: UUID; stopId: UUID; collectedKg?: number | null }) =>
    apiColetor.concluirParada(v.routeId, v.stopId, { collectedKg: v.collectedKg }));

// ------------------------------------------------------------------ admin (queries)

export const useVisaoGeralAdmin = () => useQuery({ queryKey: qk.admin.overview, queryFn: apiAdmin.visaoGeral, refetchInterval: 60_000 });
export const useUsuariosAdmin = (p: FiltroUsuariosAdmin = {}) =>
  useQuery({ queryKey: qk.admin.users(p), queryFn: () => apiAdmin.usuarios(p), placeholderData: keepPreviousData });
export const useDescartesAdmin = (p: FiltroDescartesAdmin = {}) =>
  useQuery({ queryKey: qk.admin.disposals(p), queryFn: () => apiAdmin.descartes(p), placeholderData: keepPreviousData });
export const useRecompensasAdmin = () => useQuery({ queryKey: qk.admin.rewards, queryFn: apiAdmin.recompensas });
export const useEcopontosAdmin = () => useQuery({ queryKey: qk.admin.collectionPoints, queryFn: apiAdmin.ecopontos });
export const useDesafiosAdmin = () => useQuery({ queryKey: qk.admin.challenges, queryFn: apiAdmin.desafios });
export const useOrganizacoesAdmin = () => useQuery({ queryKey: qk.admin.organizations, queryFn: apiAdmin.organizacoes });
export const useMetasAdmin = () => useQuery({ queryKey: qk.admin.goals, queryFn: apiAdmin.metas });
export const useSolicitacoesColetaAdmin = (status?: CollectionRequestStatus) =>
  useQuery({ queryKey: qk.admin.collectionRequests(status), queryFn: () => apiAdmin.solicitacoesColeta({ status }) });
export const useColetoresAdmin = () => useQuery({ queryKey: qk.admin.collectors, queryFn: apiAdmin.coletores, staleTime: 5 * 60_000 });
export const useRotasAdmin = () => useQuery({ queryKey: qk.admin.routes, queryFn: apiAdmin.rotas });
export const useLixeirasAdmin = () => useQuery({ queryKey: qk.admin.bins, queryFn: apiAdmin.lixeiras, refetchInterval: 30_000 });
export const useAuditoriaAdmin = (p: FiltroAuditoria = {}) =>
  useQuery({ queryKey: qk.admin.audit(p), queryFn: () => apiAdmin.auditoria(p), placeholderData: keepPreviousData });

// ------------------------------------------------------------------ admin (mutações)

/** Mutação admin genérica: invalida as chaves dadas ao terminar com sucesso. */
function useMutacaoAdmin<TVars, TData>(fn: (v: TVars) => Promise<TData>, invalidar: readonly (readonly unknown[])[]) {
  const qc = useQueryClient();
  return useMutation<TData, ErroApi, TVars>({
    mutationFn: fn,
    onSuccess: () => {
      invalidar.forEach((queryKey) => qc.invalidateQueries({ queryKey }));
      qc.invalidateQueries({ queryKey: qk.admin.overview });
    },
  });
}

export const useAtualizarUsuarioAdmin = () =>
  useMutacaoAdmin((v: { id: UUID; role?: Role; enabled?: boolean }) => apiAdmin.atualizarUsuario(v.id, { role: v.role, enabled: v.enabled }), [['admin', 'users']]);

export const useAprovarDescarte = () =>
  useMutacaoAdmin((v: { id: UUID; categoryId?: UUID; quantityKg?: number }) =>
    apiAdmin.aprovarDescarte(v.id, { categoryId: v.categoryId, quantityKg: v.quantityKg }), [['admin', 'disposals'], qk.disposals.all]);
export const useRecusarDescarte = () =>
  useMutacaoAdmin((v: { id: UUID; reason: string }) => apiAdmin.recusarDescarte(v.id, v.reason), [['admin', 'disposals'], qk.disposals.all]);

export const useSalvarCategoria = () =>
  useMutacaoAdmin((v: { id?: UUID; body: CategoryInput }) =>
    v.id ? apiAdmin.atualizarCategoria(v.id, v.body) : apiAdmin.criarCategoria(v.body), [['categories']]);

export const useSalvarEcoponto = () =>
  useMutacaoAdmin((v: { id?: UUID; body: CollectionPointInput }) =>
    v.id ? apiAdmin.atualizarEcoponto(v.id, v.body) : apiAdmin.criarEcoponto(v.body), [['collection-points']]);
export const useExcluirEcoponto = () =>
  useMutacaoAdmin((id: UUID) => apiAdmin.excluirEcoponto(id), [['collection-points']]);

export const useSalvarRecompensa = () =>
  useMutacaoAdmin((v: { id?: UUID; body: RewardInput }) =>
    v.id ? apiAdmin.atualizarRecompensa(v.id, v.body) : apiAdmin.criarRecompensa(v.body), [qk.rewards]);

export const useSalvarDesafio = () =>
  useMutacaoAdmin((v: { id?: UUID; body: ChallengeInput }) =>
    v.id ? apiAdmin.atualizarDesafio(v.id, v.body) : apiAdmin.criarDesafio(v.body), [qk.admin.challenges, qk.gamification]);

export const useCriarOrganizacao = () =>
  useMutacaoAdmin((b: { name: string; type: OrganizationType }) => apiAdmin.criarOrganizacao(b), [qk.admin.organizations, qk.organizations]);

export const useSalvarMeta = () =>
  useMutacaoAdmin((v: { id?: UUID; body: GoalInput }) =>
    v.id ? apiAdmin.atualizarMeta(v.id, v.body) : apiAdmin.criarMeta(v.body), [qk.admin.goals, ['impact']]);

export const useOtimizarRotas = () => useMutation<Awaited<ReturnType<typeof apiAdmin.otimizarRotas>>, ErroApi, EntradaOtimizarRotas>({ mutationFn: apiAdmin.otimizarRotas });
export const useCriarRotas = () =>
  useMutacaoAdmin((b: EntradaCriarRotas) => apiAdmin.criarRotas(b), [qk.admin.routes, ['admin', 'collection-requests'], qk.collectorRoutes]);