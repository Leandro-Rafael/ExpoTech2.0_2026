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
const JUMP_PX = 200;
const WINDOW_CHANGE_PX = 40;
const CONFIRM_MS = 1000;
const INTERVAL_MS = 2000;
const RESIZE_DEBOUNCE_MS = 250;

interface Sample { dh: number; ow: number; oh: number; dpr: number }

export function isDesktopPointer(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  const fine = window.matchMedia('(pointer: fine)').matches;
  const coarse = window.matchMedia('(any-pointer: coarse)').matches;
  const mobileUa = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  return fine && !coarse && !mobileUa;
}

function sample(): Sample | null {
  const { outerWidth: ow, outerHeight: oh, innerWidth: iw, innerHeight: ih } = window;
  if (!ow || !oh || !iw || !ih) return null;
  return { dh: oh - ih, ow, oh, dpr: window.devicePixelRatio || 1 };
}

/** Inicia a detecção; devolve a função que remove todos os listeners e timers. */
export function startDevtoolsDetector(onOpen: () => void): () => void {
  if (!isDesktopPointer()) return () => {};

  let base = sample();
  let confirmations = 0;
  let reported = false; // um aviso por "episódio" (zera quando volta à linha de base)
  let confirmTimer: number | undefined;
  let resizeTimer: number | undefined;
  let interval: number | undefined;

  const check = () => {
    if (document.visibilityState !== 'visible') return;
    const now = sample();
    if (!now) return;
    if (!base) { base = now; return; }
    const windowChanged = Math.abs(now.ow - base.ow) > WINDOW_CHANGE_PX || Math.abs(now.oh - base.oh) > WINDOW_CHANGE_PX;
    if (now.dpr !== base.dpr || windowChanged) {
      // zoom ou a própria janela mudou: nova linha de base, nunca um aviso
      base = now;
      confirmations = 0;
      reported = false;
      return;
    }
    const jump = now.dh - base.dh;
    if (jump > JUMP_PX) {
      confirmations++;
      if (confirmations === 1) {
        window.clearTimeout(confirmTimer);
        confirmTimer = window.setTimeout(check, CONFIRM_MS);
      } else if (!reported) {
        reported = true;
        onOpen();
      }
    } else {
      confirmations = 0;
      if (jump < JUMP_PX / 2) reported = false;
    }
  };

  const onResize = () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(check, RESIZE_DEBOUNCE_MS);
  };
  const startInterval = () => {
    window.clearInterval(interval);
    interval = document.visibilityState === 'visible' ? window.setInterval(check, INTERVAL_MS) : undefined;
  };
  const onVisibility = () => {
    startInterval();
    if (document.visibilityState === 'visible') base = sample() ?? base; // ao voltar, recalibra
  };

  window.addEventListener('resize', onResize, { passive: true });
  document.addEventListener('visibilitychange', onVisibility);
  startInterval();

  return () => {
    window.removeEventListener('resize', onResize);
    document.removeEventListener('visibilitychange', onVisibility);
    window.clearTimeout(confirmTimer);
    window.clearTimeout(resizeTimer);
    window.clearInterval(interval);
  };
}
