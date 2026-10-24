/**
 * Bloqueio por inspeção (mesmas regras do back-end): avisos persistidos por usuário, eventos a menos
 * de 5 s do último aviso contado não contam, no 3º aviso o acesso fica bloqueado por 30 min e as
 * sessões são encerradas; quando o bloqueio vence, os avisos voltam a zero.
 */
import type { AccountLockReason, InspectionEventResult } from '@/api/types';
import type { UserRec } from '../db';

export const MAX_INSPECTION_WARNINGS = 3;
export const INSPECTION_DEDUPE_MS = 5000;
export const INSPECTION_LOCK_MS = 30 * 60_000;

/** Zera os avisos quando o bloqueio já venceu (aplicado de forma preguiçosa). */
export function expireInspectionLock(u: UserRec, now = Date.now()) {
  if (u.securityLockedUntil && Date.parse(u.securityLockedUntil) <= now) {
    u.securityLockedUntil = null;
    u.securityWarnings = 0;
    u.securityLastEventAt = null;
  }
}

/** Milissegundos restantes do bloqueio por inspeção (0 = sem bloqueio). */
export function inspectionLockRemaining(u: UserRec, now = Date.now()): number {
  if (!u.securityLockedUntil) return 0;
  return Math.max(0, Date.parse(u.securityLockedUntil) - now);
}

export function activeWarnings(u: UserRec, now = Date.now()): number {
  if (u.securityLockedUntil && Date.parse(u.securityLockedUntil) <= now) return 0;
  return u.securityWarnings ?? 0;
}

export function inspectionResult(u: UserRec): InspectionEventResult {
  const locked = inspectionLockRemaining(u) > 0;
  return { warnings: activeWarnings(u), maxWarnings: MAX_INSPECTION_WARNINGS, locked, lockedUntil: locked ? u.securityLockedUntil ?? null : null };
}

/** Campos de bloqueio do AdminUser: o bloqueio ativo que termina por último. */
export function adminLockInfo(u: UserRec, now = Date.now()): { locked: boolean; lockReason: AccountLockReason | null; lockedUntil: string | null; securityWarnings: number } {
  const pwd = u.lockedUntil && Date.parse(u.lockedUntil) > now ? u.lockedUntil : null;
  const insp = inspectionLockRemaining(u, now) > 0 ? u.securityLockedUntil ?? null : null;
  let lockReason: AccountLockReason | null = null;
  let lockedUntil: string | null = null;
  if (insp && (!pwd || Date.parse(insp) >= Date.parse(pwd))) { lockReason = 'INSPECTION'; lockedUntil = insp; }
  else if (pwd) { lockReason = 'PASSWORD'; lockedUntil = pwd; }
  return { locked: lockReason !== null, lockReason, lockedUntil, securityWarnings: activeWarnings(u, now) };
}
