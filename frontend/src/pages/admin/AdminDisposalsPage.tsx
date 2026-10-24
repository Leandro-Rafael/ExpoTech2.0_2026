import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, BadgeCheck, ImageOff, Inbox, Sparkles } from 'lucide-react';
import { errorMessage } from '@/api/client';
import { qk, useAdminDisposals, useAdminOverview, useApproveDisposal, useCategories, useRejectDisposal } from '@/api/queries';
import type { AdminDisposalsParams } from '@/api/admin';
import type { Disposal, DisposalStatus, Page } from '@/api/types';
import { Drawer, EmptyState, ErrorState, PageHeader, Pagination, Skeleton, StatusPill, Switch, toast } from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatKg, formatNumber, formatRelative } from '@/lib/format';
import { disposalStatus } from '@/lib/labels';
import { useIsDesktop } from '@/hooks/useMediaQuery';
import { Kbd, SearchField, Segmented } from '@/features/admin/ui';
import { DisposalReview, FraudScore, aiMismatch, type ApproveCorrection } from '@/features/admin/moderation/DisposalReview';
import { RejectDialog } from '@/features/admin/moderation/RejectDialog';

type StatusFilter = DisposalStatus | 'ALL';
const SIZE = 20;

function isTyping(el: EventTarget | null) {
  const t = el as HTMLElement | null;
  if (!t) return false;
  return t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName);
}

