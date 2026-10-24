import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { ArrowUpRight, BadgeCheck, Download, ShieldAlert, Trash2, Truck } from 'lucide-react';
import { useAdminOverview } from '@/api/queries';
import type { AdminOverview } from '@/api/types';
import { Button, ErrorState, PageHeader, Skeleton, StatTile } from '@/components/ui';
import { toneDot } from '@/components/ui/Badge';
import { BarChart, ChartFrame, seriesColor } from '@/components/charts';
import { cn } from '@/lib/cn';
import { formatDate, formatDateShort, formatKg, formatNumber, formatPercent, formatRelative } from '@/lib/format';
import { Segmented } from '@/features/admin/ui';
import { auditMeta } from '@/features/admin/auditLabels';
import { ReportDialog } from '@/features/admin/overview/ReportDialog';
import { IntegrityCard } from '@/features/admin/overview/IntegrityCard';

type Metric = 'count' | 'kg';

export default function AdminOverviewPage() {
  const q = useAdminOverview();
  const [report, setReport] = useState(false);
  const d = q.data;

  return (
    <>
      <PageHeader
        eyebrow="Administração"
        title="Visão geral"
        description="O que precisa de atenção agora e como a plataforma está performando."
        actions={<Button variant="secondary" leftIcon={Download} onClick={() => setReport(true)}>Relatório CSV</Button>}
      />

      {q.error && !d ? <div className="surface rounded-2xl"><ErrorState error={q.error} onRetry={q.refetch} /></div> : (
        <div className="space-y-6">
          <Queues d={d} />
          <Kpis d={d} />
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
            <DisposalsChart d={d} />
            <RecentAudit d={d} />
          </div>
          <IntegrityCard />
        </div>
      )}

      <ReportDialog open={report} onClose={() => setReport(false)} />
    </>
  );
}

