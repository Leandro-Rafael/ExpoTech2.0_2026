/**
 * Rotas da aplicação. Todas as páginas são carregadas sob demanda (code-splitting).
 * Para adicionar uma página: crie o arquivo em src/pages/..., registre aqui com `page(() => import(...))`
 * e, se precisar de menu, adicione em src/app/navigation.ts.
 */
import { lazy, Suspense, type ComponentType, type LazyExoticComponent } from 'react';
import { createBrowserRouter, Navigate, Outlet, useLocation } from 'react-router';
import { useUser } from '@/auth/AuthProvider';
import { RedirectIfAuthenticated, RequireAuth, RequireRole } from '@/auth/guards';
import { AppShell } from '@/components/layout/AppShell';
import { RouteErrorPage } from '@/components/layout/ErrorBoundary';
import { AuthSkeleton } from '@/features/auth/AuthSkeleton';

type Loader = () => Promise<{ default: ComponentType }>;
const page = (loader: Loader): LazyExoticComponent<ComponentType> => lazy(loader);
const hub = (name: keyof typeof import('./hubs')) => page(() => import('./hubs').then((m) => ({ default: m[name] })));
/** Endereço antigo que agora é uma aba de outra tela. */
const moved = (path: string, to: string) => ({ path, element: <Navigate to={to} replace /> });

// Públicas
// Landing importada de imediato: primeira pintura sem loader (three/gsap/lenis e as seções
// abaixo da dobra continuam lazy dentro dela).
import LandingPage from '@/pages/public/LandingPage';

const loadLogin = () => import('@/pages/public/LoginPage');
const loadRegister = () => import('@/pages/public/RegisterPage');
// Pré-carrega a página pública da URL atual em paralelo ao boot (sem pesar no bundle inicial).
if (typeof window !== 'undefined') {
  if (window.location.pathname.startsWith('/entrar')) void loadLogin();
  else if (window.location.pathname.startsWith('/cadastro')) void loadRegister();
}
const LoginPage = page(loadLogin);
const RegisterPage = page(loadRegister);
const NotFoundPage = page(() => import('@/pages/public/NotFoundPage'));

// Morador
const DashboardPage = page(() => import('@/pages/app/DashboardPage'));
const NewDisposalPage = page(() => import('@/pages/app/NewDisposalPage'));
const DisposalsHub = hub('DisposalsHub');
const RewardsHub = hub('RewardsHub');
const MapPage = page(() => import('@/pages/app/MapPage'));
const HomePage = page(() => import('@/pages/app/HomePage'));
const ProfilePage = page(() => import('@/pages/app/ProfilePage'));

// Coletor
const CollectorRoutesPage = page(() => import('@/pages/collector/CollectorRoutesPage'));

// Admin
const AdminOverviewHub = hub('AdminOverviewHub');
const AdminModerationHub = hub('AdminModerationHub');
const AdminCollectionsHub = hub('AdminCollectionsHub');
const AdminCatalogPage = page(() => import('@/pages/admin/AdminCatalogPage'));

/** Tela inicial de cada perfil: coletor e admin começam na própria área. */
function HomeByRole() {
  const { role } = useUser();
  if (role === 'COLLECTOR') return <Navigate to="/app/coletor" replace />;
  if (role === 'ADMIN') return <Navigate to="/app/admin" replace />;
  return <DashboardPage />;
}

/** Layout das páginas públicas (sem shell). */
function PublicLayout() {
  const { pathname } = useLocation();
  const auth = pathname.startsWith('/entrar') || pathname.startsWith('/cadastro');
  return (
    <Suspense fallback={auth ? <AuthSkeleton /> : <div className="min-h-dvh bg-bg" />}>
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
          { index: true, element: <HomeByRole /> },
          { path: 'descartar', element: <NewDisposalPage /> },
          { path: 'descartes', element: <DisposalsHub /> },
          { path: 'recompensas', element: <RewardsHub /> },
          moved('conquistas', '/app/recompensas?aba=progresso'),
          moved('ranking', '/app/recompensas?aba=ranking'),
          moved('impacto', '/app/descartes?aba=impacto'),
          { path: 'mapa', element: <MapPage /> },
          { path: 'casa', element: <HomePage /> },
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
              { index: true, element: <AdminOverviewHub /> },
              { path: 'descartes', element: <AdminModerationHub /> },
              { path: 'coletas', element: <AdminCollectionsHub /> },
              { path: 'catalogo', element: <AdminCatalogPage /> },
              moved('auditoria', '/app/admin?aba=auditoria'),
              moved('usuarios', '/app/admin/descartes?aba=usuarios'),
              moved('ecopontos', '/app/admin/coletas?aba=ecopontos'),
              moved('lixeiras', '/app/admin/coletas?aba=lixeiras'),
            ],
          },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
]);
