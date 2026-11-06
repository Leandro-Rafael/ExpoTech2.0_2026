/**
 * Bloqueio por inspeção (mesmas regras do back-end): avisos persistidos por usuário, eventos a menos
 * de 5 s do último aviso contado não contam, no 3º aviso o acesso fica bloqueado por 30 min e as
 * sessões são encerradas; quando o bloqueio vence, os avisos voltam a zero.
 */
import type { AccountLockReason, InspectionEventResult } from '@/api/types';
import type { RegistroUsuario } from '../db';

export const MAX_AVISOS_INSPECAO = 3;
export const JANELA_AVISO_INSPECAO_MS = 5000;
export const BLOQUEIO_INSPECAO_MS = 30 * 60_000;

/** Zera os avisos quando o bloqueio já venceu (aplicado de forma preguiçosa). */
export function expirarBloqueioInspecao(u: RegistroUsuario, agora = Date.now()) {
  if (u.securityLockedUntil && Date.parse(u.securityLockedUntil) <= agora) {
    u.securityLockedUntil = null;
    u.securityWarnings = 0;
    u.securityLastEventAt = null;
  }
}

/** Milissegundos restantes do bloqueio por inspeção (0 = sem bloqueio). */
export function restanteBloqueioInspecao(u: RegistroUsuario, agora = Date.now()): number {
  if (!u.securityLockedUntil) return 0;
  return Math.max(0, Date.parse(u.securityLockedUntil) - agora);
}

export function avisosAtivos(u: RegistroUsuario, agora = Date.now()): number {
  if (u.securityLockedUntil && Date.parse(u.securityLockedUntil) <= agora) return 0;
  return u.securityWarnings ?? 0;
}

export function resultadoInspecao(u: RegistroUsuario): InspectionEventResult {
  const bloqueado = restanteBloqueioInspecao(u) > 0;
  return { warnings: avisosAtivos(u), maxWarnings: MAX_AVISOS_INSPECAO, locked: bloqueado, lockedUntil: bloqueado ? u.securityLockedUntil ?? null : null };
}

/** Campos de bloqueio do AdminUser: o bloqueio ativo que termina por último. */
export function infoBloqueioAdmin(u: RegistroUsuario, agora = Date.now()): { locked: boolean; lockReason: AccountLockReason | null; lockedUntil: string | null; securityWarnings: number } {
  const senha = u.lockedUntil && Date.parse(u.lockedUntil) > agora ? u.lockedUntil : null;
  const inspecao = restanteBloqueioInspecao(u, agora) > 0 ? u.securityLockedUntil ?? null : null;
  let motivoBloqueio: AccountLockReason | null = null;
  let bloqueadoAte: string | null = null;
  if (inspecao && (!senha || Date.parse(inspecao) >= Date.parse(senha))) { motivoBloqueio = 'INSPECTION'; bloqueadoAte = inspecao; }
  else if (senha) { motivoBloqueio = 'PASSWORD'; bloqueadoAte = senha; }
  return { locked: motivoBloqueio !== null, lockReason: motivoBloqueio, lockedUntil: bloqueadoAte, securityWarnings: avisosAtivos(u, agora) };
}
