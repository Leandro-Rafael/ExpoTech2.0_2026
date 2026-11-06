import { Check } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface DefinicaoEtapa { id: string; label: string; hint: string }

/** Indicador de etapas: número mono, rótulo e hairline de progresso. Etapas concluídas são clicáveis. */
export function IndicadorEtapas({ etapas, atual, aoSelecionar, maximoAlcancado }: { etapas: DefinicaoEtapa[]; atual: number; maximoAlcancado: number; aoSelecionar: (i: number) => void }) {
  return (
    <nav aria-label="Etapas do registro">
      <ol className="grid grid-cols-3 gap-3 sm:gap-6">
        {etapas.map((s, i) => {
          const concluida = i < atual;
          const ativa = i === atual;
          const alcancavel = i <= maximoAlcancado && i !== atual;
          return (
            <li key={s.id} className="min-w-0">
              <button
                type="button"
                disabled={!alcancavel}
                onClick={() => aoSelecionar(i)}
                aria-current={ativa ? 'step' : undefined}
                className={cn('group block w-full text-left disabled:cursor-default', alcancavel && 'cursor-pointer')}
              >
                <span className="relative block h-0.5 overflow-hidden rounded-full bg-white/8">
                  <span className={cn('absolute inset-y-0 left-0 rounded-full transition-[width] duration-500 ease-[var(--ease-out-expo)]', concluida ? 'w-full bg-brand-500' : ativa ? 'w-1/2 bg-fg' : 'w-0')} />
                </span>
                <span className="mt-3 flex items-center gap-2">
                  <span className={cn('font-mono text-xs tabular', ativa ? 'text-fg' : concluida ? 'text-success' : 'text-subtle')}>
                    {concluida ? <Check className="inline size-3.5" aria-hidden /> : String(i + 1).padStart(2, '0')}
                  </span>
                  <span className={cn('truncate text-sm font-medium', ativa ? 'text-fg' : concluida ? 'text-fg-soft group-hover:text-fg' : 'text-subtle')}>{s.label}</span>
                  {concluida && <span className="sr-only">(concluída)</span>}
                </span>
                <span className="mt-0.5 hidden truncate text-xs text-subtle sm:block">{s.hint}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
