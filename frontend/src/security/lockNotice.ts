/**
 * Aviso de bloqueio por inspeção levado até a tela de login (sessionStorage: some ao fechar a aba,
 * não contém nada sensível — só o horário em que o bloqueio termina).
 */
const CHAVE = 'ez:inspection-lock';

const MENSAGEM_BLOQUEIO_INSPECAO = 'Acesso bloqueado por 30 minutos por tentativa de inspeção do sistema.';

export function salvarAvisoBloqueio(bloqueadoAte: number) {
  try { sessionStorage.setItem(CHAVE, String(bloqueadoAte)); } catch { /* armazenamento indisponível */ }
}

/** Mensagem pronta para a tela de login, ou null se não há bloqueio ativo. Não apaga o aviso. */
export function lerAvisoBloqueio(agora = Date.now()): string | null {
  let ate = NaN;
  try { ate = Number(sessionStorage.getItem(CHAVE)); } catch { /* */ }
  if (!Number.isFinite(ate) || ate <= agora) {
    limparAvisoBloqueio();
    return null;
  }
  const minutos = Math.max(1, Math.ceil((ate - agora) / 60_000));
  return `${MENSAGEM_BLOQUEIO_INSPECAO} Tente novamente em ${minutos} min.`;
}

export function limparAvisoBloqueio() {
  try { sessionStorage.removeItem(CHAVE); } catch { /* */ }
}
