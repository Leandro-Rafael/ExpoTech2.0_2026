/**
 * Guardas de rota.
 *   <RequireAuth><AppShell/></RequireAuth>          → exige login (redireciona p/ /entrar?redirect=...)
 *   <RequireRole roles={['ADMIN']}><Outlet/></RequireRole> → exige perfil (403 amigável)
 *   <RedirectIfAuthenticated> → em /entrar e /cadastro, manda usuário logado para /app
 */
import type { ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';
import { ShieldAlert } from 'lucide-react';
import type { Role } from '@/api/types';
import { useAuth } from './AuthProvider';
import { FullscreenLoader } from '@/components/layout/FullscreenLoader';
import { EmptyState } from '@/components/ui/EmptyState';
import { ButtonLink } from '@/components/ui/Button';

export function loginPath(from: string) {
  return from && from !== '/' ? `/entrar?redirect=${encodeURIComponent(from)}` : '/entrar';
}

/** Lê ?redirect= de forma segura (apenas caminhos internos). */
export function safeRedirect(search: string, fallback = '/app'): string {
  const target = new URLSearchParams(search).get('redirect');
  if (target && target.startsWith('/') && !target.startsWith('//') && !target.startsWith('/\\')) return target;
  return fallback;
}

export function RequireAuth({ children }: { children?: ReactNode }) {
  const { status } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <FullscreenLoader label="Verificando sua sessão…" />;
  if (status === 'anonymous') {
    return <Navigate to={loginPath(location.pathname + location.search)} replace />;
  }
  return children ?? <Outlet />;
}

export function RequireRole({ roles, children }: { roles: Role[]; children?: ReactNode }) {
  const { user } = useAuth();
  if (!user || !roles.includes(user.role)) {
    return (
      <div className="container-app py-16">
        <EmptyState
          icon={ShieldAlert}
          tone="danger"
          title="Acesso restrito"
          description="Esta área é exclusiva para perfis autorizados. Se você acha que deveria ter acesso, fale com a administração."
          action={<ButtonLink to="/app" variant="secondary">Voltar ao início</ButtonLink>}
        />
      </div>
    );
  }
  return children ?? <Outlet />;
}

export function RedirectIfAuthenticated({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const location = useLocation();
  if (status === 'authenticated') return <Navigate to={safeRedirect(location.search)} replace />;
  return children;
}
