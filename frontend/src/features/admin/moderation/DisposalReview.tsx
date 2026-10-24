import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  AlertTriangle, Bot, Check, ChevronDown, ImageOff, MapPin, Maximize2, ShieldAlert, ShieldCheck, Sparkles, X,
} from 'lucide-react';
import type { Category, CategoryCode, Disposal } from '@/api/types';
import { Avatar, Button, Field, Modal, NumberInput, Select, StatusPill, Tooltip } from '@/components/ui';
import { CategoryIcon } from '@/components/CategoryIcon';
import { cn } from '@/lib/cn';
import { formatDateTime, formatKg, formatNumber, formatPercent, formatRelative } from '@/lib/format';
import { aiSource, categoryFallback, disposalStatus } from '@/lib/labels';
import { Detail, Kbd, Meter } from '../ui';

export const FLAG_THRESHOLD = 40;

export function fraudTone(score: number): 'danger' | 'warning' | 'neutral' {
  if (score >= 70) return 'danger';
  if (score >= FLAG_THRESHOLD) return 'warning';
  return 'neutral';
}

export function aiMismatch(d: Disposal): boolean {
  return !!d.ai?.suggestedCode && d.ai.suggestedCode !== d.category.code;
}

export function codeName(code: CategoryCode | null | undefined, categories?: Category[]): string {
  if (!code) return '—';
  return categories?.find((c) => c.code === code)?.name ?? categoryFallback[code].name;
}

/** Pontuação de risco em mono com tom. */
export function FraudScore({ score, className }: { score: number; className?: string }) {
  const tone = fraudTone(score);
  return (
    <span className={cn('inline-flex items-baseline gap-0.5 font-mono text-[13px] tabular',
      tone === 'danger' ? 'text-danger' : tone === 'warning' ? 'text-warning' : 'text-subtle', className)}>
      {score}<span className="text-[10px] opacity-60">/100</span>
    </span>
  );
}

export interface ApproveCorrection { categoryId?: string; quantityKg?: number }

interface Props {
  disposal: Disposal;
  categories: Category[] | undefined;
  onApprove: (c: ApproveCorrection) => void;
  onReject: () => void;
  busy?: boolean;
  /** Mostra as dicas de atalho (desktop). */
  showShortcuts?: boolean;
  /** Ref para o botão de aprovar com correção (atalho A). */
  approveRef?: (fn: (() => void) | null) => void;
}

