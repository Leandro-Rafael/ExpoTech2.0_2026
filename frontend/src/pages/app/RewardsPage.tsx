import { useMemo, useState } from 'react';
import { Gift, PackageX, ReceiptText, ScanLine, Ticket } from 'lucide-react';
import { errorMessage } from '@/api';
import { usePointTransactions, useRedeemReward, useRedemptions, useRewards } from '@/api/queries';
import type { Redemption, Reward } from '@/api/types';
import { useUser } from '@/auth/AuthProvider';
import { iconByName } from '@/components/icons';
import {
  Button, ButtonLink, ConfirmDialog, EmptyState, ErrorState, Modal, PageHeader, Pagination, ProgressBar, SkeletonText,
  StatusPill, toast,
} from '@/components/ui';
import { useSetTab } from '@/components/layout/TabbedPage';
import { CopyButton } from '@/features/resident/shared';
import { useCountUpText } from '@/hooks/useCountUp';
import { cn } from '@/lib/cn';
import { formatDate, formatDateTime, formatNumber, formatRelative } from '@/lib/format';
import { pointTransactionType, redemptionStatus } from '@/lib/labels';

export default function RewardsPage({ view }: { view: 'catalog' | 'mine' | 'ledger' }) {
  const user = useUser();
  const setTab = useSetTab();
  const rewards = useRewards();
  const redemptions = useRedemptions();
  const redeem = useRedeemReward();
  const [confirm, setConfirm] = useState<Reward | null>(null);
  const [voucher, setVoucher] = useState<Redemption | null>(null);
  const balanceRef = useCountUpText<HTMLSpanElement>(user.points, (v) => formatNumber(v), { duration: 900 });

  const catalog = useMemo(() => [...(rewards.data ?? [])].filter((r) => r.active).sort((a, b) => a.costPoints - b.costPoints), [rewards.data]);
  const nextGoal = catalog.find((r) => r.costPoints > user.points && r.stock > 0);
  const available = catalog.filter((r) => r.costPoints <= user.points && r.stock > 0).length;

  const doRedeem = () => {
    if (!confirm) return;
    redeem.mutate(confirm.id, {
      onSuccess: (r) => { setConfirm(null); setVoucher(r); toast.success('Resgate concluído!'); },
      onError: (e) => { setConfirm(null); toast.error(errorMessage(e)); },
    });
  };

  return (
    <>
      <PageHeader eyebrow="Recompensas" title="Troque pontos por benefícios reais"
        description="Parceiros locais oferecem descontos, ingressos e produtos sustentáveis. O voucher sai na hora e fica salvo em “Meus resgates”." />

      <section aria-label="Saldo" className="mb-10 grid grid-cols-1 gap-6 border-y border-line py-6 sm:grid-cols-[auto_1fr] sm:items-center sm:gap-12">
        <div>
          <p className="label-mono">Seu saldo</p>
          <p className="mt-2 flex items-baseline gap-2">
            <span ref={balanceRef} className="font-mono text-[44px] leading-none font-medium tracking-[-0.04em] text-fg" />
            <span className="text-sm text-muted">pts</span>
          </p>
        </div>
        <div className="max-w-lg">
          {nextGoal ? (
            <>
              <p className="text-sm text-fg-soft">
                Faltam <span className="font-mono text-fg tabular">{formatNumber(nextGoal.costPoints - user.points)} pts</span> para <span className="text-fg">{nextGoal.name}</span>.
              </p>
              <ProgressBar className="mt-2.5" value={user.points / nextGoal.costPoints} valueLabel={null} size="xs" />
              <p className="mt-2 text-xs text-subtle">{available > 0 ? `${available} ${available === 1 ? 'recompensa já está' : 'recompensas já estão'} ao seu alcance.` : 'Cada kg aprovado soma pontos ao seu saldo.'}</p>
            </>
          ) : (
            <p className="text-sm text-fg-soft">{catalog.length ? 'Você já pode resgatar qualquer recompensa do catálogo.' : ' '}</p>
          )}
        </div>
      </section>

      {view === 'catalog' && (rewards.isPending ? <SkeletonText lines={8} /> : rewards.error ? <ErrorState error={rewards.error} onRetry={rewards.refetch} /> :
          catalog.length === 0 ? <EmptyState icon={Gift} title="Catálogo vazio no momento" description="Novas recompensas de parceiros chegam em breve." /> : (
            <ul className="grid grid-cols-1 gap-x-12 lg:grid-cols-2">
              {catalog.map((r) => <RewardRow key={r.id} r={r} balance={user.points} onRedeem={() => setConfirm(r)} />)}
            </ul>
          ))}

      {view === 'mine' && (redemptions.isPending ? <SkeletonText lines={5} /> : redemptions.error ? <ErrorState error={redemptions.error} onRetry={redemptions.refetch} /> :
          redemptions.data.length === 0 ? (
            <EmptyState icon={Ticket} title="Nenhum resgate ainda" description="Quando você trocar pontos, o código do voucher aparece aqui para usar no parceiro."
              action={<Button variant="secondary" onClick={() => setTab('catalogo')}>Ver catálogo</Button>} />
          ) : (
            <ul className="divide-y divide-line border-y border-line">
              {redemptions.data.map((r) => {
                const Icon = iconByName(r.reward.icon, Gift);
                return (
                  <li key={r.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <Icon className="size-5 shrink-0 text-fg-soft" strokeWidth={1.6} aria-hidden />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-fg">{r.reward.name}</p>
                        <p className="text-xs text-subtle">{formatDate(r.createdAt)} · <span className="font-mono tabular">{formatNumber(r.cost)} pts</span></p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 sm:justify-end">
                      <code className={cn('rounded-lg border border-line bg-bg-deep px-3 py-1.5 font-mono text-sm tracking-wider', r.status === 'ISSUED' ? 'text-fg' : 'text-subtle line-through')}>{r.code}</code>
                      {r.status === 'ISSUED' && <CopyButton value={r.code} />}
                      <StatusPill map={redemptionStatus} value={r.status} />
                    </div>
                  </li>
                );
              })}
            </ul>
          ))}

      {view === 'ledger' && <Ledger />}

      <ConfirmDialog
        open={!!confirm}
        onClose={() => !redeem.isPending && setConfirm(null)}
        onConfirm={doRedeem}
        loading={redeem.isPending}
        title={confirm ? `Resgatar ${confirm.name}?` : ''}
        description="Os pontos são descontados agora e o voucher é gerado na hora. Esta ação não pode ser desfeita."
        confirmLabel="Confirmar resgate"
      >
        {confirm && (
          <dl className="mt-1 divide-y divide-line border-y border-line text-sm">
            <div className="flex justify-between py-2.5"><dt className="text-muted">Custo</dt><dd className="font-mono text-fg tabular">−{formatNumber(confirm.costPoints)} pts</dd></div>
            <div className="flex justify-between py-2.5"><dt className="text-muted">Saldo depois</dt><dd className="font-mono text-fg tabular">{formatNumber(user.points - confirm.costPoints)} pts</dd></div>
            {confirm.partner && <div className="flex justify-between py-2.5"><dt className="text-muted">Parceiro</dt><dd className="text-fg-soft">{confirm.partner}</dd></div>}
          </dl>
        )}
      </ConfirmDialog>

      <Modal open={!!voucher} onClose={() => setVoucher(null)} title="Seu voucher está pronto" size="sm"
        description={voucher ? voucher.reward.name : undefined}
        footer={<><Button variant="ghost" onClick={() => { setVoucher(null); setTab('resgates'); }}>Ver meus resgates</Button><Button onClick={() => setVoucher(null)}>Concluir</Button></>}>
        {voucher && (
          <div className="text-center">
            <p className="label-mono">Código</p>
            <p className="mt-3 rounded-xl border border-dashed border-line-strong bg-bg-deep px-4 py-5 font-mono text-[26px] font-medium tracking-[0.12em] text-fg select-all">{voucher.code}</p>
            <div className="mt-3 flex justify-center"><CopyButton value={voucher.code} label="Copiar código" size="md" /></div>
            <p className="mt-5 text-sm leading-relaxed text-muted">Apresente este código no parceiro. Ele fica disponível em “Meus resgates” até ser utilizado.</p>
          </div>
        )}
      </Modal>
    </>
  );
}

function RewardRow({ r, balance, onRedeem }: { r: Reward; balance: number; onRedeem: () => void }) {
  const Icon = iconByName(r.icon, Gift);
  const out = r.stock <= 0;
  const affordable = balance >= r.costPoints;
  const low = !out && r.stock <= 5;
  return (
    <li className="flex gap-4 border-b border-line py-5">
      <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl border border-line bg-surface-2 text-fg-soft">
        <Icon className="size-5" strokeWidth={1.6} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-[15px] font-semibold text-fg">{r.name}</h3>
            {r.partner && <p className="text-xs text-subtle">{r.partner}</p>}
          </div>
          <p className="shrink-0 font-mono text-[15px] text-fg tabular">{formatNumber(r.costPoints)}<span className="ml-1 text-xs text-muted">pts</span></p>
        </div>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">{r.description}</p>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <span className={cn('font-mono text-xs tabular', out ? 'text-danger' : low ? 'text-warning' : 'text-subtle')}>
            {out ? 'Esgotado' : low ? `Últimas ${r.stock} unidades` : `${formatNumber(r.stock)} em estoque`}
          </span>
          {out ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-subtle"><PackageX className="size-3.5" aria-hidden />Volta em breve</span>
          ) : affordable ? (
            <Button size="sm" variant="secondary" onClick={onRedeem}>Resgatar</Button>
          ) : (
            <span className="text-xs text-subtle">faltam <span className="font-mono text-fg-soft tabular">{formatNumber(r.costPoints - balance)}</span> pts</span>
          )}
        </div>
      </div>
    </li>
  );
}

