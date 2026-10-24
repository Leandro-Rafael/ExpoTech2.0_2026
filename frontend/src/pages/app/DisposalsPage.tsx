import { useState } from 'react';
import { BrainCircuit, CircleDashed, MapPin, Recycle, ScanLine, XCircle } from 'lucide-react';
import { useDisposal, useDisposals } from '@/api/queries';
import type { Disposal, DisposalStatus } from '@/api/types';
import { CategoryIcon } from '@/components/CategoryIcon';
import {
  ButtonLink, Drawer, EmptyState, ErrorState, PageHeader, Pagination, SkeletonText, StatusPill, Tabs,
} from '@/components/ui';
import { DisposalRow } from '@/features/resident/shared';
import { useIsDesktop } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/cn';
import { categoryName } from '@/lib/category';
import { formatDateTime, formatKg, formatNumber, formatPercent, formatPoints } from '@/lib/format';
import { aiSource, disposalStatus } from '@/lib/labels';

type Filter = 'ALL' | DisposalStatus;
const FILTERS: { value: Filter; label: string }[] = [
  { value: 'ALL', label: 'Todos' },
  { value: 'PENDING', label: 'Pendentes' },
  { value: 'APPROVED', label: 'Aprovados' },
  { value: 'REJECTED', label: 'Recusados' },
];
const EMPTY: Record<Filter, { title: string; description: string }> = {
  ALL: { title: 'Nenhum descarte registrado', description: 'Registre seu primeiro resíduo com uma foto. Ele aparece aqui com o status da análise.' },
  PENDING: { title: 'Nada aguardando análise', description: 'Todos os seus descartes já foram analisados.' },
  APPROVED: { title: 'Nenhum descarte aprovado ainda', description: 'Quando um registro for aprovado, os pontos aparecem aqui e no seu saldo.' },
  REJECTED: { title: 'Nenhum descarte recusado', description: 'Ótimo sinal: seus registros estão dentro das regras.' },
};
const PAGE_SIZE = 12;

export default function DisposalsPage() {
  const [filter, setFilter] = useState<Filter>('ALL');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Disposal | null>(null);
  const q = useDisposals({ status: filter === 'ALL' ? undefined : filter, page, size: PAGE_SIZE });
  const desktop = useIsDesktop();

  return (
    <>
      <PageHeader
        eyebrow="Histórico"
        title="Meus descartes"
        description="Cada registro passa por análise. Só descartes aprovados geram pontos — e uma única vez."
      />

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs idBase="dsp" aria-label="Filtrar por status" items={FILTERS}
          value={filter} onChange={(v) => { setFilter(v); setPage(0); }} />
        {q.data && <p className="font-mono text-xs text-subtle tabular">{formatNumber(q.data.totalElements)} {q.data.totalElements === 1 ? 'registro' : 'registros'}</p>}
      </div>

      <div id={`dsp-panel-${filter}`} role="tabpanel" aria-labelledby={`dsp-tab-${filter}`}>
        {q.isPending ? <SkeletonText lines={8} /> : q.error ? (
          <ErrorState error={q.error} onRetry={q.refetch} />
        ) : q.data.content.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line-strong">
            <EmptyState icon={Recycle} title={EMPTY[filter].title} description={EMPTY[filter].description}
              action={filter === 'ALL' || filter === 'APPROVED' ? <ButtonLink to="/app/descartar" leftIcon={ScanLine}>Registrar descarte</ButtonLink> : undefined} />
          </div>
        ) : (
          <>
            <div className={cn('divide-y divide-line border-y border-line transition-opacity', q.isPlaceholderData && 'opacity-60')}>
              {q.data.content.map((d) => <DisposalRow key={d.id} d={d} onClick={() => setSelected(d)} />)}
            </div>
            <Pagination className="mt-6" page={q.data.page} totalPages={q.data.totalPages} totalElements={q.data.totalElements} size={q.data.size}
              onChange={(p) => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />
          </>
        )}
      </div>

      <Drawer open={!!selected} onClose={() => setSelected(null)} side={desktop ? 'right' : 'bottom'}
        title={selected ? `${selected.category.name} · ${formatKg(selected.quantityKg)}` : ''}
        description={selected ? `Registrado em ${formatDateTime(selected.createdAt)}` : undefined}>
        {selected && <DisposalDetail initial={selected} />}
      </Drawer>
    </>
  );
}