function Queues({ d }: { d: AdminOverview | undefined }) {
  const items = [
    { to: '/app/admin/descartes', icon: BadgeCheck, label: 'Descartes pendentes', value: d?.pendingDisposals, context: 'aguardando moderação', urgent: (d?.pendingDisposals ?? 0) > 0 },
    { to: '/app/admin/descartes', icon: ShieldAlert, label: 'Suspeitas de fraude', value: d?.flaggedDisposals, context: 'risco ≥ 40 na fila', urgent: (d?.flaggedDisposals ?? 0) > 0, danger: true },
    { to: '/app/admin/coletas', icon: Truck, label: 'Coletas em aberto', value: d?.openCollectionRequests, context: 'solicitadas, agendadas ou em rota' },
    { to: '/app/admin/lixeiras', icon: Trash2, label: 'Lixeiras para coletar', value: d?.binsNeedingCollection, context: 'acima do limite automático', urgent: (d?.binsNeedingCollection ?? 0) > 0 },
  ];
  return (
    <section aria-labelledby="q-title">
      <h2 id="q-title" className="label-mono mb-3 font-mono">Fila de trabalho</h2>
      <div className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line shadow-card grid-cols-2 xl:grid-cols-4">
        {items.map((it) => (
          <Link key={it.label} to={it.to}
            className="group relative flex flex-col gap-3 bg-surface p-4 sm:p-5 transition-colors hover:bg-surface-2 focus-visible:outline-offset-[-2px]">
            <span className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-[13px] text-fg-soft">
                <it.icon className={cn('size-4', it.danger && it.urgent ? 'text-danger' : 'text-subtle')} aria-hidden /> {it.label}
              </span>
              <ArrowUpRight className="size-4 text-subtle transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-fg" aria-hidden />
            </span>
            {it.value == null ? <Skeleton className="h-9 w-16" /> : (
              <span className="flex items-baseline gap-2.5">
                <span className={cn('font-mono text-[34px] leading-none font-medium tracking-[-0.03em] tabular',
                  !it.urgent ? 'text-fg' : it.danger ? 'text-danger' : 'text-fg')}>{formatNumber(it.value)}</span>
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

function Kpis({ d }: { d: AdminOverview | undefined }) {
  const loading = !d;
  const rate = d && d.totalKg > 0 ? d.recycledKg / d.totalKg : null;
  const activeShare = d && d.users > 0 ? d.activeUsers30d / d.users : null;
  const tiles = [
    { label: 'Usuários', value: d?.users, hint: 'cadastrados' },
    { label: 'Ativos 30 dias', value: d?.activeUsers30d, hint: activeShare != null ? `${formatPercent(activeShare)} da base` : undefined },
    { label: 'Resíduos', value: d?.totalKg, format: (v: number) => formatKg(v), hint: 'aprovados no total' },
    { label: 'Reciclados', value: d?.recycledKg, format: (v: number) => formatKg(v), hint: rate != null ? `taxa de ${formatPercent(rate, 1)}` : undefined },
    { label: 'Pontos emitidos', value: d?.pointsIssued, hint: 'ganhos + bônus' },
    { label: 'Resgates', value: d?.redemptions, hint: 'recompensas trocadas' },
  ];
  return (
    <section aria-labelledby="k-title">
      <h2 id="k-title" className="label-mono mb-3 font-mono">Plataforma</h2>
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line shadow-card md:grid-cols-3 xl:grid-cols-6">
        {tiles.map((t) => (
          <StatTile key={t.label} variant="plain" label={t.label} value={t.value} format={t.format} hint={t.hint} loading={loading} className="bg-surface p-5" />
        ))}
      </div>
    </section>
  );
}

function DisposalsChart({ d }: { d: AdminOverview | undefined }) {
  const [metric, setMetric] = useState<Metric>('count');
  const data = useMemo(() => d?.disposalsLast14Days ?? [], [d]);
  const totalCount = data.reduce((s, x) => s + x.count, 0);
  const totalKg = data.reduce((s, x) => s + x.kg, 0);
  const peak = data.reduce<(typeof data)[number] | null>((m, x) => (!m || x[metric] > m[metric] ? x : m), null);
  const fmt = metric === 'count' ? (v: number) => formatNumber(v) : (v: number) => formatKg(v);

  return (
    <section className="surface min-w-0 rounded-2xl p-5 sm:p-6">
      <ChartFrame
        title="Descartes nos últimos 14 dias"
        description={d ? `${formatNumber(totalCount)} descartes · ${formatKg(totalKg)}${peak ? ` · pico em ${formatDateShort(peak.date)}` : ''}` : 'Carregando…'}
        summary={peak ? `Pico de ${fmt(peak[metric])} em ${formatDate(peak.date)}.` : undefined}
        action={<Segmented<Metric> label="Métrica" value={metric} onChange={setMetric} options={[{ value: 'count', label: 'Quantidade' }, { value: 'kg', label: 'Kg' }]} />}
        table={{ columns: ['Dia', 'Descartes', 'Kg'], rows: data.map((x) => [formatDate(x.date), x.count, formatKg(x.kg)]) }}
      >
        {d ? (
          <BarChart data={data} xKey="date" height={340}
            series={[{ key: metric, label: metric === 'count' ? 'Descartes' : 'Kg', color: seriesColor.primary }]}
            xFormat={(v) => formatDateShort(String(v))} tooltipLabel={(v) => formatDate(String(v))}
            yFormat={fmt} yTickFormat={metric === 'kg' ? (v) => formatNumber(v) : undefined}
            ariaLabel={`Gráfico de ${metric === 'count' ? 'descartes' : 'quilos'} por dia nos últimos 14 dias`} />
        ) : <Skeleton className="h-[340px]" />}
      </ChartFrame>
    </section>
  );
}

function RecentAudit({ d }: { d: AdminOverview | undefined }) {
  const items = d?.recentAudit.slice(0, 8);
  return (
    <section aria-labelledby="ra-title" className="surface flex min-w-0 flex-col rounded-2xl">
      <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-3 sm:px-6">
        <h3 id="ra-title" className="text-[15px] font-semibold text-fg">Atividade recente</h3>
        <Link to="/app/admin/auditoria" className="inline-flex items-center gap-1 text-[13px] text-muted transition-colors hover:text-fg">
          Auditoria <ArrowUpRight className="size-3.5" aria-hidden />
        </Link>
      </div>
      {!items ? (
        <div className="space-y-3 px-5 pb-5 sm:px-6">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-9" />)}</div>
      ) : !items.length ? (
        <p className="px-6 pb-6 text-sm text-muted">Sem eventos ainda.</p>
      ) : (
        <ol className="flex-1 divide-y divide-line/70 border-t border-line">
          {items.map((e) => {
            const m = auditMeta(e.action);
            return (
              <li key={e.id} className="flex items-start gap-3 px-5 py-3 sm:px-6">
                <span aria-hidden className={cn('mt-[7px] size-1.5 shrink-0 rounded-full', toneDot[m.tone])} />
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] text-fg">{m.label}</p>
                  <p className="truncate text-xs text-muted">{e.actor?.replace(/\s*<[^>]*>$/, '') ?? 'sistema'}{e.details ? ` · ${e.details}` : ''}</p>
                </div>
                <time dateTime={e.createdAt} className="shrink-0 text-[11.5px] text-subtle">{formatRelative(e.createdAt)}</time>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
