/**
 * Rotas da aplicação. Todas as páginas são carregadas sob demanda (code-splitting).
 * Para adicionar uma página: crie o arquivo em src/pages/..., registre aqui com `page(() => import(...))`
 * e, se precisar de menu, adicione em src/app/navigation.ts.
 */
import { lazy, Suspense, type ComponentType, type LazyExoticComponent } from 'react';
import { createBrowserRouter, Navigate, Outlet, useLocation } from 'react-router';
import { useUsuario } from '@/auth/AuthProvider';
import { RedirecionarSeLogado, ExigirLogin, ExigirPerfil } from '@/auth/guards';
import { MolduraApp } from '@/components/layout/AppShell';
import { PaginaErroRota } from '@/components/layout/ErrorBoundary';
import { EsqueletoAuth } from '@/features/auth/AuthSkeleton';

type Carregador = () => Promise<{ default: ComponentType }>;
const pagina = (carregador: Carregador): LazyExoticComponent<ComponentType> => lazy(carregador);
const hub = (nome: keyof typeof import('./hubs')) => pagina(() => import('./hubs').then((m) => ({ default: m[nome] })));
/** Endereço antigo que agora é uma aba de outra tela. */
const movido = (caminho: string, destino: string) => ({ path: caminho, element: <Navigate to={destino} replace /> });

// Públicas
// Landing importada de imediato: primeira pintura sem loader (three/gsap/lenis e as seções
// abaixo da dobra continuam lazy dentro dela).
import PaginaInicial from '@/pages/public/LandingPage';

const carregarLogin = () => import('@/pages/public/LoginPage');
const carregarCadastro = () => import('@/pages/public/RegisterPage');
// Pré-carrega a página pública da URL atual em paralelo ao boot (sem pesar no bundle inicial).
if (typeof window !== 'undefined') {
  if (window.location.pathname.startsWith('/entrar')) void carregarLogin();
  else if (window.location.pathname.startsWith('/cadastro')) void carregarCadastro();
}
const PaginaLogin = pagina(carregarLogin);
const PaginaCadastro = pagina(carregarCadastro);
const PaginaNaoEncontrada = pagina(() => import('@/pages/public/NotFoundPage'));

// Morador
const PaginaPainel = pagina(() => import('@/pages/app/DashboardPage'));
const PaginaNovoDescarte = pagina(() => import('@/pages/app/NewDisposalPage'));
const TelaDescartes = hub('DisposalsHub');
const TelaRecompensas = hub('RewardsHub');
const PaginaMapa = pagina(() => import('@/pages/app/MapPage'));
const PaginaCasa = pagina(() => import('@/pages/app/HomePage'));
const PaginaPerfil = pagina(() => import('@/pages/app/ProfilePage'));

// Coletor
const PaginaRotasColetor = pagina(() => import('@/pages/collector/CollectorRoutesPage'));

// Admin
const TelaAdminVisaoGeral = hub('AdminOverviewHub');
const TelaAdminModeracao = hub('AdminModerationHub');
const TelaAdminColetas = hub('AdminCollectionsHub');
const PaginaAdminCatalogo = pagina(() => import('@/pages/admin/AdminCatalogPage'));

/** Tela inicial de cada perfil: coletor e admin começam na própria área. */
function InicioPorPerfil() {
  const { role: perfil } = useUsuario();
  if (perfil === 'COLLECTOR') return <Navigate to="/app/coletor" replace />;
  if (perfil === 'ADMIN') return <Navigate to="/app/admin" replace />;
  return <PaginaPainel />;
}

/** Layout das páginas públicas (sem shell). */
function LayoutPublico() {
  const { pathname } = useLocation();
  const telaDeAcesso = pathname.startsWith('/entrar') || pathname.startsWith('/cadastro');
  return (
    <Suspense fallback={telaDeAcesso ? <EsqueletoAuth /> : <div className="min-h-dvh bg-bg" />}>
      <Outlet />
    </Suspense>
  );
}

// Públicas na raiz; /app exige login; /app/coletor e /app/admin exigem perfil.
// `moved` redireciona endereços antigos para a aba equivalente de um hub.
export const roteador = createBrowserRouter([
  {
    errorElement: <PaginaErroRota />,
    children: [
      {
        element: <LayoutPublico />,
        children: [
          { index: true, element: <PaginaInicial /> },
          { path: 'entrar', element: <RedirecionarSeLogado><PaginaLogin /></RedirecionarSeLogado> },
          { path: 'cadastro', element: <RedirecionarSeLogado><PaginaCadastro /></RedirecionarSeLogado> },
          { path: '*', element: <PaginaNaoEncontrada /> },
        ],
      },
      {
        path: 'app',
        element: <ExigirLogin><MolduraApp /></ExigirLogin>,
        children: [
          { index: true, element: <InicioPorPerfil /> },
          { path: 'descartar', element: <PaginaNovoDescarte /> },
          { path: 'descartes', element: <TelaDescartes /> },
          { path: 'recompensas', element: <TelaRecompensas /> },
          movido('conquistas', '/app/recompensas?aba=progresso'),
          movido('ranking', '/app/recompensas?aba=ranking'),
          movido('impacto', '/app/descartes?aba=impacto'),
          { path: 'mapa', element: <PaginaMapa /> },
          { path: 'casa', element: <PaginaCasa /> },
          { path: 'perfil', element: <PaginaPerfil /> },
          {
            path: 'coletor',
            element: <ExigirPerfil perfis={['COLLECTOR', 'ADMIN']} />,
            children: [{ index: true, element: <PaginaRotasColetor /> }],
          },
          {
            path: 'admin',
            element: <ExigirPerfil perfis={['ADMIN']} />,
            children: [
              { index: true, element: <TelaAdminVisaoGeral /> },
              { path: 'descartes', element: <TelaAdminModeracao /> },
              { path: 'coletas', element: <TelaAdminColetas /> },
              { path: 'catalogo', element: <PaginaAdminCatalogo /> },
              movido('auditoria', '/app/admin?aba=auditoria'),
              movido('usuarios', '/app/admin/descartes?aba=usuarios'),
              movido('ecopontos', '/app/admin/coletas?aba=ecopontos'),
              movido('lixeiras', '/app/admin/coletas?aba=lixeiras'),
            ],
          },
          { path: '*', element: <PaginaNaoEncontrada /> },
        ],
      },
    ],
  },
]);