function DisposalDetail({ initial }: { initial: Disposal }) {
  const q = useDisposal(initial.id);
  const d = q.data ?? initial;
  const approved = d.status === 'APPROVED';
  const corrected = d.ai?.suggestedCode && d.ai.suggestedCode !== d.category.code;

  const steps = [
    { label: 'Descartado', at: d.disposedAt, state: 'done' as const },
    { label: 'Registrado no app', at: d.createdAt, state: 'done' as const },
    d.status === 'PENDING'
      ? { label: 'Aguardando análise', at: null, state: 'current' as const }
      : { label: approved ? 'Aprovado' : 'Recusado', at: d.reviewedAt, state: approved ? 'done' as const : 'rejected' as const },
  ];

  return (
    <div className="space-y-6 pt-2">
      {d.photoUrl ? (
        <img src={d.photoUrl} alt={`Foto do descarte de ${d.category.name}`} className="aspect-[4/3] w-full rounded-xl border border-line bg-bg-deep object-cover" />
      ) : (
        <div className="flex aspect-[4/3] items-center justify-center rounded-xl border border-dashed border-line-strong text-sm text-subtle">Registrado sem foto</div>
      )}

      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-3">
          <CategoryIcon icon={d.category.icon} code={d.category.code} color={d.category.color} />
          <span>
            <span className="block text-sm font-semibold text-fg">{d.category.name}</span>
            <span className="block font-mono text-xs text-muted tabular">{formatKg(d.quantityKg)}</span>
          </span>
        </span>
        <StatusPill map={disposalStatus} value={d.status} size="md" />
      </div>

      {d.status === 'REJECTED' && (
        <div role="note" className="rounded-xl border border-danger/30 bg-danger/[0.06] p-4">
          <p className="flex items-center gap-2 text-sm font-medium text-danger"><XCircle className="size-4" aria-hidden /> Motivo da recusa</p>
          <p className="mt-1.5 text-sm text-fg-soft">{d.rejectionReason ?? 'Não informado.'}</p>
        </div>
      )}

      <dl className="divide-y divide-line border-y border-line text-sm">
        <Row label={approved ? 'Pontos creditados' : d.status === 'PENDING' ? 'Pontos estimados' : 'Pontos'}>
          <span className={cn('font-mono tabular', approved ? 'text-success' : d.status === 'REJECTED' ? 'text-subtle line-through' : 'text-fg')}>
            {approved ? `+${formatPoints(d.pointsAwarded)}` : `≈ ${formatPoints(d.estimatedPoints)}`}
          </span>
        </Row>
        <Row label="Identificação">
          {d.ai?.verified ? (
            <span className="inline-flex items-center gap-1.5 text-success"><BrainCircuit className="size-3.5" aria-hidden />Confirmado pela IA (+10%)</span>
          ) : d.ai?.source === 'LOCAL' ? (
            <span className="inline-flex items-center gap-1.5 text-fg-soft"><BrainCircuit className="size-3.5" aria-hidden />Sugestão do navegador</span>
          ) : d.ai?.source ? (
            <span className="inline-flex items-center gap-1.5 text-fg-soft"><BrainCircuit className="size-3.5" aria-hidden />{aiSource[d.ai.source].label}</span>
          ) : <span className="text-fg-soft">Manual</span>}
        </Row>
        {d.ai?.suggestedCode && (
          <Row label="Sugestão da IA">
            <span className="text-fg-soft">
              {categoryName(d.ai.suggestedCode)}
              {d.ai.confidence != null && <span className="ml-1.5 font-mono text-xs text-subtle tabular">{formatPercent(d.ai.confidence)}</span>}
              {corrected && <span className="ml-1.5 text-xs text-warning">· corrigida por você</span>}
            </span>
          </Row>
        )}
        <Row label="Local">
          {d.collectionPoint ? (
            <span className="inline-flex items-center gap-1.5 text-right text-fg-soft"><MapPin className="size-3.5 shrink-0" aria-hidden />{d.collectionPoint.name}</span>
          ) : d.latitude != null ? (
            <span className="font-mono text-xs text-fg-soft tabular">{d.latitude.toFixed(4)}, {d.longitude?.toFixed(4)}</span>
          ) : <span className="text-subtle">Não informado</span>}
        </Row>
        {d.notes && <Row label="Observações"><span className="text-right text-fg-soft">{d.notes}</span></Row>}
      </dl>

      <section aria-label="Linha do tempo">
        <p className="label-mono mb-3">Linha do tempo</p>
        <ol className="relative space-y-4 border-l border-line pl-5">
          {steps.map((s) => (
            <li key={s.label} className="relative">
              <span aria-hidden className={cn('absolute top-1 -left-[25px] flex size-[9px] rounded-full ring-4 ring-surface-2',
                s.state === 'done' ? 'bg-success' : s.state === 'rejected' ? 'bg-danger' : 'bg-warning')} />
              <p className="flex items-center gap-1.5 text-sm text-fg">{s.state === 'current' && <CircleDashed className="size-3.5 text-warning" aria-hidden />}{s.label}</p>
              <p className="font-mono text-xs text-subtle tabular">{s.at ? formatDateTime(s.at) : 'normalmente em até 24 h'}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <dt className="shrink-0 text-muted">{label}</dt>
      <dd className="min-w-0 text-right">{children}</dd>
    </div>
  );
}