/** Painel de revisão de um descarte: foto grande, IA × declarado, risco, correção e ações. */
export function DisposalReview({ disposal: d, categories, onApprove, onReject, busy, showShortcuts, approveRef }: Props) {
  const [zoom, setZoom] = useState(false);
  const [correcting, setCorrecting] = useState(false);
  const pending = d.status === 'PENDING';
  const mismatch = aiMismatch(d);
  const score = d.fraud?.score ?? 0;
  const tone = fraudTone(score);
  const flags = d.fraud?.flags ?? [];
  const activeCats = useMemo(() => (categories ?? []).filter((c) => c.active || c.id === d.category.id), [categories, d.category.id]);

  const schema = useMemo(() => z.object({
    categoryId: z.string().min(1, 'Escolha a categoria'),
    quantityKg: z.number({ invalid_type_error: 'Informe a quantidade', required_error: 'Informe a quantidade' }).min(0.01, 'Mínimo de 0,01 kg'),
  }).superRefine((v, ctx) => {
    const cat = categories?.find((c) => c.id === v.categoryId);
    if (cat && v.quantityKg > cat.maxKgPerDisposal) {
      ctx.addIssue({ code: 'custom', path: ['quantityKg'], message: `Máximo de ${formatNumber(cat.maxKgPerDisposal, 2)} kg para ${cat.name}` });
    }
  }), [categories]);
  type Values = z.infer<typeof schema>;
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { categoryId: d.category.id, quantityKg: d.quantityKg } });

  useEffect(() => {
    form.reset({ categoryId: d.category.id, quantityKg: d.quantityKg });
    setCorrecting(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d.id]);

  const catId = form.watch('categoryId');
  const kg = form.watch('quantityKg');
  const chosen = categories?.find((c) => c.id === catId);
  const corrected = catId !== d.category.id || (kg != null && Math.abs(kg - d.quantityKg) > 1e-9);
  const previewPoints = chosen && kg ? Math.round(kg * chosen.pointsPerKg) : d.estimatedPoints;

  const submitApprove = form.handleSubmit((v) => {
    if (!corrected) return onApprove({});
    onApprove({ categoryId: v.categoryId !== d.category.id ? v.categoryId : undefined, quantityKg: Math.abs(v.quantityKg - d.quantityKg) > 1e-9 ? v.quantityKg : undefined });
  }, () => setCorrecting(true));

  useEffect(() => {
    approveRef?.(pending ? () => void submitApprove() : null);
    return () => approveRef?.(null);
  });

  const applyAiSuggestion = () => {
    const target = categories?.find((c) => c.code === d.ai?.suggestedCode);
    if (!target) return;
    setCorrecting(true);
    form.setValue('categoryId', target.id, { shouldDirty: true, shouldValidate: true });
  };

  return (
    <article aria-label={`Descarte de ${d.user?.name ?? 'usuário'}`} className="flex h-full flex-col">
      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-5" data-lenis-prevent>
        {/* Foto */}
        <div className="relative overflow-hidden rounded-xl border border-line bg-bg-deep">
          {d.photoUrl ? (
            <button type="button" onClick={() => setZoom(true)} className="group block w-full" aria-label="Ampliar foto">
              <img src={d.photoUrl} alt={`Foto enviada: ${d.category.name}, ${formatKg(d.quantityKg)}`} className="aspect-[4/3] w-full object-cover" />
              <span className="absolute right-2.5 bottom-2.5 inline-flex size-8 items-center justify-center rounded-lg bg-[#070a08]/75 text-fg-soft opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                <Maximize2 className="size-4" aria-hidden />
              </span>
            </button>
          ) : (
            <div className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 text-subtle">
              <ImageOff className="size-7" strokeWidth={1.5} aria-hidden />
              <p className="text-[13px]">Descarte sem foto</p>
            </div>
          )}
          {!pending && <StatusPill map={disposalStatus} value={d.status} className="absolute top-2.5 left-2.5 bg-[#070a08]/85" />}
        </div>

        {/* Identificação */}
        <div className="flex items-start gap-3">
          <CategoryIcon icon={d.category.icon} color={d.category.color} code={d.category.code} size="md" />
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold text-fg">{d.category.name} · <span className="font-mono tabular">{formatKg(d.quantityKg)}</span></p>
            <p className="mt-0.5 text-[13px] text-muted">
              {formatDateTime(d.disposedAt)} · <span className="font-mono tabular">≈ {formatNumber(d.estimatedPoints)} pts</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 border-y border-line py-3">
          <Avatar name={d.user?.name} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13.5px] font-medium text-fg">{d.user?.name ?? 'Usuário'}</p>
            <p className="truncate text-xs text-muted">{d.user?.email}</p>
          </div>
          <p className="text-xs text-subtle">enviado {formatRelative(d.createdAt)}</p>
        </div>

        {/* Classificação: declarado × IA */}
        <section aria-labelledby={`cls-${d.id}`}>
          <h4 id={`cls-${d.id}`} className="label-mono mb-2.5">Classificação</h4>
          <div className={cn('grid grid-cols-2 overflow-hidden rounded-xl border', mismatch ? 'border-warning/35' : 'border-line')}>
            <div className="p-3.5">
              <p className="text-[11px] tracking-[0.06em] text-subtle uppercase">Declarado</p>
              <p className="mt-1.5 flex items-center gap-2 text-[14px] font-medium text-fg">
                <CategoryIcon variant="plain" size="sm" icon={d.category.icon} color={d.category.color} code={d.category.code} />
                {d.category.name}
              </p>
            </div>
            <div className={cn('border-l p-3.5', mismatch ? 'border-warning/35 bg-warning/[0.06]' : 'border-line')}>
              <p className="flex items-center gap-1.5 text-[11px] tracking-[0.06em] text-subtle uppercase">
                <Sparkles className="size-3" aria-hidden /> Sugestão da IA
              </p>
              {d.ai?.suggestedCode ? (
                <>
                  <p className={cn('mt-1.5 flex items-center gap-2 text-[14px] font-medium', mismatch ? 'text-warning' : 'text-fg')}>
                    <CategoryIcon variant="plain" size="sm" code={d.ai.suggestedCode} />
                    {codeName(d.ai.suggestedCode, categories)}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    <span className="font-mono tabular">{formatPercent(d.ai.confidence ?? 0)}</span> de confiança
                    {d.ai.source && <> · {aiSource[d.ai.source].label}</>}
                    {d.ai.verified ? <span className="ml-1 text-success">· verificada</span> : <span className="ml-1 text-subtle">· só informativa</span>}
                  </p>
                </>
              ) : <p className="mt-1.5 text-[13px] text-subtle">Sem sugestão</p>}
            </div>
          </div>
          {mismatch && pending && (
            <div className="mt-2 flex items-center justify-between gap-3 text-[13px]">
              <p className="flex items-center gap-1.5 text-warning"><AlertTriangle className="size-3.5" aria-hidden /> Categoria declarada diverge da IA</p>
              <Button variant="link" size="sm" onClick={applyAiSuggestion} className="text-[13px]">Usar sugestão</Button>
            </div>
          )}
        </section>

        {/* Risco */}
        <section aria-labelledby={`risk-${d.id}`}>
          <div className="mb-2.5 flex items-center justify-between">
            <h4 id={`risk-${d.id}`} className="label-mono flex items-center gap-1.5">
              Risco de fraude
              <Tooltip content="Soma de sinais do motor antifraude (0–100). A partir de 40 o descarte é sinalizado para revisão cuidadosa.">
                <button type="button" className="inline-flex size-4 items-center justify-center rounded-full border border-line-strong text-[10px] text-muted" aria-label="Como a pontuação funciona">?</button>
              </Tooltip>
            </h4>
            <FraudScore score={score} className="text-[15px]" />
          </div>
          <Meter value={score / 100} tone={tone === 'neutral' ? 'brand' : tone} mark={FLAG_THRESHOLD / 100} label="Risco de fraude" />
          {flags.length ? (
            <ul className="mt-3 space-y-2">
              {flags.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-[13px] leading-snug text-fg-soft">
                  <ShieldAlert className={cn('mt-0.5 size-3.5 shrink-0', tone === 'danger' ? 'text-danger' : 'text-warning')} aria-hidden />
                  {f}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 flex items-center gap-2 text-[13px] text-muted"><ShieldCheck className="size-3.5 text-success" aria-hidden /> Nenhum sinal de risco encontrado.</p>
          )}
        </section>

        {/* Contexto */}
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3.5">
          <Detail label="Local">
            {d.collectionPoint ? d.collectionPoint.name : d.latitude != null ? (
              <span className="inline-flex items-center gap-1 font-mono text-[12.5px] tabular"><MapPin className="size-3 text-subtle" aria-hidden />{d.latitude.toFixed(4)}, {d.longitude?.toFixed(4)}</span>
            ) : 'Não informado'}
          </Detail>
          <Detail label="Origem"><span className="inline-flex items-center gap-1.5"><Bot className="size-3.5 text-subtle" aria-hidden />{d.ai?.source ? aiSource[d.ai.source].label : 'Manual'}</span></Detail>
          {d.notes && <Detail label="Observação" className="col-span-2"><span className="whitespace-normal">{d.notes}</span></Detail>}
          {d.status === 'REJECTED' && d.rejectionReason && <Detail label="Motivo da recusa" className="col-span-2"><span className="whitespace-normal">{d.rejectionReason}</span></Detail>}
          {d.status === 'APPROVED' && <Detail label="Pontos creditados" mono>{formatNumber(d.pointsAwarded)} pts</Detail>}
          {d.reviewedAt && <Detail label="Revisado">{formatDateTime(d.reviewedAt)}</Detail>}
        </dl>

        {/* Correção */}
        {pending && (
          <section className="rounded-xl border border-line">
            <button type="button" onClick={() => setCorrecting((c) => !c)} aria-expanded={correcting}
              className="flex w-full items-center justify-between gap-3 px-3.5 py-3 text-left text-[13.5px] font-medium text-fg-soft hover:text-fg">
              <span>Corrigir antes de aprovar {corrected && <span className="ml-1.5 font-mono text-xs text-warning">· alterado</span>}</span>
              <ChevronDown className={cn('size-4 text-subtle transition-transform', correcting && 'rotate-180')} aria-hidden />
            </button>
            {correcting && (
              <form noValidate onSubmit={(e) => { e.preventDefault(); void submitApprove(); }} className="grid grid-cols-1 gap-3 border-t border-line p-3.5 sm:grid-cols-2">
                <Field label="Categoria" error={form.formState.errors.categoryId}>
                  <Select inputSize="sm" {...form.register('categoryId')} options={activeCats.map((c) => ({ value: c.id, label: c.name }))} />
                </Field>
                <Field label="Quantidade" error={form.formState.errors.quantityKg} hint={chosen ? `Máx. ${formatNumber(chosen.maxKgPerDisposal, 2)} kg` : undefined}>
                  <Controller control={form.control} name="quantityKg"
                    render={({ field }) => <NumberInput {...field} inputSize="sm" unit="kg" decimals={3} min={0.01} max={chosen?.maxKgPerDisposal ?? 1000} />} />
                </Field>
                <p className="text-xs text-muted sm:col-span-2">
                  Pontos com a correção: <span className="font-mono text-fg-soft tabular">≈ {formatNumber(previewPoints)} pts</span>
                </p>
              </form>
            )}
          </section>
        )}
      </div>

      {pending && (
        <footer className="flex items-center gap-2 border-t border-line bg-surface/80 p-4">
          <Button variant="danger" leftIcon={X} onClick={onReject} disabled={busy} className="flex-1 sm:flex-none">
            Recusar {showShortcuts && <Kbd className="ml-1 border-danger/30 bg-transparent text-danger">R</Kbd>}
          </Button>
          <Button variant="primary" leftIcon={Check} onClick={() => void submitApprove()} loading={busy} className="flex-1">
            {corrected ? 'Aprovar com correção' : 'Aprovar'} {showShortcuts && <Kbd className="ml-1 border-black/20 bg-black/10 text-accent-ink shadow-none">A</Kbd>}
          </Button>
        </footer>
      )}

      <Modal open={zoom} onClose={() => setZoom(false)} title={`${d.category.name} · ${formatKg(d.quantityKg)}`} description={d.user?.name} size="xl">
        {d.photoUrl && <img src={d.photoUrl} alt={`Foto enviada por ${d.user?.name ?? 'usuário'}`} className="max-h-[72dvh] w-full rounded-xl object-contain" />}
      </Modal>
    </article>
  );
}
