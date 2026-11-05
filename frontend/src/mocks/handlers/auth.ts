/** /api/auth — cadastro, login (com bloqueio após 5 falhas), refresh, logout, me. */
import type { UserMe } from '@/api/types';
import { db, nowIso, type UserRec } from '../db';
import { toUserMe } from '../dto';
import { Validator, bodyObject, created, fail, noContent, ok, str } from '../http';
import { audit, actorLabel } from '../logic/audit';
import { checkPassword, demoHash, validatePassword } from '../logic/password';
import { expireInspectionLock, inspectionLockRemaining } from '../logic/security';
import { clearSession, currentUser, issueCsrfCookie, refreshSession, sessionUserId, startSession } from '../session';
import { route } from '../server';

const MAX_FAILED_LOGINS = 5;
const LOCK_MS = 15 * 60_000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function normalizeEmail(v: unknown): string {
  return typeof v === 'string' ? v.trim().toLowerCase() : '';
}

export function newPasswordHash(password: string): string {
  return demoHash(password, crypto.randomUUID().slice(0, 8));
}

export function registerAuthRoutes() {
  route('GET', '/auth/csrf', () => {
    issueCsrfCookie();
    return noContent();
  }, { access: 'public' });

  route('POST', '/auth/register', ({ body }) => {
    const d = db();
    const b = bodyObject(body);
    const v = new Validator();
    const name = str(b.name) ?? '';
    const email = normalizeEmail(b.email);
    v.check(name.length >= 2, 'name', 'informe seu nome (mínimo 2 caracteres)');
    v.check(name.length <= 80, 'name', 'o nome deve ter no máximo 80 caracteres');
    if (!email) v.add('email', 'informe o e-mail');
    else v.check(EMAIL_RE.test(email) && email.length <= 160, 'email', 'e-mail inválido');
    const pwError = validatePassword('password', b.password, email);
    if (pwError) v.add(pwError.field, pwError.message);
    v.throwIfAny();
    if (d.users.some((u) => u.email === email)) throw fail.conflict('Já existe uma conta cadastrada com este e-mail.');

    const now = nowIso();
    const user: UserRec = {
      id: crypto.randomUUID(), name, email, passwordHash: newPasswordHash(String(b.password)), role: 'USER', enabled: true,
      failedLogins: 0, lockedUntil: null, householdId: null, organizationId: null, points: 0, totalEarned: 0, sessionEpoch: 0,
      createdAt: now, lastLoginAt: now,
    };
    d.users.push(user);
    startSession(user);
    audit(d, user, 'USER_REGISTERED', 'User', user.id, null);
    return created<UserMe>(toUserMe(d, user));
  }, { access: 'public' });

  route('POST', '/auth/login', ({ body }) => {
    const d = db();
    const b = bodyObject(body);
    const email = normalizeEmail(b.email);
    const password = typeof b.password === 'string' ? b.password : '';
    const v = new Validator();
    v.check(!!email, 'email', 'informe o e-mail');
    v.check(!!password, 'password', 'informe a senha');
    v.throwIfAny();

    const user = d.users.find((u) => u.email === email) ?? null;
    const now = Date.now();
    if (user?.lockedUntil) {
      const remaining = Date.parse(user.lockedUntil) - now;
      if (remaining > 0) throw fail.locked(remaining / 1000);
      user.lockedUntil = null;
      user.failedLogins = 0;
    }
    if (!user || !checkPassword(password, user.passwordHash)) {
      audit(d, user ?? email, 'LOGIN_FAILED', 'User', user?.id ?? null, user ? 'senha incorreta' : 'e-mail não cadastrado');
      if (user) {
        user.failedLogins++;
        if (user.failedLogins >= MAX_FAILED_LOGINS) {
          user.lockedUntil = new Date(now + LOCK_MS).toISOString();
          user.failedLogins = 0;
          audit(d, user, 'ACCOUNT_LOCKED', 'User', user.id, 'bloqueio por 15 min');
          throw fail.locked(LOCK_MS / 1000);
        }
      }
      throw fail.badCredentials();
    }
    if (!user.enabled) {
      audit(d, user, 'LOGIN_DISABLED_ACCOUNT', 'User', user.id, null);
      throw fail.forbidden('Esta conta está desativada. Procure o administrador.');
    }
    // bloqueio por inspeção: só revelado depois da senha correta (não confirma contas a quem não tem a senha)
    expireInspectionLock(user);
    const inspectionLeft = inspectionLockRemaining(user);
    if (inspectionLeft > 0) throw fail.inspectionLocked(inspectionLeft / 1000);
    user.failedLogins = 0;
    user.lastLoginAt = nowIso();
    startSession(user);
    audit(d, user, 'LOGIN_SUCCESS', 'User', user.id, null);
    return ok<UserMe>(toUserMe(d, user));
  }, { access: 'public' });

  route('POST', '/auth/refresh', () => {
    const d = db();
    const sid = sessionUserId();
    const sessionUser = sid ? d.users.find((u) => u.id === sid) : undefined;
    const left = sessionUser ? inspectionLockRemaining(sessionUser) : 0;
    if (left > 0) throw fail.inspectionLocked(left / 1000);
    const user = refreshSession(d);
    if (!user) throw fail.unauthorized('Sessão expirada. Faça login novamente.');
    return ok<UserMe>(toUserMe(d, user));
  }, { access: 'public' });

  route('POST', '/auth/logout', () => {
    const d = db();
    const user = currentUser(d);
    if (user) audit(d, actorLabel(user), 'LOGOUT', 'User', user.id, null);
    clearSession();
    return noContent();
  }, { access: 'public' });

  route('GET', '/auth/me', ({ me }) => ok<UserMe>(toUserMe(db(), me)));

  // Boot do SPA: 200 com sessão, 204 para visitante, 401 só se há "refresh token" (o cliente renova).
  route('GET', '/auth/session', () => {
    const d = db();
    const user = currentUser(d);
    if (user) {
      const left = inspectionLockRemaining(user);
      if (left > 0) throw fail.inspectionLocked(left / 1000);
      return ok<UserMe>(toUserMe(d, user));
    }
    if (sessionUserId()) throw fail.unauthorized('Sessão expirada. Faça login novamente.');
    return noContent();
  }, { access: 'public' });
}
