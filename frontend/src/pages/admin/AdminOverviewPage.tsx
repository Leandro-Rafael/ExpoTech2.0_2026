import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { ArrowUpRight, BadgeCheck, Download, ShieldAlert, Trash2, Truck } from 'lucide-react';
import { useVisaoGeralAdmin } from '@/api/queries';
import type { AdminOverview } from '@/api/types';
import { Botao, EstadoErro, CabecalhoPagina, Esqueleto, CartaoIndicador } from '@/components/ui';
import { pontoTom } from '@/components/ui/Badge';
import { GraficoBarras, MolduraGrafico, corSerie } from '@/components/charts';
import { cn } from '@/lib/cn';
import { formatarData, formatarDataCurta, formatarKg, formatarNumero, formatarPercentual, formatarRelativo } from '@/lib/format';
import { Segmentado } from '@/features/admin/ui';
import { infoAuditoria } from '@/features/admin/auditLabels';
import { DialogoRelatorio } from '@/features/admin/overview/ReportDialog';
import { CartaoIntegridade } from '@/features/admin/overview/IntegrityCard';

type Metrica = 'count' | 'kg';

// Painel inicial do admin: pendências, números gerais, gráfico de 14 dias, integridade e relatório CSV.
export default function PaginaVisaoGeral() {
  const q = useVisaoGeralAdmin();
  const [relatorioAberto, setRelatorioAberto] = useState(false);
  const d = q.data;

  return (
    <>
      <CabecalhoPagina
        sobretitulo="Administração"
        title="Visão geral"
        description="O que precisa de atenção agora e como a plataforma está performando."
        acoes={<Botao variant="secondary" iconeEsquerda={Download} onClick={() => setRelatorioAberto(true)}>Relatório CSV</Botao>}
      />

      {q.error && !d ? <div className="surface rounded-2xl"><EstadoErro erro={q.error} aoTentarDeNovo={q.refetch} /></div> : (
        <div className="space-y-6">
          <Filas d={d} />
          <Indicadores d={d} />
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
            <GraficoDescartes d={d} />
            <AuditoriaRecente d={d} />
          </div>
          <CartaoIntegridade />
        </div>
      )}

      <DialogoRelatorio open={relatorioAberto} onClose={() => setRelatorioAberto(false)} />
    </>
  );
}

