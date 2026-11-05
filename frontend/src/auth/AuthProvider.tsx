/**
 * Sessão do usuário. O usuário atual vem de GET /api/auth/session (204 = visitante; cache do React Query em `qk.me`).
 *
 *   const { user, status, login, register, logout, hasRole } = useAuth();
 *
 * status: 'loading' (checando sessão) | 'authenticated' | 'anonymous'.
 */
import { createContext, use, useCallback, useEffect, useMemo, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, ensureCsrf, onUnauthorized } from '@/api/client';
import { authApi, type LoginInput, type RegisterInput } from '@/api/auth';
import { qk } from '@/api/queries';
import type { Role, UserMe } from '@/api/types';

type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

interface AuthContextValue {
  user: UserMe | null;
  status: AuthStatus;
  login: (input: LoginInput) => Promise<UserMe>;
  register: (input: RegisterInput) => Promise<UserMe>;
  logout: () => Promise<void>;
  /** Recarrega /auth/me (ex.: após ganhar pontos). */
  refresh: () => Promise<unknown>;
  hasRole: (...roles: Role[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchMe(): Promise<UserMe | null> {
  try {
    return (await authApi.session()) ?? null;
  } catch (e) {
    // 401/403 = sem sessão; 0/5xx = back-end offline (proxy do Vite responde 500) → trata como anônimo.
    if (e instanceof ApiError) return null;
    throw e;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();

  // CSRF no boot (não bloqueia a renderização).
  useEffect(() => { void ensureCsrf(); }, []);

  const meQuery = useQuery({
    queryKey: qk.me,
    queryFn: fetchMe,
    staleTime: 60_000,
    retry: false,
    refetchOnWindowFocus: true,
  });

  const clearSession = useCallback(() => {
    qc.setQueryData(qk.me, null);
    // Remove dados privados do cache, mantendo dados públicos.
    qc.removeQueries({ predicate: (q) => !['public', 'categories', 'auth'].includes(String(q.queryKey[0])) });
  }, [qc]);

  useEffect(() => onUnauthorized(clearSession), [clearSession]);

  const login = useCallback(async (input: LoginInput) => {
    const user = await authApi.login(input);
    qc.setQueryData(qk.me, user);
    await ensureCsrf(true); // token rotaciona após autenticação
    return user;
  }, [qc]);

  const register = useCallback(async (input: RegisterInput) => {
    const user = await authApi.register(input);
    qc.setQueryData(qk.me, user);
    await ensureCsrf(true);
    return user;
  }, [qc]);

  const logout = useCallback(async () => {
    try { await authApi.logout(); } catch { /* sessão já expirada */ }
    clearSession();
    void ensureCsrf(true);
  }, [clearSession]);

  const user = meQuery.data ?? null;
  const status: AuthStatus = meQuery.isPending ? 'loading' : user ? 'authenticated' : 'anonymous';

  const value = useMemo<AuthContextValue>(() => ({
    user,
    status,
    login,
    register,
    logout,
    refresh: () => qc.invalidateQueries({ queryKey: qk.me }),
    hasRole: (...roles) => !!user && roles.includes(user.role),
  }), [user, status, login, register, logout, qc]);

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth(): AuthContextValue {
  const ctx = use(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>');
  return ctx;
}

/** Usuário garantido (use apenas dentro de rotas protegidas por <RequireAuth>). */
export function useUser(): UserMe {
  const { user } = useAuth();
  if (!user) throw new Error('useUser chamado fora de rota autenticada');
  return user;
}
