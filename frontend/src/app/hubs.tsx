/** Telas que reúnem, em abas, conteúdos de um mesmo assunto. */
// O router aponta /app/descartes, /app/recompensas e /app/admin/* para estes hubs; ?aba= escolhe a aba.
import { lazy } from 'react';
import { useSolicitacoesColetaAdmin, useRotasAdmin } from '@/api/queries';
import { PaginaComAbas } from '@/components/layout/TabbedPage';

const Descartes = lazy(() => import('@/pages/app/DisposalsPage'));
const Impacto = lazy(() => import('@/pages/app/ImpactPage'));
const Recompensas = lazy(() => import('@/pages/app/RewardsPage'));
const Progresso = lazy(() => import('@/pages/app/AchievementsPage'));
const Ranking = lazy(() => import('@/pages/app/RankingPage'));
const AdminVisaoGeral = lazy(() => import('@/pages/admin/AdminOverviewPage'));
const AdminAuditoria = lazy(() => import('@/pages/admin/AdminAuditPage'));
const AdminDescartes = lazy(() => import('@/pages/admin/AdminDisposalsPage'));
const AdminUsuarios = lazy(() => import('@/pages/admin/AdminUsersPage'));
const AdminColetas = lazy(() => import('@/pages/admin/AdminCollectionsPage'));
const AdminEcopontos = lazy(() => import('@/pages/admin/AdminCollectionPointsPage'));
const AdminLixeiras = lazy(() => import('@/pages/admin/AdminBinsPage'));

export function DisposalsHub() {
  return (
    <PaginaComAbas idBase="hub-dsp" label="Seções de descartes" abas={[
      { value: 'historico', label: 'Histórico', elemento: <Descartes /> },
      { value: 'impacto', label: 'Impacto e simulador', elemento: <Impacto /> },
    ]} />
  );
}

export function RewardsHub() {
  return (
    <PaginaComAbas idBase="hub-rw" label="Seções de recompensas" abas={[
      { value: 'recompensas', label: 'Recompensas', apelidos: ['catalogo', 'resgates'], elemento: <Recompensas /> },
      { value: 'progresso', label: 'Meu progresso', apelidos: ['conquistas', 'extrato'], elemento: <Progresso /> },
      { value: 'ranking', label: 'Ranking', elemento: <Ranking /> },
    ]} />
  );
}

export function AdminOverviewHub() {
  return (
    <PaginaComAbas idBase="hub-ov" label="Seções da visão geral" abas={[
      { value: 'painel', label: 'Painel', elemento: <AdminVisaoGeral /> },
      { value: 'auditoria', label: 'Auditoria', elemento: <AdminAuditoria /> },
    ]} />
  );
}

export function AdminModerationHub() {
  return (
    <PaginaComAbas idBase="hub-mod" label="Seções de moderação" abas={[
      { value: 'descartes', label: 'Descartes', elemento: <AdminDescartes /> },
      { value: 'usuarios', label: 'Usuários', elemento: <AdminUsuarios /> },
    ]} />
  );
}

export function AdminCollectionsHub() {
  const solicitacoes = useSolicitacoesColetaAdmin();
  const rotas = useRotasAdmin();
  return (
    <PaginaComAbas idBase="hub-col" label="Seções de coletas" abas={[
      { value: 'planejamento', label: 'Planejamento', count: solicitacoes.data?.filter((r) => r.status === 'REQUESTED').length, elemento: <AdminColetas aba="plan" /> },
      { value: 'rotas', label: 'Rotas', count: rotas.data?.length, elemento: <AdminColetas aba="routes" /> },
      { value: 'ecopontos', label: 'Ecopontos', elemento: <AdminEcopontos /> },
      { value: 'lixeiras', label: 'Lixeiras', elemento: <AdminLixeiras /> },
    ]} />
  );
}
