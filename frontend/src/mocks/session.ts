/**
 * Sessão e CSRF simulados.
 * - O "cookie HttpOnly" vira um id de sessão de demonstração no sessionStorage (nenhum segredo real).
 * - Acesso expira em 15 min e o refresh (7 dias) é rotativo, como no back-end.
 * - CSRF: `GET /api/auth/csrf` grava o cookie legível XSRF-TOKEN; mutações exigem X-XSRF-TOKEN igual.
 */
import type { BancoSimulado, RegistroUsuario } from './db';

const CHAVE_SESSAO = 'lixozero2050.mock.session';
const VALIDADE_ACESSO_MS = 15 * 60_000;
const VALIDADE_RENOVACAO_MS = 7 * 24 * 3600_000;
const COOKIE_CSRF = 'XSRF-TOKEN';

interface SessaoSimulada { sid: string; userId: string; epoch: number; accessExp: number; refreshExp: number }

function ler(): SessaoSimulada | null {
  try {
    const bruto = sessionStorage.getItem(CHAVE_SESSAO);
    return bruto ? (JSON.parse(bruto) as SessaoSimulada) : null;
  } catch {
    return null;
  }
}

function gravar(s: SessaoSimulada | null) {
  try {
    if (s) sessionStorage.setItem(CHAVE_SESSAO, JSON.stringify(s));
    else sessionStorage.removeItem(CHAVE_SESSAO);
  } catch { /* modo privado */ }
}

export function iniciarSessao(usuario: RegistroUsuario) {
  const agora = Date.now();
  gravar({ sid: crypto.randomUUID(), userId: usuario.id, epoch: usuario.sessionEpoch, accessExp: agora + VALIDADE_ACESSO_MS, refreshExp: agora + VALIDADE_RENOVACAO_MS });
}

export function limparSessao() { gravar(null); }

function usuarioValido(d: BancoSimulado, s: SessaoSimulada | null): RegistroUsuario | null {
  if (!s) return null;
  const u = d.users.find((x) => x.id === s.userId);
  if (!u || !u.enabled || u.sessionEpoch !== s.epoch) return null;
  return u;
}

/** Id do usuário da sessão atual, mesmo revogada (usado para responder 423 durante o bloqueio por inspeção). */
export function idUsuarioDaSessao(): string | null {
  return ler()?.userId ?? null;
}

/** Usuário do "access token" atual (null se ausente/expirado). */
export function usuarioAtual(d: BancoSimulado): RegistroUsuario | null {
  const s = ler();
  if (!s || s.accessExp < Date.now()) return null;
  return usuarioValido(d, s);
}

/** Rotaciona a sessão usando o "refresh token". */
export function renovarSessao(d: BancoSimulado): RegistroUsuario | null {
  const s = ler();
  if (!s || s.refreshExp < Date.now()) { limparSessao(); return null; }
  const u = usuarioValido(d, s);
  if (!u) { limparSessao(); return null; }
  iniciarSessao(u);
  return u;
}

// ---------------------------------------------------------------- CSRF

function lerCookieCsrf(): string | null {
  const m = document.cookie.split('; ').find((c) => c.startsWith(`${COOKIE_CSRF}=`));
  return m ? decodeURIComponent(m.slice(COOKIE_CSRF.length + 1)) : null;
}

export function emitirCookieCsrf() {
  const token = crypto.randomUUID();
  document.cookie = `${COOKIE_CSRF}=${encodeURIComponent(token)}; path=/; SameSite=Lax`;
}

export function csrfValido(headers: Headers): boolean {
  const cookie = lerCookieCsrf();
  const cabecalho = headers.get('X-XSRF-TOKEN');
  return !!cookie && !!cabecalho && cookie === cabecalho;
}
