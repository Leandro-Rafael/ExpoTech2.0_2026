import { useEffect, useMemo, useRef, useState } from 'react';
import { Controller, useForm, useWatch, type Control } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { RotateCcw } from 'lucide-react';
import { mensagemDeErro } from '@/api';
import { useSimular } from '@/api/queries';
import type { SimulationResult } from '@/api/types';
import { GraficoArea, MolduraGrafico, corSerie } from '@/components/charts';
import { Campo, CampoNumero, Esqueleto } from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatarCompacto, formatarNumero } from '@/lib/format';

const esquema = z.object({
  population: z.number({ invalid_type_error: 'Informe a população' }).int('Use um número inteiro').min(1, 'Mínimo de 1').max(50_000_000, 'Máximo de 50 milhões'),
  kgPerCapitaDay: z.number({ invalid_type_error: 'Informe a geração' }).min(0.1, 'Mínimo de 0,1 kg').max(5, 'Máximo de 5 kg'),
  currentRate: z.number({ invalid_type_error: 'Informe a taxa' }).min(0, 'Mínimo de 0%').max(100, 'Máximo de 100%'),
  targetRate: z.number({ invalid_type_error: 'Informe a meta' }).min(0, 'Mínimo de 0%').max(100, 'Máximo de 100%'),
  targetYear: z.number({ invalid_type_error: 'Informe o ano' }).int('Use um ano inteiro').min(2027, 'A partir de 2027').max(2050, 'Até 2050'),
  growth: z.number({ invalid_type_error: 'Informe o crescimento' }).min(-5, 'Mínimo de −5%').max(10, 'Máximo de 10%'),
}).refine((v) => v.targetRate >= v.currentRate, { path: ['targetRate'], message: 'A meta deve ser maior ou igual à taxa atual' });
type Valores = z.infer<typeof esquema>;

const CENARIOS_PRONTOS: { id: string; label: string; v: Valores }[] = [
  { id: 'taboao', label: 'Taboão da Serra', v: { population: 297_000, kgPerCapitaDay: 1, currentRate: 4, targetRate: 35, targetYear: 2040, growth: 1 } },
  { id: 'sp', label: 'São Paulo (capital)', v: { population: 11_900_000, kgPerCapitaDay: 1.1, currentRate: 3, targetRate: 30, targetYear: 2045, growth: 0.8 } },
  { id: 'escola', label: 'Uma escola', v: { population: 1_200, kgPerCapitaDay: 0.3, currentRate: 10, targetRate: 70, targetYear: 2030, growth: 0 } },
];

