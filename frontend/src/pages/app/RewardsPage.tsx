import { useMemo, useState } from 'react';
import { Gift, PackageX } from 'lucide-react';
import { errorMessage } from '@/api';
import { useRedeemReward, useRedemptions, useRewards } from '@/api/queries';
import type { Redemption, Reward } from '@/api/types';
import { useUser } from '@/auth/AuthProvider';
import { iconByName } from '@/components/icons';
import {
  Button, ConfirmDialog, EmptyState, ErrorState, Modal, PageHeader, ProgressBar, SkeletonText, StatusPill, toast,
} from '@/components/ui';
import { CopyButton } from '@/features/resident/shared';
import { useCountUpText } from '@/hooks/useCountUp';
import { cn } from '@/lib/cn';
import { formatDate, formatNumber } from '@/lib/format';
import { redemptionStatus } from '@/lib/labels';

/** Catálogo e resgates na mesma tela: o código do voucher aparece no próprio item resgatado. */
export default function RewardsPage() {
  const user = useUser();
  const rewards = useRewards();
  const redemptions = useRedemptions();
  const redeem = useRedeemReward();
  const [confirm, setConfirm] = useState<Reward | null>(null);
  const [voucher, setVoucher] = useState<Redemption | null>(null);
  const balanceRef = useCountUpText<HTMLSpanElement>(user.points, (v) => formatNumber(v), { duration: 900 });

  const catalog = useMemo(() => [...(rewards.data ?? [])].filter((r) => r.active).sort((a, b) => a.costPoints - b.costPoints), [rewards.data]);
  const nextGoal = catalog.find((r) => r.costPoints > user.points && r.stock > 0);
  const available = catalog.filter((r) => r.costPoints <= user.points && r.stock > 0).length;
  // Códigos ainda válidos ficam no item do catálogo; o resto (usados ou de recompensas que saíram) vai para o histórico.
  const inCatalog = new Set(catalog.map((r) => r.id));
  const activeCodes = (rewardId: string) => (redemptions.data ?? []).filter((r) => r.reward.id === rewardId && r.status === 'ISSUED');
  const past = (redemptions.data ?? []).filter((r) => r.status !== 'ISSUED' || !inCatalog.has(r.reward.id));

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
        description="Parceiros locais oferecem descontos, ingressos e produtos sustentáveis. Depois do resgate, o código fica no próprio item, pronto para copiar." />

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

      {rewards.isPending ? <SkeletonText lines={8} /> : rewards.error ? <ErrorState error={rewards.error} onRetry={rewards.refetch} /> :
        catalog.length === 0 ? <EmptyState icon={Gift} title="Catálogo vazio no momento" description="Novas recompensas de parceiros chegam em breve." /> : (
          <ul className="grid grid-cols-1 gap-x-12 lg:grid-cols-2">
            {catalog.map((r) => <RewardRow key={r.id} r={r} codes={activeCodes(r.id)} balance={user.points} onRedeem={() => setConfirm(r)} />)}
          </ul>
        )}

      {past.length > 0 && (
        <section aria-labelledby="past-h" className="mt-12">
          <h2 id="past-h" className="label-mono mb-2">Resgates anteriores</h2>
          <ul className="divide-y divide-line border-y border-line">
            {past.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3.5">
                <p className="min-w-0 flex-1 text-sm text-fg">{r.reward.name}
                  <span className="ml-2 text-xs text-subtle">{formatDate(r.createdAt)} · <span className="font-mono tabular">{formatNumber(r.cost)} pts</span></span>
                </p>
                <code className={cn('font-mono text-sm tracking-wider', r.status === 'ISSUED' ? 'text-fg' : 'text-subtle line-through')}>{r.code}</code>
                {r.status === 'ISSUED' && <CopyButton value={r.code} />}
                <StatusPill map={redemptionStatus} value={r.status} />
              </li>
            ))}
          </ul>
        </section>
      )}

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
        footer={<Button onClick={() => setVoucher(null)}>Concluir</Button>}>
        {voucher && (
          <div className="text-center">
            <p className="label-mono">Código</p>
            <p className="mt-3 rounded-xl border border-dashed border-line-strong bg-bg-deep px-4 py-5 font-mono text-[26px] font-medium tracking-[0.12em] text-fg select-all">{voucher.code}</p>
            <div className="mt-3 flex justify-center"><CopyButton value={voucher.code} label="Copiar código" size="md" /></div>
            <p className="mt-5 text-sm leading-relaxed text-muted">Apresente este código no parceiro. Ele fica no próprio item do catálogo até ser utilizado.</p>
          </div>
        )}
      </Modal>
    </>
  );
}

function RewardRow({ r, codes, balance, onRedeem }: { r: Reward; codes: Redemption[]; balance: number; onRedeem: () => void }) {
  const Icon = iconByName(r.icon, Gift);
  const out = r.stock <= 0;
  const affordable = balance >= r.costPoints;
  const low = !out && r.stock <= 5;
  const redeemed = codes.length > 0;
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

        {codes.map((c) => (
          <div key={c.id} className="mt-3 flex items-center gap-2">
            <code className="rounded-lg border border-line bg-bg-deep px-3 py-1.5 font-mono text-sm tracking-wider text-fg">{c.code}</code>
            <CopyButton value={c.code} label="Copiar código" />
          </div>
        ))}

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <span className={cn('font-mono text-xs tabular', out ? 'text-danger' : low ? 'text-warning' : 'text-subtle')}>
            {out ? 'Esgotado' : low ? `Últimas ${r.stock} unidades` : `${formatNumber(r.stock)} em estoque`}
          </span>
          {out ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-subtle"><PackageX className="size-3.5" aria-hidden />Volta em breve</span>
          ) : affordable ? (
            <Button size="sm" variant={redeemed ? 'ghost' : 'secondary'} onClick={onRedeem}>{redeemed ? 'Resgatar outro' : 'Resgatar'}</Button>
          ) : (
            <span className="text-xs text-subtle">faltam <span className="font-mono text-fg-soft tabular">{formatNumber(r.costPoints - balance)}</span> pts</span>
          )}
        </div>
      </div>
    </li>
  );
}
