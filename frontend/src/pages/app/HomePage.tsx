import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertTriangle, Cpu, Crown, LogOut, Plus, Radio, Trash2 } from 'lucide-react';
import { applyServerErrors, errorMessage } from '@/api';
import {
  useCategories, useCreateBin, useDeleteBin, useHousehold, useHouseholdBins, useLeaveHousehold, useSendBinReading,
} from '@/api/queries';
import type { Household, SmartBin, SmartBinCreated } from '@/api/types';
import { useUser } from '@/auth/AuthProvider';
import {
  Avatar, Button, ConfirmDialog, EmptyState, ErrorState, Field, FormError, IconButton, Input, Modal, NumberInput,
  PageHeader, PageSkeleton, Select, SkeletonCard, StatTile, toast,
} from '@/components/ui';
import { SetupHousehold } from '@/features/resident/home/SetupHousehold';
import { BinGauge, CopyButton, SectionHeading } from '@/features/resident/shared';
import { formatKg, formatNumber } from '@/lib/format';

export default function HomePage() {
  const q = useHousehold();
  if (q.isPending) return <PageSkeleton />;
  if (q.error) return (<><PageHeader eyebrow="Smart Home 2050" title="Minha casa" /><ErrorState error={q.error} onRetry={q.refetch} /></>);
  if (!q.data) {
    return (
      <>
        <PageHeader eyebrow="Smart Home 2050" title="Sua casa, conectada à reciclagem"
          description="Uma residência reúne quem mora junto: pontos somados, ranking próprio e lixeiras inteligentes que pedem a coleta sozinhas." />
        <SetupHousehold />
      </>
    );
  }
  return <HouseholdView h={q.data} />;
}

