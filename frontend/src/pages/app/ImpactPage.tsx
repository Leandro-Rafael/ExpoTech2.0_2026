import { useMemo, useState } from 'react';
import { Leaf } from 'lucide-react';
import { useImpactSummary } from '@/api/queries';
import type { ImpactSummary } from '@/api/types';
import { AreaChart, BarChart, ChartFrame, Donut, seriesColor } from '@/components/charts';
import { EmptyState, ErrorState, PageHeader, ProgressBar, Skeleton, Tabs } from '@/components/ui';
import { Simulator } from '@/features/resident/impact/Simulator';
import { SectionHeading } from '@/features/resident/shared';
import { cn } from '@/lib/cn';
import { formatCompact, formatKg, formatMonth, formatNumber, formatPercent } from '@/lib/format';

type Scope = 'ME' | 'COMMUNITY';

// Impacto ambiental calculado a partir dos descartes aprovados, mais o simulador de 2050.
export default function ImpactPage() {
  const [scope, setScope] = useState<Scope>('ME');
  const q = useImpactSummary(scope, 12);

  return (
    <>
      <PageHeader eyebrow="Impacto ambiental" title="O que a reciclagem já mudou"
        description="Indicadores calculados a partir dos descartes aprovados. Abaixo, o simulador mostra o que 2050 pode ser se a meta subir."
        actions={<Tabs idBase="imp" aria-label="Escopo" value={scope} onChange={setScope}
          items={[{ value: 'ME', label: 'Eu' }, { value: 'COMMUNITY', label: 'Comunidade' }]} />} />

      <div id={`imp-panel-${scope}`} role="tabpanel" aria-labelledby={`imp-tab-${scope}`}>
        {q.isPending ? (
          <div className="space-y-6"><Skeleton className="h-40 rounded-2xl" /><Skeleton className="h-80 rounded-2xl" /></div>
        ) : q.error ? <ErrorState error={q.error} onRetry={q.refetch} /> : q.data.totalKg === 0 ? (
          <EmptyState icon={Leaf} title="Ainda não há impacto para mostrar"
            description="Assim que seus descartes forem aprovados, os indicadores e gráficos aparecem aqui." />
        ) : (
          <div className={cn('transition-opacity', q.isPlaceholderData && 'opacity-60')}><Overview s={q.data} /></div>
        )}
      </div>

      <Simulator />
    </>
  );
}

function Kpi({ label, value, unit, hint, lead }: { label: string; value: string; unit?: string; hint: string; lead?: boolean }) {
  return (
    <div className="bg-bg py-5 pr-3 pl-3 sm:px-5 max-lg:[&:nth-child(odd)]:pl-0 lg:[&:nth-child(4n+1)]:pl-0">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className={cn('mt-2 font-mono leading-none font-medium tracking-[-0.03em] text-fg', lead ? 'text-[34px]' : 'text-[26px]')}>
        {value}{unit && <span className="ml-1 text-sm font-normal tracking-normal text-muted">{unit}</span>}
      </dd>
      <dd className="mt-2 max-w-[28ch] text-xs leading-relaxed text-subtle">{hint}</dd>
    </div>
  );
}

