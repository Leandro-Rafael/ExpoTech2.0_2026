import { MarcaLogo } from './Logo';

/** Tela de carregamento centralizada (checagem de sessão, chunks grandes). */
export function CarregamentoTelaCheia({ label = 'Carregando…' }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-bg">
      <div className="relative">
        <MarcaLogo size={56} girar className="relative" />
      </div>
      <p className="text-sm text-muted">{label}</p>
    </div>
  );
}