function HouseholdView({ h }: { h: Household }) {
  const user = useUser();
  const bins = useHouseholdBins(true, 20_000);
  const [adding, setAdding] = useState(false);
  const [created, setCreated] = useState<SmartBinCreated | null>(null);
  const [removing, setRemoving] = useState<SmartBin | null>(null);
  const [leaving, setLeaving] = useState(false);
  const del = useDeleteBin();
  const leave = useLeaveHousehold();
  const isOwner = h.members.some((m) => m.id === user.id && m.isOwner);
  const attention = bins.data?.filter((b) => b.status === 'FULL' || b.status === 'ATTENTION').length ?? 0;
  const members = [...h.members].sort((a, b) => b.points - a.points);

  return (
    <>
      <PageHeader eyebrow="Smart Home 2050" title={h.name} description={`${h.neighborhood} · ${h.city} · ${h.members.length} ${h.members.length === 1 ? 'morador' : 'moradores'}`}
        actions={<Button size="lg" leftIcon={Plus} onClick={() => setAdding(true)}>Adicionar lixeira</Button>} />

      <section aria-label="Números da casa" className="grid grid-cols-2 divide-line border-y border-line lg:grid-cols-4 lg:divide-x [&>*]:py-5 lg:[&>*:not(:first-child)]:pl-6">
        <StatTile variant="plain" label="Total reciclado" value={h.stats.totalKg} format={(v) => formatKg(v)} hint="desde a criação" />
        <StatTile variant="plain" label="Este mês" value={h.stats.monthKg} format={(v) => formatKg(v)} hint="soma dos moradores" />
        <StatTile variant="plain" label="Pontos da casa" value={h.stats.points} hint="ranking de residências" />
        <StatTile variant="plain" label="CO₂ evitado" value={h.stats.co2AvoidedKg} format={(v) => formatKg(v)} hint="emissões que não ocorreram" />
      </section>

      <section aria-labelledby="bins-h" className="mt-12">
        <SectionHeading id="bins-h" title="Lixeiras inteligentes"
          description={bins.data?.length
            ? `${attention ? `${attention} ${attention === 1 ? 'precisa' : 'precisam'} de atenção. ` : 'Tudo em ordem. '}Ao passar da marca de limite, a coleta é pedida automaticamente. Atualiza a cada 20 s.`
            : 'Sensores de nível e bateria em cada lixeira da casa.'}
          action={bins.isFetching && !bins.isPending ? <span className="inline-flex items-center gap-1.5 text-xs text-subtle"><Radio className="size-3.5 animate-pulse" aria-hidden />atualizando</span> : undefined} />
        {bins.isPending ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((i) => <SkeletonCard key={i} rows={4} />)}</div>
        ) : bins.error ? <ErrorState error={bins.error} onRetry={bins.refetch} /> : bins.data.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line-strong">
            <EmptyState icon={Cpu} title="Nenhuma lixeira conectada" description="Cadastre uma lixeira para receber o ID e a chave do dispositivo. O sensor envia o nível de enchimento e a bateria."
              action={<Button variant="secondary" leftIcon={Plus} onClick={() => setAdding(true)}>Adicionar lixeira</Button>} />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {bins.data.map((b) => (
              <BinGauge key={b.id} bin={b} actions={<IconButton icon={Trash2} label={`Remover ${b.name}`} size="sm" variant="ghost" onClick={() => setRemoving(b)} />} />
            ))}
          </div>
        )}
      </section>

      <div className="mt-14 grid grid-cols-1 gap-12 lg:grid-cols-[1.3fr_1fr]">
        <section aria-labelledby="mem-h">
          <SectionHeading id="mem-h" title="Moradores" description="Pontos acumulados por pessoa." />
          <ul className="divide-y divide-line border-y border-line">
            {members.map((m) => (
              <li key={m.id} className="flex items-center gap-3 py-3">
                <Avatar name={m.name} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 text-sm text-fg">
                    <span className="truncate">{m.name}</span>
                    {m.id === user.id && <span className="text-xs text-subtle">(você)</span>}
                    {m.isOwner && <Crown className="size-3.5 text-subtle" aria-label="responsável" />}
                  </span>
                </span>
                <span className="font-mono text-sm text-fg-soft tabular">{formatNumber(m.points)} pts</span>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="inv-h">
          <SectionHeading id="inv-h" title="Convidar moradores" description="Quem entrar com este código passa a somar pontos para a casa." />
          <div className="flex items-center gap-3 rounded-xl border border-line bg-bg-deep/50 p-3">
            <code className="flex-1 pl-1 font-mono text-xl font-medium tracking-[0.18em] text-fg select-all">{h.inviteCode}</code>
            <CopyButton value={h.inviteCode} label="Copiar código" size="md" />
          </div>
          <button type="button" onClick={() => setLeaving(true)}
            className="mt-10 inline-flex items-center gap-2 text-sm text-muted underline decoration-line-strong underline-offset-4 transition-colors hover:text-danger">
            <LogOut className="size-4" aria-hidden />Sair da residência
          </button>
        </section>
      </div>

      <AddBinModal open={adding} onClose={() => setAdding(false)} onCreated={(c) => { setAdding(false); setCreated(c); }} />
      <CredentialsModal created={created} onClose={() => setCreated(null)} />

      <ConfirmDialog open={!!removing} onClose={() => setRemoving(null)} tone="danger" loading={del.isPending}
        title={`Remover ${removing?.name ?? 'lixeira'}?`}
        description="O dispositivo deixa de enviar leituras e o histórico desta lixeira é apagado. Para reconectar, será preciso cadastrá-la de novo."
        confirmLabel="Remover lixeira"
        onConfirm={() => removing && del.mutate(removing.id, {
          onSuccess: () => { toast.success('Lixeira removida'); setRemoving(null); },
          onError: (e) => toast.error(errorMessage(e)),
        })} />

      <ConfirmDialog open={leaving} onClose={() => setLeaving(false)} tone="danger" loading={leave.isPending}
        title="Sair da residência?"
        description={isOwner && h.members.length > 1
          ? 'Você é o responsável. Ao sair, outro morador assume a residência. Seus pontos pessoais continuam com você.'
          : isOwner ? 'Você é o único morador: a residência e as lixeiras serão encerradas. Seus pontos pessoais continuam com você.'
            : 'Seus pontos pessoais continuam com você, mas deixam de contar para esta casa.'}
        confirmLabel="Sair"
        onConfirm={() => leave.mutate(undefined, {
          onSuccess: () => { toast.success('Você saiu da residência'); setLeaving(false); },
          onError: (e) => toast.error(errorMessage(e)),
        })} />
    </>
  );
}

const binSchema = z.object({
  name: z.string().trim().min(2, 'Mínimo de 2 caracteres').max(60, 'Máximo de 60 caracteres'),
  categoryId: z.string().min(1, 'Escolha o material'),
  capacityLiters: z.number({ invalid_type_error: 'Informe a capacidade', required_error: 'Informe a capacidade' }).int('Use um número inteiro').min(5, 'Mínimo de 5 L').max(1000, 'Máximo de 1000 L'),
  autoRequestThreshold: z.number({ invalid_type_error: 'Informe o limite', required_error: 'Informe o limite' }).int('Use um número inteiro').min(50, 'Mínimo de 50%').max(100, 'Máximo de 100%'),
});
type BinValues = z.infer<typeof binSchema>;

function AddBinModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (c: SmartBinCreated) => void }) {
  const categories = useCategories();
  const create = useCreateBin();
  const form = useForm<BinValues>({ resolver: zodResolver(binSchema), defaultValues: { name: '', categoryId: '', capacityLiters: 50, autoRequestThreshold: 80 } });
  const { register, control, handleSubmit, setError, reset, watch, formState: { errors, isSubmitting } } = form;
  const thr = watch('autoRequestThreshold');

  const onSubmit = handleSubmit(async (v) => {
    try {
      const c = await create.mutateAsync(v);
      reset();
      onCreated(c);
    } catch (e) { applyServerErrors(e, setError, { knownFields: ['name', 'categoryId', 'capacityLiters', 'autoRequestThreshold'] }); }
  });

  return (
    <Modal open={open} onClose={onClose} title="Adicionar lixeira inteligente" description="Depois de salvar, você recebe o ID e a chave para configurar o sensor."
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button type="submit" form="bin-form" loading={isSubmitting}>Cadastrar lixeira</Button></>}>
      <form id="bin-form" onSubmit={onSubmit} noValidate className="space-y-5">
        <FormError error={errors.root?.server} />
        <Field label="Nome" required error={errors.name} hint="Ex.: Recicláveis da cozinha">
          <Input {...register('name')} autoComplete="off" />
        </Field>
        <Field label="Material" required error={errors.categoryId}>
          <Select {...register('categoryId')} disabled={categories.isPending}>
            <option value="">Selecione…</option>
            {categories.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field label="Capacidade" required error={errors.capacityLiters} hint="De 5 a 1000 litros">
            {(a11y) => <Controller control={control} name="capacityLiters" render={({ field }) => (
              <NumberInput {...field} {...a11y} decimals={0} min={5} max={1000} step={5} unit="L" invalid={!!errors.capacityLiters} />
            )} />}
          </Field>
          <Field label="Pedir coleta em" required error={errors.autoRequestThreshold} hint="Entre 50% e 100% cheia">
            {(a11y) => <Controller control={control} name="autoRequestThreshold" render={({ field }) => (
              <NumberInput {...field} {...a11y} decimals={0} min={50} max={100} step={5} unit="%" invalid={!!errors.autoRequestThreshold} />
            )} />}
          </Field>
        </div>
        <p className="text-xs leading-relaxed text-subtle">
          Ao atingir {thr ?? 80}% a plataforma cria uma solicitação de coleta para o endereço da casa, sem você precisar fazer nada.
        </p>
      </form>
    </Modal>
  );
}