function Filas({ d }: { d: AdminOverview | undefined }) {
  const itens = [
    { to: '/app/admin/descartes', icon: BadgeCheck, label: 'Descartes pendentes', value: d?.pendingDisposals, context: 'aguardando moderação', urgent: (d?.pendingDisposals ?? 0) > 0 },
    { to: '/app/admin/descartes', icon: ShieldAlert, label: 'Suspeitas de fraude', value: d?.flaggedDisposals, context: 'risco ≥ 40 na fila', urgent: (d?.flaggedDisposals ?? 0) > 0, danger: true },
    { to: '/app/admin/coletas', icon: Truck, label: 'Coletas em aberto', value: d?.openCollectionRequests, context: 'solicitadas, agendadas ou em rota' },
    { to: '/app/admin/coletas?aba=lixeiras', icon: Trash2, label: 'Lixeiras para coletar', value: d?.binsNeedingCollection, context: 'acima do limite automático', urgent: (d?.binsNeedingCollection ?? 0) > 0 },
  ];
  return (
    <section aria-labelledby="q-title">
      <h2 id="q-title" className="label-mono mb-3 font-mono">Fila de trabalho</h2>
      <div className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line shadow-card grid-cols-2 xl:grid-cols-4">
        {itens.map((it) => (
          <Link key={it.label} to={it.to}
            className="group relative flex flex-col gap-3 bg-surface p-4 sm:p-5 transition-colors hover:bg-surface-2 focus-visible:outline-offset-[-2px]">
            <span className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-[13px] text-fg-soft">
                <it.icon className={cn('size-4', it.danger && it.urgent ? 'text-danger' : 'text-subtle')} aria-hidden /> {it.label}
              </span>
              <ArrowUpRight className="size-4 text-subtle transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-fg" aria-hidden />
            </span>
            {it.value == null ? <Esqueleto className="h-9 w-16" /> : (
              <span className="flex items-baseline gap-2.5">
                <span className={cn('font-mono text-[34px] leading-none font-medium tracking-[-0.03em] tabular',
                  !it.urgent ? 'text-fg' : it.danger ? 'text-danger' : 'text-fg')}>{formatarNumero(it.value)}</span>
                {it.urgent && !it.danger && <span aria-hidden className="size-1.5 rounded-full bg-warning" />}
              </span>
            )}
            <span className="text-xs text-muted">{it.context}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function Indicadores({ d }: { d: AdminOverview | undefined }) {
  const carregando = !d;
  const taxa = d && d.totalKg > 0 ? d.recycledKg / d.totalKg : null;
  const fracaoAtivos = d && d.users > 0 ? d.activeUsers30d / d.users : null;
  const cartoes = [
    { label: 'Usuários', value: d?.users, hint: 'cadastrados' },
    { label: 'Ativos 30 dias', value: d?.activeUsers30d, hint: fracaoAtivos != null ? `${formatarPercentual(fracaoAtivos)} da base` : undefined },
    { label: 'Resíduos', value: d?.totalKg, format: (v: number) => formatarKg(v), hint: 'aprovados no total' },
    { label: 'Reciclados', value: d?.recycledKg, format: (v: number) => formatarKg(v), hint: taxa != null ? `taxa de ${formatarPercentual(taxa, 1)}` : undefined },
    { label: 'Pontos emitidos', value: d?.pointsIssued, hint: 'ganhos + bônus' },
    { label: 'Resgates', value: d?.redemptions, hint: 'recompensas trocadas' },
  ];
  return (
    <section aria-labelledby="k-title">
      <h2 id="k-title" className="label-mono mb-3 font-mono">Plataforma</h2>
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line shadow-card md:grid-cols-3 xl:grid-cols-6">
        {cartoes.map((t) => (
          <CartaoIndicador key={t.label} variant="plain" label={t.label} value={t.value} formato={t.format} dica={t.hint} carregando={carregando} className="bg-surface p-5" />
        ))}
      </div>
    </section>
  );
}

function GraficoDescartes({ d }: { d: AdminOverview | undefined }) {
  const [metrica, setMetrica] = useState<Metrica>('count');
  const dados = useMemo(() => d?.disposalsLast14Days ?? [], [d]);
  const totalDescartes = dados.reduce((s, x) => s + x.count, 0);
  const totalQuilos = dados.reduce((s, x) => s + x.kg, 0);
  const pico = dados.reduce<(typeof dados)[number] | null>((m, x) => (!m || x[metrica] > m[metrica] ? x : m), null);
  const formatar = metrica === 'count' ? (v: number) => formatarNumero(v) : (v: number) => formatarKg(v);

  return (
    <section className="surface min-w-0 rounded-2xl p-5 sm:p-6">
      <MolduraGrafico
        title="Descartes nos últimos 14 dias"
        description={d ? `${formatarNumero(totalDescartes)} descartes · ${formatarKg(totalQuilos)}${pico ? ` · pico em ${formatarDataCurta(pico.date)}` : ''}` : 'Carregando…'}
        resumo={pico ? `Pico de ${formatar(pico[metrica])} em ${formatarData(pico.date)}.` : undefined}
        acao={<Segmentado<Metrica> label="Métrica" value={metrica} onChange={setMetrica} opcoes={[{ value: 'count', label: 'Quantidade' }, { value: 'kg', label: 'Kg' }]} />}
        tabela={{ colunas: ['Dia', 'Descartes', 'Kg'], linhas: dados.map((x) => [formatarData(x.date), x.count, formatarKg(x.kg)]) }}
      >
        {d ? (
          <GraficoBarras dados={dados} chaveX="date" height={340}
            series={[{ chave: metrica, label: metrica === 'count' ? 'Descartes' : 'Kg', cor: corSerie.principal }]}
            formatoX={(v) => formatarDataCurta(String(v))} rotuloDica={(v) => formatarData(String(v))}
            formatoY={formatar} formatoMarcaY={metrica === 'kg' ? (v) => formatarNumero(v) : undefined}
            ariaLabel={`Gráfico de ${metrica === 'count' ? 'descartes' : 'quilos'} por dia nos últimos 14 dias`} />
        ) : <Esqueleto className="h-[340px]" />}
      </MolduraGrafico>
    </section>
  );
}

function AuditoriaRecente({ d }: { d: AdminOverview | undefined }) {
  const itens = d?.recentAudit.slice(0, 8);
  return (
    <section aria-labelledby="ra-title" className="surface flex min-w-0 flex-col rounded-2xl">
      <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-3 sm:px-6">
        <h3 id="ra-title" className="text-[15px] font-semibold text-fg">Atividade recente</h3>
        <Link to="/app/admin?aba=auditoria" className="inline-flex items-center gap-1 text-[13px] text-muted transition-colors hover:text-fg">
          Auditoria <ArrowUpRight className="size-3.5" aria-hidden />
        </Link>
      </div>
      {!itens ? (
        <div className="space-y-3 px-5 pb-5 sm:px-6">{Array.from({ length: 6 }, (_, i) => <Esqueleto key={i} className="h-9" />)}</div>
      ) : !itens.length ? (
        <p className="px-6 pb-6 text-sm text-muted">Sem eventos ainda.</p>
      ) : (
        <ol className="flex-1 divide-y divide-line/70 border-t border-line">
          {itens.map((e) => {
            const m = infoAuditoria(e.action);
            return (
              <li key={e.id} className="flex items-start gap-3 px-5 py-3 sm:px-6">
                <span aria-hidden className={cn('mt-[7px] size-1.5 shrink-0 rounded-full', pontoTom[m.tone])} />
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] text-fg">{m.label}</p>
                  <p className="truncate text-xs text-muted">{e.actor?.replace(/\s*<[^>]*>$/, '') ?? 'sistema'}{e.details ? ` · ${e.details}` : ''}</p>
                </div>
                <time dateTime={e.createdAt} className="shrink-0 text-[11.5px] text-subtle">{formatarRelativo(e.createdAt)}</time>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
