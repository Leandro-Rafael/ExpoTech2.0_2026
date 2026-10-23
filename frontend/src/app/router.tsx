/**
 * Rotas da aplicação. Todas as páginas são carregadas sob demanda (code-splitting).
 * Para adicionar uma página: crie o arquivo em src/pages/..., registre aqui com `page(() => import(...))`
 * e, se precisar de menu, adicione em src/app/navigation.ts.
 */
import { lazy, Suspense, type ComponentType, type LazyExoticComponent } from 'react';
import { createBrowserRouter, Outlet } from 'react-router';
import { RedirectIfAuthenticated, RequireAuth, RequireRole } from '@/auth/guards';
import { AppShell } from '@/components/layout/AppShell';
import { RouteErrorPage } from '@/components/layout/ErrorBoundary';
import { FullscreenLoader } from '@/components/layout/FullscreenLoader';

type Loader = () => Promise<{ default: ComponentType }>;
const page = (loader: Loader): LazyExoticComponent<ComponentType> => lazy(loader);

// Públicas
const LandingPage = page(() => import('@/pages/public/LandingPage'));
const LoginPage = page(() => import('@/pages/public/LoginPage'));
const RegisterPage = page(() => import('@/pages/public/RegisterPage'));
const NotFoundPage = page(() => import('@/pages/public/NotFoundPage'));

// Morador
const DashboardPage = page(() => import('@/pages/app/DashboardPage'));
const NewDisposalPage = page(() => import('@/pages/app/NewDisposalPage'));
const DisposalsPage = page(() => import('@/pages/app/DisposalsPage'));
const RewardsPage = page(() => import('@/pages/app/RewardsPage'));
const AchievementsPage = page(() => import('@/pages/app/AchievementsPage'));
const RankingPage = page(() => import('@/pages/app/RankingPage'));
const MapPage = page(() => import('@/pages/app/MapPage'));
const HomePage = page(() => import('@/pages/app/HomePage'));
const ImpactPage = page(() => import('@/pages/app/ImpactPage'));
const ProfilePage = page(() => import('@/pages/app/ProfilePage'));

// Coletor
const CollectorRoutesPage = page(() => import('@/pages/collector/CollectorRoutesPage'));

// Admin
const AdminOverviewPage = page(() => import('@/pages/admin/AdminOverviewPage'));
const AdminDisposalsPage = page(() => import('@/pages/admin/AdminDisposalsPage'));
const AdminUsersPage = page(() => import('@/pages/admin/AdminUsersPage'));
const AdminCollectionsPage = page(() => import('@/pages/admin/AdminCollectionsPage'));
const AdminCollectionPointsPage = page(() => import('@/pages/admin/AdminCollectionPointsPage'));
const AdminCatalogPage = page(() => import('@/pages/admin/AdminCatalogPage'));
const AdminBinsPage = page(() => import('@/pages/admin/AdminBinsPage'));
const AdminAuditPage = page(() => import('@/pages/admin/AdminAuditPage'));

/** Layout das páginas públicas (sem shell). */
function PublicLayout() {
  return (
    <Suspense fallback={<FullscreenLoader />}>
      <Outlet />
    </Suspense>
  );
}

export const router = createBrowserRouter([
  {
    errorElement: <RouteErrorPage />,
    children: [
      {
        element: <PublicLayout />,
        children: [
          { index: true, element: <LandingPage /> },
          { path: 'entrar', element: <RedirectIfAuthenticated><LoginPage /></RedirectIfAuthenticated> },
          { path: 'cadastro', element: <RedirectIfAuthenticated><RegisterPage /></RedirectIfAuthenticated> },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
      {
        path: 'app',
        element: <RequireAuth><AppShell /></RequireAuth>,
        children: [
          { index: true, element: <DashboardPage /> },
          { path: 'descartar', element: <NewDisposalPage /> },
          { path: 'descartes', element: <DisposalsPage /> },
          { path: 'recompensas', element: <RewardsPage /> },
          { path: 'conquistas', element: <AchievementsPage /> },
          { path: 'ranking', element: <RankingPage /> },
          { path: 'mapa', element: <MapPage /> },
          { path: 'casa', element: <HomePage /> },
          { path: 'impacto', element: <ImpactPage /> },
          { path: 'perfil', element: <ProfilePage /> },
          {
            path: 'coletor',
            element: <RequireRole roles={['COLLECTOR', 'ADMIN']} />,
            children: [{ index: true, element: <CollectorRoutesPage /> }],
          },
          {
            path: 'admin',
            element: <RequireRole roles={['ADMIN']} />,
            children: [
              { index: true, element: <AdminOverviewPage /> },
              { path: 'descartes', element: <AdminDisposalsPage /> },
              { path: 'usuarios', element: <AdminUsersPage /> },
              { path: 'coletas', element: <AdminCollectionsPage /> },
              { path: 'ecopontos', element: <AdminCollectionPointsPage /> },
              { path: 'catalogo', element: <AdminCatalogPage /> },
              { path: 'lixeiras', element: <AdminBinsPage /> },
              { path: 'auditoria', element: <AdminAuditPage /> },
            ],
          },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
]);
