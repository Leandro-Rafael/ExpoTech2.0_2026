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
import { useAutenticacao } from './AuthProvider';
import { CarregamentoTelaCheia } from '@/components/layout/FullscreenLoader';
import { EstadoVazio } from '@/components/ui/EmptyState';
import { LinkBotao } from '@/components/ui/Button';

function caminhoLogin(origem: string) {
  return origem && origem !== '/' ? `/entrar?redirect=${encodeURIComponent(origem)}` : '/entrar';
}

/** Lê ?redirect= de forma segura (apenas caminhos internos). */
export function redirecionamentoSeguro(consulta: string, padrao = '/app'): string {
  const destino = new URLSearchParams(consulta).get('redirect');
  // Só caminhos internos: um "//outro-site.com" mandaria a pessoa para fora depois do login.
  if (destino && destino.startsWith('/') && !destino.startsWith('//') && !destino.startsWith('/\\')) return destino;
  return padrao;
}

export function ExigirLogin({ children }: { children?: ReactNode }) {
  const { status } = useAutenticacao();
  const localizacao = useLocation();
  // 1. Enquanto o servidor não responde quem está logado, mostra o carregamento.
  if (status === 'loading') return <CarregamentoTelaCheia label="Verificando sua sessão…" />;
  // 2. Sem login: vai para /entrar, guardando a tela pedida em ?redirect=.
  if (status === 'anonymous') {
    return <Navigate to={caminhoLogin(localizacao.pathname + localizacao.search)} replace />;
  }
  // 3. Logado: mostra a tela.
  return children ?? <Outlet />;
}

// Esconder a tela é só para o usuário; quem barra de verdade é o servidor, em cada rota da API.
export function ExigirPerfil({ perfis, children }: { perfis: Role[]; children?: ReactNode }) {
  const { user: usuario } = useAutenticacao();
  if (!usuario || !perfis.includes(usuario.role)) {
    return (
      <div className="container-app py-16">
        <EstadoVazio
          icon={ShieldAlert}
          tone="danger"
          title="Acesso restrito"
          description="Esta área é exclusiva para perfis autorizados. Se você acha que deveria ter acesso, fale com a administração."
          acao={<LinkBotao to="/app" variant="secondary">Voltar ao início</LinkBotao>}
        />
      </div>
    );
  }
  return children ?? <Outlet />;
}

export function RedirecionarSeLogado({ children }: { children: ReactNode }) {
  const { status } = useAutenticacao();
  const localizacao = useLocation();
  if (status === 'authenticated') return <Navigate to={redirecionamentoSeguro(localizacao.search)} replace />;
  return children;
}
