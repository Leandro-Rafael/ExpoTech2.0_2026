/**
 * Detecção CONSERVADORA de ferramentas do desenvolvedor abertas pelo menu do navegador.
 *
 * Como funciona: com o DevTools acoplado à janela, a área da página (inner) encolhe mas a janela
 * (outer) não muda. Medimos a diferença outer − inner ao montar (linha de base: barras, zoom e
 * painéis já abertos não contam) e só consideramos "aberto" um SALTO NOVO de mais de 200 px que
 * persista em 2 checagens seguidas com ~1 s de intervalo.
 *
 * Para não gerar falso positivo:
 * - só em desktop (ponteiro fino, sem toque); celular e tablet nunca disparam;
 * - zoom (devicePixelRatio mudou) ou mudança no tamanho da JANELA (maximizar, tela cheia,
 *   arrastar a borda) recalculam a linha de base em vez de disparar;
 * - janela minimizada/oculta ou medidas zeradas (alguns navegadores embutidos) são ignoradas;
 * - SÓ a altura conta: um salto lateral (largura) é indistinguível dos painéis laterais do próprio
 *   navegador (barra lateral do Edge/Copilot, painel lateral do Chrome), então não é considerado.
 *
 * Custo: nenhum laço de animação, nenhum `debugger`; uma leitura de 4 números no `resize`
 * (com debounce) e a cada 2 s apenas com a aba visível.
 *
 * Limites conhecidos (é dissuasão, não proteção): DevTools desacoplado (janela separada) ou
 * acoplado à direita/esquerda não é detectável assim; a garantia real está no servidor.
 */
const SALTO_PX = 200;
const MUDANCA_JANELA_PX = 40;
const CONFIRMACAO_MS = 1000;
const INTERVALO_MS = 2000;
const ESPERA_REDIMENSIONAR_MS = 250;

interface Amostra { dh: number; ow: number; oh: number; dpr: number }

function ehPonteiroDesktop(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  const fino = window.matchMedia('(pointer: fine)').matches;
  const grosso = window.matchMedia('(any-pointer: coarse)').matches;
  const navegadorCelular = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  return fino && !grosso && !navegadorCelular;
}

function amostrar(): Amostra | null {
  const { outerWidth: ow, outerHeight: oh, innerWidth: iw, innerHeight: ih } = window;
  if (!ow || !oh || !iw || !ih) return null;
  return { dh: oh - ih, ow, oh, dpr: window.devicePixelRatio || 1 };
}

/** Inicia a detecção; devolve a função que remove todos os listeners e timers. */
export function iniciarDetectorDevtools(aoAbrir: () => void): () => void {
  if (!ehPonteiroDesktop()) return () => {};

  let base = amostrar();
  let confirmacoes = 0;
  let avisado = false; // um aviso por "episódio" (zera quando volta à linha de base)
  let timerConfirmacao: number | undefined;
  let timerRedimensionar: number | undefined;
  let intervalo: number | undefined;

  const verificar = () => {
    if (document.visibilityState !== 'visible') return;
    const atual = amostrar();
    if (!atual) return;
    if (!base) { base = atual; return; }
    const janelaMudou = Math.abs(atual.ow - base.ow) > MUDANCA_JANELA_PX || Math.abs(atual.oh - base.oh) > MUDANCA_JANELA_PX;
    if (atual.dpr !== base.dpr || janelaMudou) {
      // zoom ou a própria janela mudou: nova linha de base, nunca um aviso
      base = atual;
      confirmacoes = 0;
      avisado = false;
      return;
    }
    const salto = atual.dh - base.dh;
    if (salto > SALTO_PX) {
      confirmacoes++;
      if (confirmacoes === 1) {
        window.clearTimeout(timerConfirmacao);
        timerConfirmacao = window.setTimeout(verificar, CONFIRMACAO_MS);
      } else if (!avisado) {
        avisado = true;
        aoAbrir();
      }
    } else {
      confirmacoes = 0;
      if (salto < SALTO_PX / 2) avisado = false;
    }
  };

  const aoRedimensionar = () => {
    window.clearTimeout(timerRedimensionar);
    timerRedimensionar = window.setTimeout(verificar, ESPERA_REDIMENSIONAR_MS);
  };
  const iniciarIntervalo = () => {
    window.clearInterval(intervalo);
    intervalo = document.visibilityState === 'visible' ? window.setInterval(verificar, INTERVALO_MS) : undefined;
  };
  const aoMudarVisibilidade = () => {
    iniciarIntervalo();
    if (document.visibilityState === 'visible') base = amostrar() ?? base; // ao voltar, recalibra
  };

  window.addEventListener('resize', aoRedimensionar, { passive: true });
  document.addEventListener('visibilitychange', aoMudarVisibilidade);
  iniciarIntervalo();

  return () => {
    window.removeEventListener('resize', aoRedimensionar);
    document.removeEventListener('visibilitychange', aoMudarVisibilidade);
    window.clearTimeout(timerConfirmacao);
    window.clearTimeout(timerRedimensionar);
    window.clearInterval(intervalo);
  };
}
