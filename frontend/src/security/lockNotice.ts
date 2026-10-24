/**
 * Aviso de bloqueio por inspeção levado até a tela de login (sessionStorage: some ao fechar a aba,
 * não contém nada sensível — só o horário em que o bloqueio termina).
 */
const KEY = 'ez:inspection-lock';

export const INSPECTION_LOCK_MESSAGE = 'Acesso bloqueado por 30 minutos por tentativa de inspeção do sistema.';

export function saveLockNotice(lockedUntil: number) {
  try { sessionStorage.setItem(KEY, String(lockedUntil)); } catch { /* armazenamento indisponível */ }
}

/** Mensagem pronta para a tela de login, ou null se não há bloqueio ativo. Não apaga o aviso. */
export function readLockNotice(now = Date.now()): string | null {
  let until = NaN;
  try { until = Number(sessionStorage.getItem(KEY)); } catch { /* */ }
  if (!Number.isFinite(until) || until <= now) {
    clearLockNotice();
    return null;
  }
  const min = Math.max(1, Math.ceil((until - now) / 60_000));
  return `${INSPECTION_LOCK_MESSAGE} Tente novamente em ${min} min.`;
}

export function clearLockNotice() {
  try { sessionStorage.removeItem(KEY); } catch { /* */ }
}
