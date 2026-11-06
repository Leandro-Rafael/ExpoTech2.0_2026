// Etapa 2 do registro de descarte: sugestão da IA, escolha da categoria e dicas de como descartar.
import { BrainCircuit, CheckCircle2, Info, Recycle, Trash2 } from 'lucide-react';
import type { AiSource, Category, CategoryCode } from '@/api/types';
import { IconeCategoria } from '@/components/CategoryIcon';
import { cn } from '@/lib/cn';
import { hexComAlfa } from '@/lib/category';
import { formatarKg, formatarNumero, formatarPercentual } from '@/lib/format';
import { origemIa as aiSourceLabels } from '@/lib/labels';

export interface Sugestao {
  code: CategoryCode;
  confidence: number;
  reasoning: string | null;
  source: AiSource;
  /** true só quando a IA do servidor classificou (vale o bônus de +10%). */
  verified?: boolean;
  labels?: { className: string; probability: number }[];
}

function palavraConfianca(c: number) {
  return c >= 0.75 ? 'alta' : c >= 0.45 ? 'média' : 'baixa';
}

export function PainelSugestao({ sugestao, categoria }: { sugestao: Sugestao; categoria: Category | undefined }) {
  const palavra = palavraConfianca(sugestao.confidence);
  return (
    <section aria-label="Sugestão da IA" className="surface rounded-2xl p-5 sm:p-6">
      <div className="flex items-start gap-4">
        <IconeCategoria icon={categoria?.icon} codigo={sugestao.code} cor={categoria?.color} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="label-mono flex items-center gap-1.5"><BrainCircuit className="size-3.5" aria-hidden /> Sugestão · {aiSourceLabels[sugestao.source].label}</p>
          <p className="mt-1.5 text-xl font-semibold tracking-tight text-fg">{categoria?.name ?? sugestao.code}</p>
        </div>
        <div className="text-right">
          <p className="font-mono text-2xl leading-none font-medium tracking-[-0.03em] text-fg">{formatarPercentual(sugestao.confidence)}</p>
          <p className="mt-1 text-xs text-subtle">confiança {palavra}</p>
        </div>
      </div>
      <div className="mt-4 h-1 overflow-hidden rounded-full bg-white/6" aria-hidden>
        <div className="h-full rounded-full" style={{ width: `${sugestao.confidence * 100}%`, backgroundColor: sugestao.confidence >= 0.45 ? '#10b981' : '#f5b544' }} />
      </div>
      {sugestao.reasoning && <p className="mt-4 text-sm leading-relaxed text-fg-soft">{sugestao.reasoning}</p>}
      {sugestao.labels && sugestao.labels.length > 0 && (
        <details className="group mt-3">
          <summary className="cursor-pointer list-none text-xs text-muted hover:text-fg [&::-webkit-details-marker]:hidden">
            <span className="underline decoration-line-strong underline-offset-4">O que o modelo viu</span>
          </summary>
          <ul className="mt-2 space-y-1 font-mono text-xs text-subtle tabular">
            {sugestao.labels.map((l) => (
              <li key={l.className} className="flex justify-between gap-4"><span className="truncate">{l.className.split(',')[0]}</span><span>{formatarPercentual(l.probability, 1)}</span></li>
            ))}
          </ul>
        </details>
      )}
      {sugestao.verified ? (
        <p className="mt-4 flex items-start gap-2 text-sm text-success"><CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />Confirmado pela IA (+10%): mantendo esta categoria, o descarte rende 10% a mais de pontos na aprovação.</p>
      ) : (
        <p className="mt-4 text-xs text-subtle">Sugestão do navegador — apenas informativa. A análise confirma a categoria.</p>
      )}
      {palavra === 'baixa' && (
        <p className="mt-4 flex items-start gap-2 text-sm text-warning"><Info className="mt-0.5 size-4 shrink-0" aria-hidden />Confiança baixa: confira a categoria abaixo antes de continuar.</p>
      )}
    </section>
  );
}

export function SeletorCategoria({ categorias, value, onChange, sugerida, error }: {
  categorias: Category[]; value: string | undefined; onChange: (id: string) => void; sugerida: CategoryCode | null; error?: string;
}) {
  return (
    <fieldset>
      <legend className="text-[15px] font-semibold text-fg">{sugerida ? 'Confirme ou corrija o material' : 'Qual é o material?'}</legend>
      <p className="mt-0.5 text-sm text-muted">A escolha final é sua — corrigir a sugestão ajuda a calibrar a IA.</p>
      <div role="radiogroup" aria-invalid={error ? true : undefined} className="mt-4 grid gap-2 sm:grid-cols-2">
        {categorias.map((c) => {
          const marcada = value === c.id;
          return (
            <label
              key={c.id}
              className={cn(
                'relative flex cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-3 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent',
                marcada ? 'border-transparent' : 'border-line hover:border-line-strong hover:bg-white/[0.02]',
              )}
              style={marcada ? { backgroundColor: hexComAlfa(c.color, 0.06), boxShadow: `inset 0 0 0 1px ${hexComAlfa(c.color, 0.5)}` } : undefined}
            >
              <input type="radio" name="category" value={c.id} checked={marcada} onChange={() => onChange(c.id)} className="sr-only" />
              <IconeCategoria icon={c.icon} codigo={c.code} cor={c.color} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 text-sm font-medium text-fg">
                  {c.name}
                  {sugerida === c.code && <span className="font-mono text-[10px] tracking-wider text-subtle uppercase">sugerido</span>}
                </span>
                <span className="block font-mono text-[11px] text-subtle tabular">{formatarNumero(c.pointsPerKg)} pts/kg · até {formatarKg(c.maxKgPerDisposal)}</span>
              </span>
              {marcada && <CheckCircle2 className="size-4 shrink-0" style={{ color: c.color }} aria-hidden />}
            </label>
          );
        })}
      </div>
      {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
    </fieldset>
  );
}

export function PainelOrientacao({ categoria }: { categoria: Category }) {
  return (
    <section aria-label={`Como descartar ${categoria.name}`} className="border-t border-line pt-6">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-[15px] font-semibold text-fg">Como descartar {categoria.name.toLowerCase()} corretamente</h3>
        <span className={cn('inline-flex items-center gap-1.5 text-xs', categoria.recyclable ? 'text-success' : 'text-muted')}>
          {categoria.recyclable ? <Recycle className="size-3.5" aria-hidden /> : <Trash2 className="size-3.5" aria-hidden />}
          {categoria.recyclable ? 'Reciclável' : 'Não reciclável'}
        </span>
      </div>
      <p className="mt-1.5 text-sm text-muted">{categoria.description}</p>
      <ol className="mt-4 space-y-2.5">
        {categoria.guidance.map((g, i) => (
          <li key={i} className="flex gap-3 text-sm leading-relaxed text-fg-soft">
            <span className="mt-px font-mono text-xs text-subtle tabular">{String(i + 1).padStart(2, '0')}</span>
            <span>{g}</span>
          </li>
        ))}
      </ol>
      <p className="mt-4 font-mono text-[11px] text-subtle tabular">
        Cada kg evita ≈ {formatarNumero(categoria.co2FactorKg, 2)} kg de CO₂ · {formatarNumero(categoria.pointsPerKg)} pts/kg
      </p>
    </section>
  );
}
