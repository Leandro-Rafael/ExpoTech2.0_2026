import { useMemo, useState } from 'react';
import { Leaf } from 'lucide-react';
import { useResumoImpacto } from '@/api/queries';
import type { ImpactSummary } from '@/api/types';
import { GraficoArea, GraficoBarras, MolduraGrafico, Rosca, corSerie } from '@/components/charts';
import { EstadoVazio, EstadoErro, CabecalhoPagina, BarraProgresso, Esqueleto, Abas } from '@/components/ui';
import { Simulador } from '@/features/resident/impact/Simulator';
import { TituloSecao } from '@/features/resident/shared';
import { cn } from '@/lib/cn';
import { formatarCompacto, formatarKg, formatarMes, formatarNumero, formatarPercentual } from '@/lib/format';

type Escopo = 'ME' | 'COMMUNITY';

// Impacto ambiental calculado a partir dos descartes aprovados, mais o simulador de 2050.
export default function PaginaImpacto() {
  const [escopo, setEscopo] = useState<Escopo>('ME');
  const q = useResumoImpacto(escopo, 12);

  return (
    <>
      <CabecalhoPagina sobretitulo="Impacto ambiental" title="O que a reciclagem já mudou"
        description="Indicadores calculados a partir dos descartes aprovados. Abaixo, o simulador mostra o que 2050 pode ser se a meta subir."
        acoes={<Abas idBase="imp" aria-label="Escopo" value={escopo} onChange={setEscopo}
          itens={[{ value: 'ME', label: 'Eu' }, { value: 'COMMUNITY', label: 'Comunidade' }]} />} />

      <div id={`imp-panel-${escopo}`} role="tabpanel" aria-labelledby={`imp-tab-${escopo}`}>
        {q.isPending ? (
          <div className="space-y-6"><Esqueleto className="h-40 rounded-2xl" /><Esqueleto className="h-80 rounded-2xl" /></div>
        ) : q.error ? <EstadoErro erro={q.error} aoTentarDeNovo={q.refetch} /> : q.data.totalKg === 0 ? (
          <EstadoVazio icon={Leaf} title="Ainda não há impacto para mostrar"
            description="Assim que seus descartes forem aprovados, os indicadores e gráficos aparecem aqui." />
        ) : (
          <div className={cn('transition-opacity', q.isPlaceholderData && 'opacity-60')}><VisaoGeral s={q.data} /></div>
        )}
      </div>

      <Simulador />
    </>
  );
}

function Indicador({ label, value, unidade, dica, destaque }: { label: string; value: string; unidade?: string; dica: string; destaque?: boolean }) {
  return (
    <div className="bg-bg py-5 pr-3 pl-3 sm:px-5 max-lg:[&:nth-child(odd)]:pl-0 lg:[&:nth-child(4n+1)]:pl-0">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className={cn('mt-2 font-mono leading-none font-medium tracking-[-0.03em] text-fg', destaque ? 'text-[34px]' : 'text-[26px]')}>
        {value}{unidade && <span className="ml-1 text-sm font-normal tracking-normal text-muted">{unidade}</span>}
      </dd>
      <dd className="mt-2 max-w-[28ch] text-xs leading-relaxed text-subtle">{dica}</dd>
    </div>
  );
}

