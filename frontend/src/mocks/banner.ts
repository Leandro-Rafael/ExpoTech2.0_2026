/** Selo discreto "Modo demonstração" (DOM puro, fora do React), com botão de resetar os dados. */
const CHAVE_OCULTAR = 'lixozero2050.mock.bannerHidden';

export function montarSelo(aoResetar: () => void) {
  try {
    if (sessionStorage.getItem(CHAVE_OCULTAR) === '1') return;
  } catch { /* */ }

  const montar = () => {
    if (document.getElementById('lz-mock-banner')) return;
    const el = document.createElement('div');
    el.id = 'lz-mock-banner';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-label', 'Modo demonstração');
    el.style.cssText = [
      'position:fixed', 'left:12px', (window.matchMedia('(max-width: 1023px)').matches ? 'bottom:calc(84px + env(safe-area-inset-bottom))' : 'bottom:12px'), 'z-index:2147483000', 'display:flex', 'align-items:center', 'gap:8px',
      'padding:6px 6px 6px 12px', 'border-radius:999px', 'font:500 12px/1.2 system-ui,-apple-system,"Segoe UI",sans-serif',
      'color:#eafff3', 'background:rgba(9,46,34,.88)', 'border:1px solid rgba(132,204,22,.45)',
      'box-shadow:0 6px 24px rgba(0,0,0,.25)', 'backdrop-filter:blur(6px)', '-webkit-backdrop-filter:blur(6px)', 'max-width:calc(100vw - 24px)',
    ].join(';');

    const ponto = document.createElement('span');
    ponto.style.cssText = 'width:8px;height:8px;border-radius:50%;background:#84cc16;flex:none;box-shadow:0 0 0 3px rgba(132,204,22,.25)';
    const rotulo = document.createElement('span');
    rotulo.textContent = 'Modo demonstração — dados simulados';
    rotulo.style.cssText = 'white-space:nowrap;overflow:hidden;text-overflow:ellipsis';

    const botao = (texto: string, titulo: string) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = texto;
      b.title = titulo;
      b.style.cssText = 'all:unset;cursor:pointer;padding:4px 10px;border-radius:999px;background:rgba(255,255,255,.1);color:#eafff3;font:600 12px/1.2 inherit;white-space:nowrap';
      b.onmouseenter = () => { b.style.background = 'rgba(255,255,255,.2)'; };
      b.onmouseleave = () => { b.style.background = 'rgba(255,255,255,.1)'; };
      b.onfocus = () => { b.style.outline = '2px solid #84cc16'; };
      b.onblur = () => { b.style.outline = 'none'; };
      return b;
    };
    const botaoResetar = botao('Resetar dados', 'Apaga as alterações e recria os dados de demonstração');
    botaoResetar.onclick = () => {
      if (confirm('Resetar todos os dados da demonstração? Suas alterações serão perdidas.')) aoResetar();
    };
    const botaoFechar = botao('✕', 'Ocultar este aviso');
    botaoFechar.setAttribute('aria-label', 'Ocultar aviso do modo demonstração');
    botaoFechar.style.padding = '4px 8px';
    botaoFechar.onclick = () => {
      try { sessionStorage.setItem(CHAVE_OCULTAR, '1'); } catch { /* */ }
      el.remove();
    };

    el.append(ponto, rotulo, botaoResetar, botaoFechar);
    document.body.appendChild(el);
  };

  if (document.body) montar();
  else document.addEventListener('DOMContentLoaded', montar, { once: true });
}
