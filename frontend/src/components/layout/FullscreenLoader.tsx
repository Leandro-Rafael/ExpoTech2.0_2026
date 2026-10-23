import { LogoMark } from './Logo';

/** Tela de carregamento centralizada (checagem de sessão, chunks grandes). */
export function FullscreenLoader({ label = 'Carregando…' }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-bg">
      <div className="relative">
        <div aria-hidden className="absolute -inset-8 rounded-full bg-brand-500/20 blur-2xl" />
        <LogoMark size={56} spin className="relative" />
      </div>
      <p className="text-sm text-muted">{label}</p>
    </div>
  );
}
