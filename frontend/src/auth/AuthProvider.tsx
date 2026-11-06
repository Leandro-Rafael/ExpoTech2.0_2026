/**
 * Sessão do usuário. O usuário atual vem de GET /api/auth/session (204 = visitante; cache do React Query em `qk.me`).
 *
 *   const { user, status, login, register, logout, hasRole } = useAuth();
 *
 * status: 'loading' (checando sessão) | 'authenticated' | 'anonymous'.
 */
import { createContext, use, useCallback, useEffect, useMemo, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ErroApi, garantirCsrf, aoNaoAutorizado } from '@/api/client';
import { apiAuth, type EntradaLogin, type EntradaCadastro } from '@/api/auth';
import { qk } from '@/api/queries';
import type { Role, UserMe } from '@/api/types';

type SituacaoSessao = 'loading' | 'authenticated' | 'anonymous';

interface ValorContextoAuth {
  user: UserMe | null;
  status: SituacaoSessao;
  login: (input: EntradaLogin) => Promise<UserMe>;
  register: (input: EntradaCadastro) => Promise<UserMe>;
  logout: () => Promise<void>;
  /** Recarrega /auth/me (ex.: após ganhar pontos). */
  recarregar: () => Promise<unknown>;
  temPerfil: (...roles: Role[]) => boolean;
}

const ContextoAuth = createContext<ValorContextoAuth | null>(null);

async function buscarSessao(): Promise<UserMe | null> {
  try {
    return (await apiAuth.sessao()) ?? null;
  } catch (e) {
    // 401/403 = sem sessão; 0/5xx = back-end offline (proxy do Vite responde 500) → trata como anônimo.
    if (e instanceof ErroApi) return null;
    throw e;
  }
}

export function ProvedorAuth({ children }: { children: ReactNode }) {
  const qc = useQueryClient();

  // CSRF no boot (não bloqueia a renderização).
  useEffect(() => { void garantirCsrf(); }, []);

  // 1. Ao abrir o site, pergunta ao servidor quem está logado (GET /api/auth/session).
  const consultaSessao = useQuery({
    queryKey: qk.me,
    queryFn: buscarSessao,
    staleTime: 60_000,
    retry: false,
    refetchOnWindowFocus: true,
  });

  const limparSessao = useCallback(() => {
    qc.setQueryData(qk.me, null);
    // Remove dados privados do cache, mantendo dados públicos.
    qc.removeQueries({ predicate: (q) => !['public', 'categories', 'auth'].includes(String(q.queryKey[0])) });
  }, [qc]);

  // 2. Se a API avisar que a sessão acabou, limpa o usuário e os dados privados do cache.
  useEffect(() => aoNaoAutorizado(limparSessao), [limparSessao]);

  // 3. Login e cadastro guardam o usuário devolvido e trocam o CSRF (o token muda após autenticar).
  const entrar = useCallback(async (dados: EntradaLogin) => {
    const usuario = await apiAuth.login(dados);
    qc.setQueryData(qk.me, usuario);
    await garantirCsrf(true); // token rotaciona após autenticação
    return usuario;
  }, [qc]);

  const cadastrar = useCallback(async (dados: EntradaCadastro) => {
    const usuario = await apiAuth.cadastrar(dados);
    qc.setQueryData(qk.me, usuario);
    await garantirCsrf(true);
    return usuario;
  }, [qc]);

  const sair = useCallback(async () => {
    try { await apiAuth.logout(); } catch { /* sessão já expirada */ }
    limparSessao();
    void garantirCsrf(true);
  }, [limparSessao]);

  // 4. Status que os guardas de rota usam: 'loading', 'authenticated' ou 'anonymous'.
  const usuario = consultaSessao.data ?? null;
  const status: SituacaoSessao = consultaSessao.isPending ? 'loading' : usuario ? 'authenticated' : 'anonymous';

  const valor = useMemo<ValorContextoAuth>(() => ({
    user: usuario,
    status,
    login: entrar,
    register: cadastrar,
    logout: sair,
    recarregar: () => qc.invalidateQueries({ queryKey: qk.me }),
    temPerfil: (...roles) => !!usuario && roles.includes(usuario.role),
  }), [usuario, status, entrar, cadastrar, sair, qc]);

  return <ContextoAuth value={valor}>{children}</ContextoAuth>;
}

export function useAutenticacao(): ValorContextoAuth {
  const ctx = use(ContextoAuth);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>');
  return ctx;
}

/** Usuário garantido (use apenas dentro de rotas protegidas por <RequireAuth>). */
export function useUsuario(): UserMe {
  const { user: usuario } = useAutenticacao();
  if (!usuario) throw new Error('useUser chamado fora de rota autenticada');
  return usuario;
}
