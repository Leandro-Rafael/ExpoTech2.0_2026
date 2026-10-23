import { useEffect, useRef, type RefObject } from 'react';

const FOCUSABLE = [
  'a[href]', 'area[href]', 'button:not([disabled])', 'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])', 'textarea:not([disabled])', 'iframe', '[tabindex]:not([tabindex="-1"])', '[contenteditable="true"]',
].join(',');

/**
 * Prende o foco dentro de `ref` enquanto `active`; Esc chama `onEscape`;
 * ao desativar, devolve o foco ao elemento que estava focado antes.
 */
export function useFocusTrap(ref: RefObject<HTMLElement | null>, active: boolean, opts: { onEscape?: () => void; initialFocus?: RefObject<HTMLElement | null> } = {}) {
  const optsRef = useRef(opts);
  optsRef.current = opts; // callbacks inline não reiniciam o efeito
  useEffect(() => {
    if (!active) return;
    const previous = document.activeElement as HTMLElement | null;
    const root = ref.current;
    const focusables = () => Array.from(root?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []).filter((el) => el.offsetParent !== null || el === document.activeElement);

    const t = window.setTimeout(() => {
      const target = optsRef.current.initialFocus?.current ?? root?.querySelector<HTMLElement>('[data-autofocus]') ?? focusables()[0] ?? root;
      target?.focus({ preventScroll: true });
    }, 30);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); optsRef.current.onEscape?.(); return; }
      if (e.key !== 'Tab' || !root) return;
      const items = focusables();
      if (!items.length) { e.preventDefault(); return; }
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === first || !root.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener('keydown', onKey, true);
      previous?.focus?.({ preventScroll: true });
    };
  }, [active, ref]);
}

/** Trava o scroll do body enquanto `active` (com contador para overlays empilhados). */
let locks = 0;
export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    locks++;
    const html = document.documentElement;
    const prev = html.style.overflow;
    const sbw = window.innerWidth - html.clientWidth;
    html.style.overflow = 'hidden';
    if (sbw > 0) html.style.paddingRight = `${sbw}px`;
    return () => {
      locks--;
      if (locks === 0) { html.style.overflow = prev; html.style.paddingRight = ''; }
    };
  }, [active]);
}
