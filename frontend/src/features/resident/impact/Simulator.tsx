import { useEffect, useMemo, useRef, useState } from 'react';
import { Controller, useForm, useWatch, type Control } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { RotateCcw } from 'lucide-react';
import { errorMessage } from '@/api';
import { useSimulate } from '@/api/queries';
import type { SimulationResult } from '@/api/types';
import { AreaChart, ChartFrame, seriesColor } from '@/components/charts';
import { Field, NumberInput, Skeleton } from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatCompact, formatNumber } from '@/lib/format';

const schema = z.object({
  population: z.number({ invalid_type_error: 'Informe a população' }).int('Use um número inteiro').min(1, 'Mínimo de 1').max(50_000_000, 'Máximo de 50 milhões'),
  kgPerCapitaDay: z.number({ invalid_type_error: 'Informe a geração' }).min(0.1, 'Mínimo de 0,1 kg').max(5, 'Máximo de 5 kg'),
  currentRate: z.number({ invalid_type_error: 'Informe a taxa' }).min(0, 'Mínimo de 0%').max(100, 'Máximo de 100%'),
  targetRate: z.number({ invalid_type_error: 'Informe a meta' }).min(0, 'Mínimo de 0%').max(100, 'Máximo de 100%'),
  targetYear: z.number({ invalid_type_error: 'Informe o ano' }).int('Use um ano inteiro').min(2027, 'A partir de 2027').max(2050, 'Até 2050'),
  growth: z.number({ invalid_type_error: 'Informe o crescimento' }).min(-5, 'Mínimo de −5%').max(10, 'Máximo de 10%'),
}).refine((v) => v.targetRate >= v.currentRate, { path: ['targetRate'], message: 'A meta deve ser maior ou igual à taxa atual' });
type Values = z.infer<typeof schema>;

const PRESETS: { id: string; label: string; v: Values }[] = [
  { id: 'taboao', label: 'Taboão da Serra', v: { population: 297_000, kgPerCapitaDay: 1, currentRate: 4, targetRate: 35, targetYear: 2040, growth: 1 } },
  { id: 'sp', label: 'São Paulo (capital)', v: { population: 11_900_000, kgPerCapitaDay: 1.1, currentRate: 3, targetRate: 30, targetYear: 2045, growth: 0.8 } },
  { id: 'escola', label: 'Uma escola', v: { population: 1_200, kgPerCapitaDay: 0.3, currentRate: 10, targetRate: 70, targetYear: 2030, growth: 0 } },
];

