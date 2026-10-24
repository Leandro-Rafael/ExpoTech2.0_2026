/** Selo discreto "Modo demonstração" (DOM puro, fora do React), com botão de resetar os dados. */
const DISMISS_KEY = 'lixozero2050.mock.bannerHidden';

export function mountBanner(onReset: () => void) {
  try {
    if (sessionStorage.getItem(DISMISS_KEY) === '1') return;
  } catch { /* */ }

  const mount = () => {
    if (document.getElementById('lz-mock-banner')) return;
    const el = document.createElement('div');
    el.id = 'lz-mock-banner';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-label', 'Modo demonstração');
    el.style.cssText = [
      'position:fixed', 'left:12px', 'bottom:12px', 'z-index:2147483000', 'display:flex', 'align-items:center', 'gap:8px',
      'padding:6px 6px 6px 12px', 'border-radius:999px', 'font:500 12px/1.2 system-ui,-apple-system,"Segoe UI",sans-serif',
      'color:#eafff3', 'background:rgba(9,46,34,.88)', 'border:1px solid rgba(132,204,22,.45)',
      'box-shadow:0 6px 24px rgba(0,0,0,.25)', 'backdrop-filter:blur(6px)', '-webkit-backdrop-filter:blur(6px)', 'max-width:calc(100vw - 24px)',
    ].join(';');

    const dot = document.createElement('span');
    dot.style.cssText = 'width:8px;height:8px;border-radius:50%;background:#84cc16;flex:none;box-shadow:0 0 0 3px rgba(132,204,22,.25)';
    const label = document.createElement('span');
    label.textContent = 'Modo demonstração — dados simulados';
    label.style.cssText = 'white-space:nowrap;overflow:hidden;text-overflow:ellipsis';

    const btn = (text: string, title: string) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = text;
      b.title = title;
      b.style.cssText = 'all:unset;cursor:pointer;padding:4px 10px;border-radius:999px;background:rgba(255,255,255,.1);color:#eafff3;font:600 12px/1.2 inherit;white-space:nowrap';
      b.onmouseenter = () => { b.style.background = 'rgba(255,255,255,.2)'; };
      b.onmouseleave = () => { b.style.background = 'rgba(255,255,255,.1)'; };
      b.onfocus = () => { b.style.outline = '2px solid #84cc16'; };
      b.onblur = () => { b.style.outline = 'none'; };
      return b;
    };
    const reset = btn('Resetar dados', 'Apaga as alterações e recria os dados de demonstração');
    reset.onclick = () => {
      if (confirm('Resetar todos os dados da demonstração? Suas alterações serão perdidas.')) onReset();
    };
    const close = btn('✕', 'Ocultar este aviso');
    close.setAttribute('aria-label', 'Ocultar aviso do modo demonstração');
    close.style.padding = '4px 8px';
    close.onclick = () => {
      try { sessionStorage.setItem(DISMISS_KEY, '1'); } catch { /* */ }
      el.remove();
    };

    el.append(dot, label, reset, close);
    document.body.appendChild(el);
  };

  if (document.body) mount();
  else document.addEventListener('DOMContentLoaded', mount, { once: true });
}