// Simulador de 2050: o servidor projeta quanto lixo vai para o aterro no ritmo atual e com a meta escolhida.
export function Simulador() {
  const formulario = useForm<Valores>({ resolver: zodResolver(esquema), defaultValues: CENARIOS_PRONTOS[0].v, mode: 'onChange' });
  const { control, reset, formState: { errors } } = formulario;
  const valores = useWatch({ control }) as Valores;
  const simulacao = useSimular();
  const [resultado, setResultado] = useState<SimulationResult | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [cenario, setCenario] = useState<string | null>('taboao');
  const sequencia = useRef(0);

  // Recalcula com debounce sempre que os valores forem válidos.
  const chave = JSON.stringify(valores);
  useEffect(() => {
    const validado = esquema.safeParse(valores);
    if (!validado.success) return;
    const v = validado.data;
    const id = ++sequencia.current;
    const t = window.setTimeout(() => {
      simulacao.mutateAsync({
        population: v.population,
        kgPerCapitaDay: Number(v.kgPerCapitaDay.toFixed(2)),
        currentRecyclingRate: Number((v.currentRate / 100).toFixed(4)),
        targetRecyclingRate: Number((v.targetRate / 100).toFixed(4)),
        targetYear: v.targetYear,
        annualGrowthRate: Number((v.growth / 100).toFixed(4)),
      }).then((r) => { if (id === sequencia.current) { setResultado(r); setErro(null); } })
        .catch((e) => { if (id === sequencia.current) setErro(mensagemDeErro(e)); });
    }, 320);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);

  const v = esquema.safeParse(valores).success ? valores : null;
  const dadosGrafico = useMemo(() => resultado?.years.map((y) => ({
    year: String(y.year),
    baseline: y.landfillTonsBaseline,
    scenario: y.landfillTonsScenario,
  })) ?? [], [resultado]);
  const ultimo = resultado?.years[resultado.years.length - 1];
  const t = resultado?.totals;

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
        {CENARIOS_PRONTOS.map((p) => (
          <button key={p.id} type="button" onClick={() => { reset(p.v); setCenario(p.id); }} aria-pressed={cenario === p.id}
            className={cn('h-8 rounded-lg border px-3 text-xs transition-colors', cenario === p.id ? 'border-fg-soft text-fg' : 'border-line text-muted hover:border-line-strong hover:text-fg')}>
            {p.label}
          </button>
        ))}
        <button type="button" onClick={() => { reset(CENARIOS_PRONTOS[0].v); setCenario('taboao'); }} className="ml-auto inline-flex h-8 items-center gap-1.5 px-2 text-xs text-muted hover:text-fg">
          <RotateCcw className="size-3.5" aria-hidden />Restaurar
        </button>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-10 lg:grid-cols-[340px_minmax(0,1fr)] lg:gap-12">
        <form className="space-y-6" noValidate onSubmit={(e) => e.preventDefault()}>
          <CampoSimulador control={control} name="population" label="População" unidade="hab." casasDecimais={0} min={1} max={50_000_000} step={1000}
            controleDeslizante={{ min: 1000, max: 12_000_000, step: 1000 }} error={errors.population?.message} dica={valores.population ? `${formatarCompacto(valores.population)} pessoas atendidas pela coleta` : 'Pessoas atendidas pela coleta'} aoAlterar={() => setCenario(null)} />
          <CampoSimulador control={control} name="kgPerCapitaDay" label="Lixo por pessoa" unidade="kg/dia" casasDecimais={2} min={0.1} max={5} step={0.05}
            controleDeslizante={{ min: 0.1, max: 3, step: 0.05 }} error={errors.kgPerCapitaDay?.message} dica="Média brasileira ≈ 1,04 kg/dia" aoAlterar={() => setCenario(null)} />
          <div className="grid grid-cols-2 gap-4">
            <CampoSimulador control={control} name="currentRate" label="Taxa atual" unidade="%" casasDecimais={1} min={0} max={100} step={1}
              controleDeslizante={{ min: 0, max: 100, step: 1 }} error={errors.currentRate?.message} aoAlterar={() => setCenario(null)} />
            <CampoSimulador control={control} name="targetRate" label="Meta" unidade="%" casasDecimais={1} min={0} max={100} step={1}
              controleDeslizante={{ min: 0, max: 100, step: 1 }} error={errors.targetRate?.message} aoAlterar={() => setCenario(null)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <CampoSimulador control={control} name="targetYear" label="Atingir em" casasDecimais={0} min={2027} max={2050} step={1}
              controleDeslizante={{ min: 2027, max: 2050, step: 1 }} error={errors.targetYear?.message} aoAlterar={() => setCenario(null)} />
            <CampoSimulador control={control} name="growth" label="Crescimento" unidade="%/ano" casasDecimais={1} min={-5} max={10} step={0.5}
              controleDeslizante={{ min: -5, max: 10, step: 0.5 }} error={errors.growth?.message} aoAlterar={() => setCenario(null)} />
          </div>
          <p className="text-xs leading-relaxed text-subtle">Fatores: 0,9 t de CO₂ evitada por t reciclada · caminhão de 10 t · 2 empregos por mil t/ano recicladas a mais.</p>
        </form>

        <div className="min-w-0">
          {erro && <p role="alert" className="mb-4 text-sm text-danger">{erro}</p>}
          {!resultado ? <Esqueleto className="h-[420px] rounded-2xl" /> : (
            <div className={cn('transition-opacity duration-300', simulacao.isPending && 'opacity-70')} aria-busy={simulacao.isPending}>
              <div className="border-b border-line pb-6">
                <p className="text-sm text-muted">Até 2050, deixam de ir para o aterro</p>
                <p className="mt-2 flex flex-wrap items-baseline gap-x-3">
                  <span className="font-mono text-[clamp(2.75rem,2rem+3vw,4.25rem)] leading-none font-medium tracking-[-0.045em] text-fg">{formatarCompacto(t!.landfillAvoidedTons)}</span>
                  <span className="text-lg text-muted">toneladas</span>
                </p>
                {v && ultimo && (
                  <p className="mt-3 max-w-[62ch] text-sm leading-relaxed text-fg-soft">
                    Levando a reciclagem de {formatarNumero(v.currentRate, 1)}% para {formatarNumero(v.targetRate, 1)}% até {v.targetYear}, em 2050 o aterro recebe{' '}
                    <span className="font-mono text-fg tabular">{formatarCompacto(ultimo.landfillTonsBaseline - ultimo.landfillTonsScenario)} t</span> a menos por ano do que no ritmo atual.
                  </p>
                )}
              </div>

              <dl className="grid grid-cols-2 gap-px border-b border-line bg-line sm:grid-cols-4">
                <Total label="CO₂ evitado" value={`${formatarCompacto(t!.co2AvoidedTons)} t`} dica="emissões de gases de efeito estufa" />
                <Total label="Árvores" value={formatarCompacto(t!.treesEquivalent)} dica="absorvendo CO₂ por um ano" />
                <Total label="Caminhões" value={formatarCompacto(t!.truckloadsAvoided)} dica="viagens ao aterro evitadas" />
                <Total label="Empregos" value={formatarCompacto(t!.jobsCreated)} dica="na cadeia da reciclagem" />
              </dl>

              <MolduraGrafico className="mt-8" title="Lixo enviado ao aterro por ano"
                description="Toneladas por ano · ritmo atual vs. cenário com a meta"
                legenda={[{ label: 'Ritmo atual', cor: corSerie.baseline }, { label: 'Com a meta', cor: corSerie.principal }]}
                resumo={`Em ${ultimo?.year}, o aterro recebe ${formatarCompacto(ultimo?.landfillTonsScenario)} toneladas no cenário contra ${formatarCompacto(ultimo?.landfillTonsBaseline)} no ritmo atual.`}
                tabela={{ colunas: ['Ano', 'Ritmo atual (t)', 'Com a meta (t)'], linhas: dadosGrafico.map((d) => [d.year, formatarNumero(d.baseline), formatarNumero(d.scenario)]) }}>
                <GraficoArea dados={dadosGrafico} chaveX="year" height={280}
                  series={[
                    { chave: 'baseline', label: 'Ritmo atual', cor: corSerie.baseline, soLinha: true },
                    { chave: 'scenario', label: 'Com a meta', cor: corSerie.principal },
                  ]}
                  formatoY={(n) => `${formatarNumero(n)} t`} formatoMarcaY={(n) => formatarCompacto(n)}
                  referenciaX={v ? { value: String(v.targetYear), label: 'meta' } : undefined}
                  ariaLabel="Gráfico de toneladas enviadas ao aterro por ano" />
              </MolduraGrafico>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function Total({ label, value, dica }: { label: string; value: string; dica: string }) {
  return (
    <div className="bg-bg py-5 pr-4 pl-4 first:pl-0 max-sm:[&:nth-child(3)]:pl-0">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-1.5 font-mono text-2xl leading-none font-medium tracking-[-0.03em] text-fg">{value}</dd>
      <dd className="mt-1.5 text-[11px] leading-snug text-subtle">{dica}</dd>
    </div>
  );
}

function CampoSimulador({ control, name, label, unidade, casasDecimais, min, max, step, controleDeslizante, error, dica, aoAlterar }: {
  control: Control<Valores>; name: keyof Valores; label: string; unidade?: string; casasDecimais: number; min: number; max: number; step: number;
  controleDeslizante: { min: number; max: number; step: number }; error?: string; dica?: string; aoAlterar: () => void;
}) {
  return (
    <Campo label={label} erro={error} dica={dica}>
      {(a11y) => (
        <Controller control={control} name={name} render={({ field }) => (
          <div>
            <CampoNumero {...field} {...a11y} value={field.value} onChange={(n) => { field.onChange(n); aoAlterar(); }}
              unidade={unidade} casasDecimais={casasDecimais} min={min} max={max} step={step} permitirNegativo={min < 0} invalido={!!error} />
            <input type="range" aria-label={`${label} (controle deslizante)`} min={controleDeslizante.min} max={controleDeslizante.max} step={controleDeslizante.step}
              value={Math.max(controleDeslizante.min, Math.min(controleDeslizante.max, field.value ?? controleDeslizante.min))}
              onChange={(e) => { field.onChange(Number(e.target.value)); aoAlterar(); }}
              className="mt-2.5 h-1 w-full cursor-pointer accent-[#10b981]" />
          </div>
        )} />
      )}
    </Campo>
  );
}