function Ledger() {
  const [page, setPage] = useState(0);
  const q = usePointTransactions({ page, size: 15 });
  if (q.isPending) return <SkeletonText lines={8} />;
  if (q.error) return <ErrorState error={q.error} onRetry={q.refetch} />;
  if (q.data.content.length === 0) {
    return <EmptyState icon={ReceiptText} title="Sem movimentações" description="Pontos ganhos com descartes aprovados, bônus de desafios e resgates aparecem aqui."
      action={<ButtonLink to="/app/descartar" variant="secondary" leftIcon={ScanLine}>Registrar descarte</ButtonLink>} />;
  }
  return (
    <>
      <div className="mb-2 hidden grid-cols-[1fr_120px_120px] gap-4 px-0.5 font-mono text-[11px] tracking-wider text-subtle uppercase sm:grid">
        <span>Movimentação</span><span className="text-right">Pontos</span><span className="text-right">Saldo após</span>
      </div>
      <ul className={cn('divide-y divide-line border-y border-line', q.isPlaceholderData && 'opacity-60')}>
        {q.data.content.map((t) => (
          <li key={t.id} className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-0.5 py-3.5 sm:grid-cols-[1fr_120px_120px] sm:items-center">
            <div className="min-w-0">
              <p className="truncate text-sm text-fg">{t.description}</p>
              <p className="text-xs text-subtle"><span title={formatDateTime(t.createdAt)}>{formatRelative(t.createdAt)}</span> · {pointTransactionType[t.type].label}</p>
            </div>
            <p className={cn('text-right font-mono text-sm tabular', t.amount >= 0 ? 'text-success' : 'text-fg-soft')}>{t.amount >= 0 ? '+' : '−'}{formatNumber(Math.abs(t.amount))}</p>
            <p className="col-start-2 text-right font-mono text-xs text-subtle tabular sm:col-start-auto sm:text-sm sm:text-muted">
              <span className="sm:hidden">saldo </span>{formatNumber(t.balanceAfter)}
            </p>
          </li>
        ))}
      </ul>
      <Pagination className="mt-6" page={q.data.page} totalPages={q.data.totalPages} totalElements={q.data.totalElements} size={q.data.size} onChange={setPage} />
    </>
  );
}