export function Simulator() {
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: PRESETS[0].v, mode: 'onChange' });
  const { control, reset, formState: { errors } } = form;
  const values = useWatch({ control }) as Values;
  const sim = useSimulate();
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preset, setPreset] = useState<string | null>('taboao');
  const seq = useRef(0);

  // Recalcula com debounce sempre que os valores forem válidos.
  const key = JSON.stringify(values);
  useEffect(() => {
    const parsed = schema.safeParse(values);
    if (!parsed.success) return;
    const v = parsed.data;
    const id = ++seq.current;
    const t = window.setTimeout(() => {
      sim.mutateAsync({
        population: v.population,
        kgPerCapitaDay: Number(v.kgPerCapitaDay.toFixed(2)),
        currentRecyclingRate: Number((v.currentRate / 100).toFixed(4)),
        targetRecyclingRate: Number((v.targetRate / 100).toFixed(4)),
        targetYear: v.targetYear,
        annualGrowthRate: Number((v.growth / 100).toFixed(4)),
      }).then((r) => { if (id === seq.current) { setResult(r); setError(null); } })
        .catch((e) => { if (id === seq.current) setError(errorMessage(e)); });
    }, 320);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const v = schema.safeParse(values).success ? values : null;
  const chartData = useMemo(() => result?.years.map((y) => ({
    year: String(y.year),
    baseline: y.landfillTonsBaseline,
    scenario: y.landfillTonsScenario,
  })) ?? [], [result]);
  const last = result?.years[result.years.length - 1];
  const t = result?.totals;

  return (
    <section aria-labelledby="sim-h" className="mt-20 border-t border-line pt-14">
      <div className="max-w-3xl">
        <p className="label-mono">Simulador 2050</p>
        <h2 id="sim-h" className="mt-3 text-[clamp(2rem,1.5rem+1.8vw,3rem)] leading-[1.05] text-fg">
          E se a cidade inteira <em>reciclasse mais?</em>
        </h2>
        <p className="mt-4 text-[15px] leading-relaxed text-muted sm:text-base">
          Ajuste a população, o lixo gerado por pessoa e a meta de reciclagem. O modelo projeta ano a ano até 2050 — a taxa sobe em linha reta até a meta e se mantém depois.
        </p>
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-2" role="group" aria-label="Cenários prontos">
        <span className="mr-1 text-xs text-subtle">Começar de:</span>
        {PRESETS.map((p) => (
          <button key={p.id} type="button" onClick={() => { reset(p.v); setPreset(p.id); }} aria-pressed={preset === p.id}
            className={cn('h-8 rounded-lg border px-3 text-xs transition-colors', preset === p.id ? 'border-fg-soft text-fg' : 'border-line text-muted hover:border-line-strong hover:text-fg')}>
            {p.label}
          </button>
        ))}
        <button type="button" onClick={() => { reset(PRESETS[0].v); setPreset('taboao'); }} className="ml-auto inline-flex h-8 items-center gap-1.5 px-2 text-xs text-muted hover:text-fg">
          <RotateCcw className="size-3.5" aria-hidden />Restaurar
        </button>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-10 lg:grid-cols-[340px_minmax(0,1fr)] lg:gap-12">
        <form className="space-y-6" noValidate onSubmit={(e) => e.preventDefault()}>
          <SimField control={control} name="population" label="População" unit="hab." decimals={0} min={1} max={50_000_000} step={1000}
            slider={{ min: 1000, max: 12_000_000, step: 1000 }} error={errors.population?.message} hint={values.population ? `${formatCompact(values.population)} pessoas atendidas pela coleta` : 'Pessoas atendidas pela coleta'} onTouched={() => setPreset(null)} />
          <SimField control={control} name="kgPerCapitaDay" label="Lixo por pessoa" unit="kg/dia" decimals={2} min={0.1} max={5} step={0.05}
            slider={{ min: 0.1, max: 3, step: 0.05 }} error={errors.kgPerCapitaDay?.message} hint="Média brasileira ≈ 1,04 kg/dia" onTouched={() => setPreset(null)} />
          <div className="grid grid-cols-2 gap-4">
            <SimField control={control} name="currentRate" label="Taxa atual" unit="%" decimals={1} min={0} max={100} step={1}
              slider={{ min: 0, max: 100, step: 1 }} error={errors.currentRate?.message} onTouched={() => setPreset(null)} />
            <SimField control={control} name="targetRate" label="Meta" unit="%" decimals={1} min={0} max={100} step={1}
              slider={{ min: 0, max: 100, step: 1 }} error={errors.targetRate?.message} onTouched={() => setPreset(null)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <SimField control={control} name="targetYear" label="Atingir em" decimals={0} min={2027} max={2050} step={1}
              slider={{ min: 2027, max: 2050, step: 1 }} error={errors.targetYear?.message} onTouched={() => setPreset(null)} />
            <SimField control={control} name="growth" label="Crescimento" unit="%/ano" decimals={1} min={-5} max={10} step={0.5}
              slider={{ min: -5, max: 10, step: 0.5 }} error={errors.growth?.message} onTouched={() => setPreset(null)} />
          </div>
          <p className="text-xs leading-relaxed text-subtle">Fatores: 0,9 t de CO₂ evitada por t reciclada · caminhão de 10 t · 2 empregos por mil t/ano recicladas a mais.</p>
        </form>

        <div className="min-w-0">
          {error && <p role="alert" className="mb-4 text-sm text-danger">{error}</p>}
          {!result ? <Skeleton className="h-[420px] rounded-2xl" /> : (
            <div className={cn('transition-opacity duration-300', sim.isPending && 'opacity-70')} aria-busy={sim.isPending}>
              <div className="border-b border-line pb-6">
                <p className="text-sm text-muted">Até 2050, deixam de ir para o aterro</p>
                <p className="mt-2 flex flex-wrap items-baseline gap-x-3">
                  <span className="font-mono text-[clamp(2.75rem,2rem+3vw,4.25rem)] leading-none font-medium tracking-[-0.045em] text-fg">{formatCompact(t!.landfillAvoidedTons)}</span>
                  <span className="text-lg text-muted">toneladas</span>
                </p>
                {v && last && (
                  <p className="mt-3 max-w-[62ch] text-sm leading-relaxed text-fg-soft">
                    Levando a reciclagem de {formatNumber(v.currentRate, 1)}% para {formatNumber(v.targetRate, 1)}% até {v.targetYear}, em 2050 o aterro recebe{' '}
                    <span className="font-mono text-fg tabular">{formatCompact(last.landfillTonsBaseline - last.landfillTonsScenario)} t</span> a menos por ano do que no ritmo atual.
                  </p>
                )}
              </div>

              <dl className="grid grid-cols-2 gap-px border-b border-line bg-line sm:grid-cols-4">
                <Total label="CO₂ evitado" value={`${formatCompact(t!.co2AvoidedTons)} t`} hint="emissões de gases de efeito estufa" />
                <Total label="Árvores" value={formatCompact(t!.treesEquivalent)} hint="absorvendo CO₂ por um ano" />
                <Total label="Caminhões" value={formatCompact(t!.truckloadsAvoided)} hint="viagens ao aterro evitadas" />
                <Total label="Empregos" value={formatCompact(t!.jobsCreated)} hint="na cadeia da reciclagem" />
              </dl>

              <ChartFrame className="mt-8" title="Lixo enviado ao aterro por ano"
                description="Toneladas por ano · ritmo atual vs. cenário com a meta"
                legend={[{ label: 'Ritmo atual', color: seriesColor.baseline }, { label: 'Com a meta', color: seriesColor.primary }]}
                summary={`Em ${last?.year}, o aterro recebe ${formatCompact(last?.landfillTonsScenario)} toneladas no cenário contra ${formatCompact(last?.landfillTonsBaseline)} no ritmo atual.`}
                table={{ columns: ['Ano', 'Ritmo atual (t)', 'Com a meta (t)'], rows: chartData.map((d) => [d.year, formatNumber(d.baseline), formatNumber(d.scenario)]) }}>
                <AreaChart data={chartData} xKey="year" height={280}
                  series={[
                    { key: 'baseline', label: 'Ritmo atual', color: seriesColor.baseline, lineOnly: true },
                    { key: 'scenario', label: 'Com a meta', color: seriesColor.primary },
                  ]}
                  yFormat={(n) => `${formatNumber(n)} t`} yTickFormat={(n) => formatCompact(n)}
                  referenceX={v ? { value: String(v.targetYear), label: 'meta' } : undefined}
                  ariaLabel="Gráfico de toneladas enviadas ao aterro por ano" />
              </ChartFrame>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function Total({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="bg-bg py-5 pr-4 pl-4 first:pl-0 max-sm:[&:nth-child(3)]:pl-0">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-1.5 font-mono text-2xl leading-none font-medium tracking-[-0.03em] text-fg">{value}</dd>
      <dd className="mt-1.5 text-[11px] leading-snug text-subtle">{hint}</dd>
    </div>
  );
}

function SimField({ control, name, label, unit, decimals, min, max, step, slider, error, hint, onTouched }: {
  control: Control<Values>; name: keyof Values; label: string; unit?: string; decimals: number; min: number; max: number; step: number;
  slider: { min: number; max: number; step: number }; error?: string; hint?: string; onTouched: () => void;
}) {
  return (
    <Field label={label} error={error} hint={hint}>
      {(a11y) => (
        <Controller control={control} name={name} render={({ field }) => (
          <div>
            <NumberInput {...field} {...a11y} value={field.value} onChange={(n) => { field.onChange(n); onTouched(); }}
              unit={unit} decimals={decimals} min={min} max={max} step={step} allowNegative={min < 0} invalid={!!error} />
            <input type="range" aria-label={`${label} (controle deslizante)`} min={slider.min} max={slider.max} step={slider.step}
              value={Math.max(slider.min, Math.min(slider.max, field.value ?? slider.min))}
              onChange={(e) => { field.onChange(Number(e.target.value)); onTouched(); }}
              className="mt-2.5 h-1 w-full cursor-pointer accent-[#10b981]" />
          </div>
        )} />
      )}
    </Field>
  );
}