function VisaoGeral({ s }: { s: ImpactSummary }) {
  const meses = useMemo(() => s.byMonth.map((m) => ({ ...m, other: Math.max(0, m.kg - m.recycledKg) })), [s.byMonth]);
  const categorias = useMemo(() => [...s.byCategory].sort((a, b) => b.kg - a.kg), [s.byCategory]);
  const quem = s.scope === 'ME' ? 'seus descartes' : 'a comunidade';

  return (
    <>
      <dl className="grid grid-cols-2 gap-px border-y border-line bg-line lg:grid-cols-4">
        <Indicador label="Resíduos registrados" value={formatarKg(s.totalKg)} dica={`${formatarNumero(s.disposalsCount)} descartes aprovados de ${quem}.`} />
        <Indicador label="Encaminhado à reciclagem" value={formatarKg(s.recycledKg)} dica="Parte que volta para a indústria em vez de ir ao aterro." />
        <Indicador label="Taxa de reciclagem" value={formatarPercentual(s.recyclingRate, 1)} dica="Reciclado ÷ total. A média do Brasil fica perto de 4%." />
        <Indicador label="CO₂ evitado" value={formatarKg(s.co2AvoidedKg)} dica="Emissões que deixam de ocorrer ao reciclar em vez de produzir do zero." />
        <Indicador label="Árvores equivalentes" value={formatarNumero(s.treesEquivalent)} dica="Árvores que levariam um ano para absorver esse CO₂." />
        <Indicador label="Energia poupada" value={formatarCompacto(s.energySavedKwh)} unidade="kWh" dica="Energia que a indústria deixa de gastar com matéria-prima virgem." />
        <Indicador label="Água poupada" value={formatarCompacto(s.waterSavedLiters)} unidade="L" dica="Água economizada principalmente na produção de papel e plástico." />
        <div className="hidden bg-bg lg:block" aria-hidden />
      </dl>

      <div className="mt-12 grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <MolduraGrafico title="Evolução mensal" description="Kg por mês, últimos 12 meses"
          legenda={[{ label: 'Total registrado', cor: corSerie.baseline }, { label: 'Reciclado', cor: corSerie.principal }]}
          resumo={`Em ${formatarMes(meses[meses.length - 1]?.month ?? '')}, ${formatarKg(meses[meses.length - 1]?.kg)} registrados.`}
          tabela={{ colunas: ['Mês', 'Total (kg)', 'Reciclado (kg)', 'CO₂ (kg)'], linhas: meses.map((m) => [formatarMes(m.month), formatarNumero(m.kg, 1), formatarNumero(m.recycledKg, 1), formatarNumero(m.co2AvoidedKg, 1)]) }}>
          <GraficoArea dados={meses} chaveX="month" formatoX={(v) => formatarMes(String(v))} height={280}
            series={[
              { chave: 'kg', label: 'Total registrado', cor: corSerie.baseline, soLinha: true },
              { chave: 'recycledKg', label: 'Reciclado', cor: corSerie.principal },
            ]}
            formatoY={(n) => formatarKg(n)} formatoMarcaY={(n) => formatarCompacto(n)} ariaLabel="Gráfico de kg por mês" />
        </MolduraGrafico>

        <MolduraGrafico title="Por categoria" description="Participação de cada material no total"
          tabela={{ colunas: ['Categoria', 'Kg', '%'], linhas: categorias.map((c) => [c.name, formatarNumero(c.kg, 1), formatarPercentual(c.percent, 1)]) }}>
          {categorias.length ? (
            <Rosca dados={categorias.map((c) => ({ name: c.name, value: c.kg, color: c.color }))} size={176} espessura={16} formatoValor={(v) => formatarKg(v)}
              centro={<><span className="font-mono text-lg font-medium text-fg">{formatarKg(s.totalKg)}</span><span className="text-[11px] text-subtle">total</span></>}
              ariaLabel="Distribuição por categoria" />
          ) : <p className="text-sm text-muted">Sem dados por categoria.</p>}
        </MolduraGrafico>
      </div>

      <div className="mt-12 grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <MolduraGrafico title="CO₂ evitado por mês" description="Kg de CO₂ que deixaram de ser emitidos">
          <GraficoBarras dados={meses} chaveX="month" formatoX={(v) => formatarMes(String(v))} height={220}
            series={[{ chave: 'co2AvoidedKg', label: 'CO₂ evitado', cor: corSerie.principal }]}
            formatoY={(n) => formatarKg(n)} formatoMarcaY={(n) => formatarCompacto(n)} ariaLabel="Gráfico de CO₂ evitado por mês" />
        </MolduraGrafico>

        <section aria-labelledby="goals-h">
          <TituloSecao id="goals-h" title="Metas da cidade" description="Compromissos públicos de reciclagem e o quanto já foi alcançado." />
          {s.goals.length === 0 ? <p className="text-sm text-muted">Nenhuma meta cadastrada.</p> : (
            <ul className="divide-y divide-line border-y border-line">
              {s.goals.map((g) => (
                <li key={g.id} className="py-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-sm font-medium text-fg">{g.title}</p>
                    <span className="font-mono text-xs text-subtle tabular">{g.year}</span>
                  </div>
                  <BarraProgresso className="mt-3" value={g.progress} size="xs" rotuloValor={null} />
                  <p className="mt-2 flex justify-between gap-3 font-mono text-[11px] text-subtle tabular">
                    <span>taxa {formatarPercentual(g.currentRate, 1)} de {formatarPercentual(g.targetRecyclingRate)}</span>
                    <span>{formatarCompacto(g.currentKg)} de {formatarCompacto(g.targetKg)} kg</span>
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
