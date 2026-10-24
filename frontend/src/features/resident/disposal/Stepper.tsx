import { Check } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface StepDef { id: string; label: string; hint: string }

/** Indicador de etapas: número mono, rótulo e hairline de progresso. Etapas concluídas são clicáveis. */
export function Stepper({ steps, current, onSelect, maxReached }: { steps: StepDef[]; current: number; maxReached: number; onSelect: (i: number) => void }) {
  return (
    <nav aria-label="Etapas do registro">
      <ol className="grid grid-cols-3 gap-3 sm:gap-6">
        {steps.map((s, i) => {
          const done = i < current;
          const active = i === current;
          const reachable = i <= maxReached && i !== current;
          return (
            <li key={s.id} className="min-w-0">
              <button
                type="button"
                disabled={!reachable}
                onClick={() => onSelect(i)}
                aria-current={active ? 'step' : undefined}
                className={cn('group block w-full text-left disabled:cursor-default', reachable && 'cursor-pointer')}
              >
                <span className="relative block h-0.5 overflow-hidden rounded-full bg-white/8">
                  <span className={cn('absolute inset-y-0 left-0 rounded-full transition-[width] duration-500 ease-[var(--ease-out-expo)]', done ? 'w-full bg-brand-500' : active ? 'w-1/2 bg-fg' : 'w-0')} />
                </span>
                <span className="mt-3 flex items-center gap-2">
                  <span className={cn('font-mono text-xs tabular', active ? 'text-fg' : done ? 'text-success' : 'text-subtle')}>
                    {done ? <Check className="inline size-3.5" aria-hidden /> : String(i + 1).padStart(2, '0')}
                  </span>
                  <span className={cn('truncate text-sm font-medium', active ? 'text-fg' : done ? 'text-fg-soft group-hover:text-fg' : 'text-subtle')}>{s.label}</span>
                  {done && <span className="sr-only">(concluída)</span>}
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
