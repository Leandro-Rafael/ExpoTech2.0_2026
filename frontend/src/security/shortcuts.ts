import type { InspectionTrigger } from '@/api/types';

/**
 * Identifica atalhos que abrem as ferramentas do desenvolvedor ou o código-fonte:
 * F12 · Ctrl/Cmd+Shift+I/J/C · Ctrl/Cmd+U · (mac) Cmd+Option+I/J/C/U.
 *
 * A letra vem de `e.key` quando é uma letra ASCII (respeita o layout do teclado; Shift a deixa
 * maiúscula, por isso comparamos em maiúsculas) e, senão, de `e.code` (no mac, Option troca `e.key`
 * por símbolos como "ˆ", mas `e.code` continua "KeyI").
 */
export function matchInspectionShortcut(e: KeyboardEvent): InspectionTrigger | null {
  if (e.key === 'F12' || e.code === 'F12') return 'F12';
  if (!e.ctrlKey && !e.metaKey) return null;

  const key = typeof e.key === 'string' && /^[a-z]$/i.test(e.key) ? e.key.toUpperCase() : null;
  const fromCode = typeof e.code === 'string' && /^Key[A-Z]$/.test(e.code) ? e.code.slice(3) : null;
  const letter = key ?? fromCode;
  if (!letter) return null;

  // Ctrl/Cmd+Shift+I/J/C (Windows, Linux e mac) ou Cmd+Option+I/J/C (mac)
  const devtoolsCombo = (e.shiftKey && !e.altKey) || (e.metaKey && e.altKey && !e.shiftKey);
  if (devtoolsCombo) {
    if (letter === 'I') return 'CTRL_SHIFT_I';
    if (letter === 'J') return 'CTRL_SHIFT_J';
    if (letter === 'C') return 'CTRL_SHIFT_C';
  }
  // Ctrl/Cmd+U (ver código-fonte) ou Cmd+Option+U (mac)
  if (letter === 'U' && !e.shiftKey && (!e.altKey || e.metaKey)) return 'CTRL_U';
  return null;
}
