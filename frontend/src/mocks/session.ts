/**
 * Sessão e CSRF simulados.
 * - O "cookie HttpOnly" vira um id de sessão de demonstração no sessionStorage (nenhum segredo real).
 * - Acesso expira em 15 min e o refresh (7 dias) é rotativo, como no back-end.
 * - CSRF: `GET /api/auth/csrf` grava o cookie legível XSRF-TOKEN; mutações exigem X-XSRF-TOKEN igual.
 */
import type { MockDb, UserRec } from './db';

const SESSION_KEY = 'lixozero2050.mock.session';
const ACCESS_TTL_MS = 15 * 60_000;
const REFRESH_TTL_MS = 7 * 24 * 3600_000;
export const CSRF_COOKIE = 'XSRF-TOKEN';

interface MockSession { sid: string; userId: string; epoch: number; accessExp: number; refreshExp: number }

function read(): MockSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as MockSession) : null;
  } catch {
    return null;
  }
}

function write(s: MockSession | null) {
  try {
    if (s) sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else sessionStorage.removeItem(SESSION_KEY);
  } catch { /* modo privado */ }
}

export function startSession(user: UserRec) {
  const now = Date.now();
  write({ sid: crypto.randomUUID(), userId: user.id, epoch: user.sessionEpoch, accessExp: now + ACCESS_TTL_MS, refreshExp: now + REFRESH_TTL_MS });
}

export function clearSession() { write(null); }

function validUser(d: MockDb, s: MockSession | null): UserRec | null {
  if (!s) return null;
  const u = d.users.find((x) => x.id === s.userId);
  if (!u || !u.enabled || u.sessionEpoch !== s.epoch) return null;
  return u;
}

/** Id do usuário da sessão atual, mesmo revogada (usado para responder 423 durante o bloqueio por inspeção). */
export function sessionUserId(): string | null {
  return read()?.userId ?? null;
}

/** Usuário do "access token" atual (null se ausente/expirado). */
export function currentUser(d: MockDb): UserRec | null {
  const s = read();
  if (!s || s.accessExp < Date.now()) return null;
  return validUser(d, s);
}

/** Rotaciona a sessão usando o "refresh token". */
export function refreshSession(d: MockDb): UserRec | null {
  const s = read();
  if (!s || s.refreshExp < Date.now()) { clearSession(); return null; }
  const u = validUser(d, s);
  if (!u) { clearSession(); return null; }
  startSession(u);
  return u;
}

// ---------------------------------------------------------------- CSRF

export function readCsrfCookie(): string | null {
  const m = document.cookie.split('; ').find((c) => c.startsWith(`${CSRF_COOKIE}=`));
  return m ? decodeURIComponent(m.slice(CSRF_COOKIE.length + 1)) : null;
}

export function issueCsrfCookie() {
  const token = crypto.randomUUID();
  document.cookie = `${CSRF_COOKIE}=${encodeURIComponent(token)}; path=/; SameSite=Lax`;
}

export function csrfValid(headers: Headers): boolean {
  const cookie = readCsrfCookie();
  const header = headers.get('X-XSRF-TOKEN');
  return !!cookie && !!header && cookie === header;
}