function CredentialsModal({ created, onClose }: { created: SmartBinCreated | null; onClose: () => void }) {
  const send = useSendBinReading();
  const [sent, setSent] = useState<number | null>(null);
  const close = () => { setSent(null); onClose(); };
  const test = () => {
    if (!created) return;
    const fill = sent == null ? 35 : Math.min(100, sent + 30);
    send.mutate({ device: { deviceId: created.deviceId, deviceKey: created.deviceKey }, reading: { fillLevel: fill, batteryLevel: 96 } }, {
      onSuccess: () => { setSent(fill); toast.success(`Leitura de ${fill}% recebida`); },
      onError: (e) => toast.error(errorMessage(e)),
    });
  };
  return (
    <Modal open={!!created} onClose={close} closeOnBackdrop={false} title={`${created?.bin.name ?? 'Lixeira'} cadastrada`}
      description="Configure o sensor com as credenciais abaixo."
      footer={<Button onClick={close}>Já guardei a chave</Button>}>
      {created && (
        <div className="space-y-5">
          <div role="alert" className="flex gap-3 rounded-xl border border-warning/30 bg-warning/[0.06] p-3.5 text-sm">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
            <p className="text-fg-soft"><span className="font-medium text-warning">A chave aparece só desta vez.</span> Por segurança ela é guardada com hash e não pode ser exibida de novo.</p>
          </div>
          <Credential label="ID do dispositivo (X-Device-Id)" value={created.deviceId} />
          <Credential label="Chave do dispositivo (X-Device-Key)" value={created.deviceKey} />
          <div className="border-t border-line pt-4">
            <p className="text-sm text-fg-soft">Testar a conexão</p>
            <p className="mt-0.5 text-xs text-subtle">Envia uma leitura simulada como se fosse o sensor (POST /api/iot/readings).</p>
            <Button className="mt-3" size="sm" variant="secondary" leftIcon={Radio} loading={send.isPending} onClick={test}>
              {sent == null ? 'Enviar leitura de teste' : `Enviar outra (${Math.min(100, sent + 30)}%)`}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function Credential({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="label-mono mb-1.5">{label}</p>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-lg border border-line bg-bg-deep px-3 py-2 font-mono text-[13px] text-fg select-all">{value}</code>
        <CopyButton value={value} />
      </div>
    </div>
  );
}