function Overview({ s }: { s: ImpactSummary }) {
  const months = useMemo(() => s.byMonth.map((m) => ({ ...m, other: Math.max(0, m.kg - m.recycledKg) })), [s.byMonth]);
  const cats = useMemo(() => [...s.byCategory].sort((a, b) => b.kg - a.kg), [s.byCategory]);
  const who = s.scope === 'ME' ? 'seus descartes' : 'a comunidade';

  return (
    <>
      <dl className="grid grid-cols-2 gap-px border-y border-line bg-line lg:grid-cols-4">
        <Kpi label="Resíduos registrados" value={formatKg(s.totalKg)} hint={`${formatNumber(s.disposalsCount)} descartes aprovados de ${who}.`} />
        <Kpi label="Encaminhado à reciclagem" value={formatKg(s.recycledKg)} hint="Parte que volta para a indústria em vez de ir ao aterro." />
        <Kpi label="Taxa de reciclagem" value={formatPercent(s.recyclingRate, 1)} hint="Reciclado ÷ total. A média do Brasil fica perto de 4%." />
        <Kpi label="CO₂ evitado" value={formatKg(s.co2AvoidedKg)} hint="Emissões que deixam de ocorrer ao reciclar em vez de produzir do zero." />
        <Kpi label="Árvores equivalentes" value={formatNumber(s.treesEquivalent)} hint="Árvores que levariam um ano para absorver esse CO₂." />
        <Kpi label="Energia poupada" value={formatCompact(s.energySavedKwh)} unit="kWh" hint="Energia que a indústria deixa de gastar com matéria-prima virgem." />
        <Kpi label="Água poupada" value={formatCompact(s.waterSavedLiters)} unit="L" hint="Água economizada principalmente na produção de papel e plástico." />
        <div className="hidden bg-bg lg:block" aria-hidden />
      </dl>

      <div className="mt-12 grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <ChartFrame title="Evolução mensal" description="Kg por mês, últimos 12 meses"
          legend={[{ label: 'Total registrado', color: seriesColor.baseline }, { label: 'Reciclado', color: seriesColor.primary }]}
          summary={`Em ${formatMonth(months[months.length - 1]?.month ?? '')}, ${formatKg(months[months.length - 1]?.kg)} registrados.`}
          table={{ columns: ['Mês', 'Total (kg)', 'Reciclado (kg)', 'CO₂ (kg)'], rows: months.map((m) => [formatMonth(m.month), formatNumber(m.kg, 1), formatNumber(m.recycledKg, 1), formatNumber(m.co2AvoidedKg, 1)]) }}>
          <AreaChart data={months} xKey="month" xFormat={(v) => formatMonth(String(v))} height={280}
            series={[
              { key: 'kg', label: 'Total registrado', color: seriesColor.baseline, lineOnly: true },
              { key: 'recycledKg', label: 'Reciclado', color: seriesColor.primary },
            ]}
            yFormat={(n) => formatKg(n)} yTickFormat={(n) => formatCompact(n)} ariaLabel="Gráfico de kg por mês" />
        </ChartFrame>

        <ChartFrame title="Por categoria" description="Participação de cada material no total"
          table={{ columns: ['Categoria', 'Kg', '%'], rows: cats.map((c) => [c.name, formatNumber(c.kg, 1), formatPercent(c.percent, 1)]) }}>
          {cats.length ? (
            <Donut data={cats.map((c) => ({ name: c.name, value: c.kg, color: c.color }))} size={176} thickness={16} valueFormat={(v) => formatKg(v)}
              center={<><span className="font-mono text-lg font-medium text-fg">{formatKg(s.totalKg)}</span><span className="text-[11px] text-subtle">total</span></>}
              ariaLabel="Distribuição por categoria" />
          ) : <p className="text-sm text-muted">Sem dados por categoria.</p>}
        </ChartFrame>
      </div>

      <div className="mt-12 grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <ChartFrame title="CO₂ evitado por mês" description="Kg de CO₂ que deixaram de ser emitidos">
          <BarChart data={months} xKey="month" xFormat={(v) => formatMonth(String(v))} height={220}
            series={[{ key: 'co2AvoidedKg', label: 'CO₂ evitado', color: seriesColor.primary }]}
            yFormat={(n) => formatKg(n)} yTickFormat={(n) => formatCompact(n)} ariaLabel="Gráfico de CO₂ evitado por mês" />
        </ChartFrame>

        <section aria-labelledby="goals-h">
          <SectionHeading id="goals-h" title="Metas da cidade" description="Compromissos públicos de reciclagem e o quanto já foi alcançado." />
          {s.goals.length === 0 ? <p className="text-sm text-muted">Nenhuma meta cadastrada.</p> : (
            <ul className="divide-y divide-line border-y border-line">
              {s.goals.map((g) => (
                <li key={g.id} className="py-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-sm font-medium text-fg">{g.title}</p>
                    <span className="font-mono text-xs text-subtle tabular">{g.year}</span>
                  </div>
                  <ProgressBar className="mt-3" value={g.progress} size="xs" valueLabel={null} />
                  <p className="mt-2 flex justify-between gap-3 font-mono text-[11px] text-subtle tabular">
                    <span>taxa {formatPercent(g.currentRate, 1)} de {formatPercent(g.targetRecyclingRate)}</span>
                    <span>{formatCompact(g.currentKg)} de {formatCompact(g.targetKg)} kg</span>
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
