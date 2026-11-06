import { useEffect, useRef, type RefObject } from 'react';

const SELETOR_FOCAVEIS = [
  'a[href]', 'area[href]', 'button:not([disabled])', 'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])', 'textarea:not([disabled])', 'iframe', '[tabindex]:not([tabindex="-1"])', '[contenteditable="true"]',
].join(',');

/**
 * Prende o foco dentro de `ref` enquanto `active`; Esc chama `onEscape`;
 * ao desativar, devolve o foco ao elemento que estava focado antes.
 */
export function usePrenderFoco(ref: RefObject<HTMLElement | null>, ativo: boolean, opcoes: { onEscape?: () => void; focoInicial?: RefObject<HTMLElement | null> } = {}) {
  const opcoesRef = useRef(opcoes);
  opcoesRef.current = opcoes; // callbacks inline não reiniciam o efeito
  useEffect(() => {
    if (!ativo) return;
    const anterior = document.activeElement as HTMLElement | null;
    const raiz = ref.current;
    const listarFocaveis = () => Array.from(raiz?.querySelectorAll<HTMLElement>(SELETOR_FOCAVEIS) ?? []).filter((el) => el.offsetParent !== null || el === document.activeElement);

    const t = window.setTimeout(() => {
      const alvo = opcoesRef.current.focoInicial?.current ?? raiz?.querySelector<HTMLElement>('[data-autofocus]') ?? listarFocaveis()[0] ?? raiz;
      alvo?.focus({ preventScroll: true });
    }, 30);

    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); opcoesRef.current.onEscape?.(); return; }
      if (e.key !== 'Tab' || !raiz) return;
      const itens = listarFocaveis();
      if (!itens.length) { e.preventDefault(); return; }
      const primeiro = itens[0];
      const ultimo = itens[itens.length - 1];
      if (e.shiftKey && (document.activeElement === primeiro || !raiz.contains(document.activeElement))) { e.preventDefault(); ultimo.focus(); }
      else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primeiro.focus(); }
    };
    document.addEventListener('keydown', aoTeclar, true);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener('keydown', aoTeclar, true);
      anterior?.focus?.({ preventScroll: true });
    };
  }, [ativo, ref]);
}

/** Trava o scroll do body enquanto `active` (com contador para overlays empilhados). */
let travas = 0;
export function useTravarRolagem(ativo: boolean) {
  useEffect(() => {
    if (!ativo) return;
    travas++;
    const html = document.documentElement;
    const anterior = html.style.overflow;
    const larguraBarra = window.innerWidth - html.clientWidth;
    html.style.overflow = 'hidden';
    if (larguraBarra > 0) html.style.paddingRight = `${larguraBarra}px`;
    return () => {
      travas--;
      if (travas === 0) { html.style.overflow = anterior; html.style.paddingRight = ''; }
    };
  }, [ativo]);
}