export default function AdminDisposalsPage() {
  const qc = useQueryClient();
  const desktop = useIsDesktop();
  const [status, setStatus] = useState<StatusFilter>('PENDING');
  const [flagged, setFlagged] = useState(false);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [rejecting, setRejecting] = useState<Disposal | null>(null);
  const approveFn = useRef<(() => void) | null>(null);

  const params: AdminDisposalsParams = useMemo(
    () => ({ status: status === 'ALL' ? undefined : status, flagged: flagged || undefined, page, size: SIZE }),
    [status, flagged, page],
  );
  const q = useAdminDisposals(params);
  const overview = useAdminOverview();
  const categories = useCategories({ all: true });
  const approve = useApproveDisposal();
  const reject = useRejectDisposal();

  const rows = useMemo(() => {
    const list = q.data?.content ?? [];
    const s = search.trim().toLocaleLowerCase('pt-BR');
    if (!s) return list;
    return list.filter((d) => [d.user?.name, d.user?.email, d.category.name].some((x) => x?.toLocaleLowerCase('pt-BR').includes(s)));
  }, [q.data, search]);

  // Seleção: no desktop sempre há um item selecionado (o primeiro da fila).
  const selected = rows.find((d) => d.id === selectedId) ?? (desktop ? rows[0] : undefined) ?? null;
  const selectedIndex = selected ? rows.findIndex((d) => d.id === selected.id) : -1;

  useEffect(() => { setPage(0); }, [status, flagged]);

  const select = useCallback((d: Disposal) => {
    setSelectedId(d.id);
    if (!desktop) setDrawerOpen(true);
    requestAnimationFrame(() => document.getElementById(`q-${d.id}`)?.scrollIntoView({ block: 'nearest' }));
  }, [desktop]);

  const move = useCallback((dir: 1 | -1) => {
    if (!rows.length) return;
    const i = selectedIndex < 0 ? 0 : Math.min(rows.length - 1, Math.max(0, selectedIndex + dir));
    select(rows[i]);
  }, [rows, selectedIndex, select]);

  /** Atualização otimista: tira o item da fila (ou muda o status) e devolve se a API falhar. */
  const optimistic = useCallback(async (d: Disposal, next: Disposal['status'], patch: Partial<Disposal> = {}) => {
    const key = qk.admin.disposals(params);
    await qc.cancelQueries({ queryKey: key });
    const prev = qc.getQueryData<Page<Disposal>>(key);
    const neighbor = rows[selectedIndex + 1] ?? rows[selectedIndex - 1] ?? null;
    if (prev) {
      const removes = params.status === 'PENDING';
      qc.setQueryData<Page<Disposal>>(key, {
        ...prev,
        totalElements: removes ? Math.max(0, prev.totalElements - 1) : prev.totalElements,
        content: removes ? prev.content.filter((x) => x.id !== d.id) : prev.content.map((x) => (x.id === d.id ? { ...x, status: next, ...patch } : x)),
      });
    }
    if (params.status === 'PENDING') setSelectedId(neighbor?.id ?? null);
    if (!desktop && params.status === 'PENDING') setDrawerOpen(false);
    return () => { if (prev) qc.setQueryData(key, prev); setSelectedId(d.id); };
  }, [qc, params, rows, selectedIndex, desktop]);

  const doApprove = useCallback(async (d: Disposal, c: ApproveCorrection) => {
    const rollback = await optimistic(d, 'APPROVED');
    approve.mutate({ id: d.id, ...c }, {
      onSuccess: (res) => toast.success(`Aprovado · +${formatNumber(res.pointsAwarded)} pts para ${res.user?.name ?? 'o morador'}`),
      onError: (e) => { rollback(); toast.error(errorMessage(e)); },
    });
  }, [approve, optimistic]);

  const doReject = useCallback(async (d: Disposal, reason: string) => {
    setRejecting(null);
    const rollback = await optimistic(d, 'REJECTED', { rejectionReason: reason });
    reject.mutate({ id: d.id, reason }, {
      onSuccess: () => toast.success('Descarte recusado. O morador será avisado.'),
      onError: (e) => { rollback(); toast.error(errorMessage(e)); },
    });
  }, [reject, optimistic]);

  // Atalhos: J/K navegam, A aprova, R recusa.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return;
      if (document.querySelector('[aria-modal="true"]') && !(drawerOpen && !rejecting)) return;
      const k = e.key.toLowerCase();
      if (k === 'j' || (k === 'arrowdown' && desktop)) { e.preventDefault(); move(1); }
      else if (k === 'k' || (k === 'arrowup' && desktop)) { e.preventDefault(); move(-1); }
      else if (k === 'a' && selected?.status === 'PENDING') { e.preventDefault(); approveFn.current?.(); }
      else if (k === 'r' && selected?.status === 'PENDING') { e.preventDefault(); setRejecting(selected); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [move, selected, desktop, drawerOpen, rejecting]);

  const ov = overview.data;
  const total = q.data?.totalElements;

  const review = selected && (
    <DisposalReview
      key={selected.id}
      disposal={selected}
      categories={categories.data}
      showShortcuts={desktop}
      busy={false}
      approveRef={(fn) => { approveFn.current = fn; }}
      onApprove={(c) => void doApprove(selected, c)}
      onReject={() => setRejecting(selected)}
    />
  );

  return (
    <>
      <PageHeader
        eyebrow="Administração"
        title="Moderação de descartes"
        description="Revise as fotos, compare a categoria declarada com a sugestão da IA e confira os sinais antifraude antes de liberar os pontos."
      />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <Segmented<StatusFilter>
            label="Status"
            value={status}
            onChange={setStatus}
            options={[
              { value: 'PENDING', label: 'Pendentes', count: ov?.pendingDisposals ?? null, tone: 'warning' },
              { value: 'APPROVED', label: 'Aprovados' },
              { value: 'REJECTED', label: 'Recusados' },
              { value: 'ALL', label: 'Todos' },
            ]}
          />
          <Switch size="sm" checked={flagged} onChange={setFlagged}
            label={<span className="inline-flex items-center gap-2 text-[13px]">Só suspeitos {ov && <span className="font-mono text-[11px] text-danger tabular">{ov.flaggedDisposals}</span>}</span>} />
        </div>
        <div className="flex items-center gap-4">
          <SearchField value={search} onChange={setSearch} placeholder="Filtrar por morador ou categoria" className="w-full lg:w-72" />
          {desktop && (
            <p className="hidden shrink-0 items-center gap-1.5 text-xs text-subtle xl:flex" aria-label="Atalhos: J e K navegam, A aprova, R recusa">
              <Kbd>J</Kbd><Kbd>K</Kbd> navegar <span className="mx-1 text-line-strong">·</span> <Kbd>A</Kbd> aprovar <span className="mx-1 text-line-strong">·</span> <Kbd>R</Kbd> recusar
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(380px,440px)]">
        {/* Fila */}
        <section aria-label="Fila de descartes" className="surface min-w-0 overflow-hidden rounded-2xl">
          <div className="flex h-11 items-center justify-between border-b border-line px-4 text-xs text-subtle">
            <span className="label-mono">Fila</span>
            {total != null && <span className="font-mono tabular">{formatNumber(total)} {total === 1 ? 'item' : 'itens'}</span>}
          </div>
          {q.error && !q.data ? (
            <ErrorState error={q.error} onRetry={q.refetch} compact />
          ) : q.isPending ? (
            <div role="status" aria-label="Carregando fila" className="divide-y divide-line">
              {Array.from({ length: 7 }, (_, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3"><Skeleton className="size-12 rounded-lg" /><div className="flex-1 space-y-2"><Skeleton className="h-3.5 w-1/3" /><Skeleton className="h-3 w-1/4" /></div></div>
              ))}
            </div>
          ) : !rows.length ? (
            <EmptyState compact icon={status === 'PENDING' && !search ? BadgeCheck : Inbox}
              title={search ? 'Nada encontrado' : status === 'PENDING' ? 'Fila zerada' : 'Nenhum descarte'}
              description={search ? 'Nenhum item desta página corresponde à busca.' : status === 'PENDING' ? (flagged ? 'Nenhum descarte suspeito aguardando revisão.' : 'Todos os descartes foram revisados. Bom trabalho.') : 'Nenhum descarte com esses filtros.'} />
          ) : (
            <ul aria-label="Descartes"
              className={cn('divide-y divide-line/70', q.isPlaceholderData && 'opacity-60')}>
              {rows.map((d) => (
                <QueueRow key={d.id} d={d} active={selected?.id === d.id} onSelect={() => select(d)} />
              ))}
            </ul>
          )}
          {q.data && q.data.totalPages > 1 && (
            <div className="border-t border-line px-4 py-3">
              <Pagination page={q.data.page} totalPages={q.data.totalPages} totalElements={q.data.totalElements} size={q.data.size} onChange={setPage} />
            </div>
          )}
        </section>

        {/* Painel de revisão (desktop) */}
        {desktop && (
          <aside aria-label="Revisão" className="surface sticky top-[calc(var(--header-h)+16px)] flex h-[calc(100dvh-var(--header-h)-32px)] min-h-[560px] flex-col overflow-hidden rounded-2xl">
            {review ?? (
              <EmptyState compact icon={Inbox} title="Selecione um descarte" description="Escolha um item da fila para revisar." className="my-auto" />
            )}
          </aside>
        )}
      </div>

      {!desktop && (
        <Drawer open={drawerOpen && !!selected} onClose={() => setDrawerOpen(false)} side="bottom" title="Revisar descarte" className="h-[88dvh]">
          <div className="-mx-5 -mb-5 h-full">{review}</div>
        </Drawer>
      )}

      <RejectDialog disposal={rejecting} onClose={() => setRejecting(null)} onConfirm={(reason) => rejecting && void doReject(rejecting, reason)} />
    </>
  );
}

function QueueRow({ d, active, onSelect }: { d: Disposal; active: boolean; onSelect: () => void }) {
  const mismatch = aiMismatch(d);
  const score = d.fraud?.score ?? 0;
  return (
    <li id={`q-${d.id}`}>
      <button type="button" onClick={onSelect} aria-current={active || undefined}
        className={cn('relative flex w-full items-center gap-3.5 px-4 py-3 text-left transition-colors hover:bg-white/[0.025] focus-visible:outline-offset-[-2px]',
          active && 'bg-white/[0.05] hover:bg-white/[0.05]')}>
        {active && <span aria-hidden className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-fg" />}
        <span className="relative size-12 shrink-0 overflow-hidden rounded-lg border border-line bg-bg-deep">
          {d.photoUrl ? <img src={d.photoUrl} alt="" loading="lazy" className="size-full object-cover" />
            : <span className="flex size-full items-center justify-center text-subtle"><ImageOff className="size-4" aria-hidden /></span>}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: d.category.color }} aria-hidden />
            <span className="truncate text-[13.5px] font-medium text-fg">{d.category.name}</span>
            <span className="font-mono text-[12.5px] text-fg-soft tabular">{formatKg(d.quantityKg)}</span>
            {mismatch && (
              <span className="inline-flex items-center gap-1 rounded-md border border-warning/30 px-1.5 py-px text-[11px] text-warning" title="A sugestão da IA difere da categoria declarada">
                <Sparkles className="size-3" aria-hidden /> IA ≠
              </span>
            )}
          </span>
          <span className="mt-0.5 block truncate text-xs text-muted">{d.user?.name ?? 'Usuário'} · {formatRelative(d.createdAt)}</span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1">
          {d.status !== 'PENDING' ? <StatusPill map={disposalStatus} value={d.status} /> : (
            <span className="inline-flex items-center gap-1.5">
              {score >= 40 && <AlertTriangle className={cn('size-3.5', score >= 70 ? 'text-danger' : 'text-warning')} aria-label="Sinalizado" />}
              <FraudScore score={score} />
            </span>
          )}
          {(d.fraud?.flags.length ?? 0) > 0 && d.status === 'PENDING' && (
            <span className="text-[11px] text-subtle">{d.fraud!.flags.length} {d.fraud!.flags.length === 1 ? 'sinal' : 'sinais'}</span>
          )}
        </span>
      </button>
    </li>
  );
}
