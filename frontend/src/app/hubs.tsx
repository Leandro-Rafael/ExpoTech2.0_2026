/** Telas que reúnem, em abas, conteúdos de um mesmo assunto. */
// O router aponta /app/descartes, /app/recompensas e /app/admin/* para estes hubs; ?aba= escolhe a aba.
import { lazy } from 'react';
import { useAdminCollectionRequests, useAdminRoutes } from '@/api/queries';
import { TabbedPage } from '@/components/layout/TabbedPage';

const Disposals = lazy(() => import('@/pages/app/DisposalsPage'));
const Impact = lazy(() => import('@/pages/app/ImpactPage'));
const Rewards = lazy(() => import('@/pages/app/RewardsPage'));
const Progress = lazy(() => import('@/pages/app/AchievementsPage'));
const Ranking = lazy(() => import('@/pages/app/RankingPage'));
const AdminOverview = lazy(() => import('@/pages/admin/AdminOverviewPage'));
const AdminAudit = lazy(() => import('@/pages/admin/AdminAuditPage'));
const AdminDisposals = lazy(() => import('@/pages/admin/AdminDisposalsPage'));
const AdminUsers = lazy(() => import('@/pages/admin/AdminUsersPage'));
const AdminCollections = lazy(() => import('@/pages/admin/AdminCollectionsPage'));
const AdminCollectionPoints = lazy(() => import('@/pages/admin/AdminCollectionPointsPage'));
const AdminBins = lazy(() => import('@/pages/admin/AdminBinsPage'));

export function DisposalsHub() {
  return (
    <TabbedPage idBase="hub-dsp" label="Seções de descartes" tabs={[
      { value: 'historico', label: 'Histórico', element: <Disposals /> },
      { value: 'impacto', label: 'Impacto e simulador', element: <Impact /> },
    ]} />
  );
}

export function RewardsHub() {
  return (
    <TabbedPage idBase="hub-rw" label="Seções de recompensas" tabs={[
      { value: 'recompensas', label: 'Recompensas', aliases: ['catalogo', 'resgates'], element: <Rewards /> },
      { value: 'progresso', label: 'Meu progresso', aliases: ['conquistas', 'extrato'], element: <Progress /> },
      { value: 'ranking', label: 'Ranking', element: <Ranking /> },
    ]} />
  );
}

export function AdminOverviewHub() {
  return (
    <TabbedPage idBase="hub-ov" label="Seções da visão geral" tabs={[
      { value: 'painel', label: 'Painel', element: <AdminOverview /> },
      { value: 'auditoria', label: 'Auditoria', element: <AdminAudit /> },
    ]} />
  );
}

export function AdminModerationHub() {
  return (
    <TabbedPage idBase="hub-mod" label="Seções de moderação" tabs={[
      { value: 'descartes', label: 'Descartes', element: <AdminDisposals /> },
      { value: 'usuarios', label: 'Usuários', element: <AdminUsers /> },
    ]} />
  );
}

export function AdminCollectionsHub() {
  const requests = useAdminCollectionRequests();
  const routes = useAdminRoutes();
  return (
    <TabbedPage idBase="hub-col" label="Seções de coletas" tabs={[
      { value: 'planejamento', label: 'Planejamento', count: requests.data?.filter((r) => r.status === 'REQUESTED').length, element: <AdminCollections tab="plan" /> },
      { value: 'rotas', label: 'Rotas', count: routes.data?.length, element: <AdminCollections tab="routes" /> },
      { value: 'ecopontos', label: 'Ecopontos', element: <AdminCollectionPoints /> },
      { value: 'lixeiras', label: 'Lixeiras', element: <AdminBins /> },
    ]} />
  );
}
