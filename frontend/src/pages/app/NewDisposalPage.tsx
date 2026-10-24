import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AnimatePresence, motion } from 'motion/react';
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, Clock, Crosshair, LocateFixed, MapPin, Send, Sparkles } from 'lucide-react';
import { ApiError, applyServerErrors, errorMessage, newIdempotencyKey } from '@/api';
import { refreshMe, useCategories, useCollectionPoints, useCreateDisposal, useUploadPhoto } from '@/api/queries';
import type { AiSource, Category, Disposal, PhotoUpload } from '@/api/types';
import { useUser } from '@/auth/AuthProvider';
import { CategoryIcon } from '@/components/CategoryIcon';
import {
  Button, ButtonLink, ErrorState, Field, FormError, Input, NumberInput, PageHeader, Select, Skeleton, Switch, Textarea,
} from '@/components/ui';
import { CategoryPicker, GuidancePanel, SuggestionPanel, type Suggestion } from '@/features/resident/disposal/MaterialStep';
import { PhotoStep, type AnalysisPhase } from '@/features/resident/disposal/PhotoStep';
import { Stepper } from '@/features/resident/disposal/Stepper';
import { PhotoError, preparePhoto, type PreparedPhoto } from '@/features/resident/disposal/image';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/cn';
import { formatDistanceKm, formatKg, formatNumber, formatPoints } from '@/lib/format';

const STEPS = [
  { id: 'foto', label: 'Foto', hint: 'Câmera ou arquivo' },
  { id: 'material', label: 'Material', hint: 'IA sugere, você confirma' },
  { id: 'detalhes', label: 'Detalhes', hint: 'Peso, data e local' },
];
const DAY = 86_400_000;
const QUICK_KG = [0.1, 0.5, 1, 2, 5];

const pad = (n: number) => String(n).padStart(2, '0');
function toLocalInput(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const schema = z.object({
  categoryId: z.string({ required_error: 'Escolha a categoria do material' }).min(1, 'Escolha a categoria do material'),
  quantityKg: z.number({ required_error: 'Informe a quantidade', invalid_type_error: 'Informe a quantidade' }).min(0.01, 'O mínimo é 0,01 kg'),
  disposedAt: z.string().min(1, 'Informe quando foi o descarte').refine((v) => {
    const t = new Date(v).getTime();
    return Number.isFinite(t) && t <= Date.now() + 60_000 && t >= Date.now() - 7 * DAY;
  }, 'Use uma data dos últimos 7 dias (não pode ser no futuro)'),
  shareLocation: z.boolean(),
  collectionPointId: z.string().optional(),
  notes: z.string().max(500, 'Máximo de 500 caracteres').optional(),
});
type FormValues = z.infer<typeof schema>;

export default function NewDisposalPage() {
  const user = useUser();
  const categoriesQ = useCategories();
  const categories = useMemo(() => categoriesQ.data ?? [], [categoriesQ.data]);
  const upload = useUploadPhoto();
  const create = useCreateDisposal();
  const geo = useGeolocation();
  const qc = useQueryClient();

  const [step, setStep] = useState(0);
  const [maxReached, setMaxReached] = useState(0);
  const [photo, setPhoto] = useState<PreparedPhoto | null>(null);
  const [uploaded, setUploaded] = useState<PhotoUpload | null>(null);
  const [phase, setPhase] = useState<AnalysisPhase>('idle');
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [modelProgress, setModelProgress] = useState(0);
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [result, setResult] = useState<Disposal | null>(null);
  // Uma chave por intenção de registro: re-tentativas reaproveitam a mesma.
  const [idemKey, setIdemKey] = useState(() => newIdempotencyKey());
  const lastFile = useRef<File | null>(null);
  const runId = useRef(0);
  const topRef = useRef<HTMLDivElement>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { categoryId: '', quantityKg: undefined, disposedAt: toLocalInput(new Date()), shareLocation: false, collectionPointId: '', notes: '' },
    mode: 'onTouched',
  });
  const { control, register, watch, setValue, setError, clearErrors, formState: { errors, isSubmitting } } = form;
  const categoryId = watch('categoryId');
  const quantityKg = watch('quantityKg');
  const shareLocation = watch('shareLocation');
  const collectionPointId = watch('collectionPointId');
  const category = categories.find((c) => c.id === categoryId);
  const estimated = category && quantityKg ? Math.max(1, Math.round(quantityKg * category.pointsPerKg)) : 0;

  const located = shareLocation && geo.status === 'success';
  const points = useCollectionPoints(located
    ? { lat: geo.latitude!, lon: geo.longitude!, radiusKm: 15, category: category?.code }
    : { category: category?.code });

  // Libera o objectURL da pré-visualização.
  useEffect(() => () => { if (photo) URL.revokeObjectURL(photo.previewUrl); }, [photo]);

  const goTo = useCallback((i: number) => {
    setStep(i);
    setMaxReached((m) => Math.max(m, i));
    requestAnimationFrame(() => topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }, []);

  const applySuggestion = useCallback((s: Suggestion) => {
    setSuggestion(s);
    const cat = categories.find((c) => c.code === s.code);
    if (cat) { setValue('categoryId', cat.id, { shouldValidate: true }); }
  }, [categories, setValue]);

  const analyze = useCallback(async (file: File) => {
    const id = ++runId.current;
    lastFile.current = file;
    setPhotoError(null);
    setSuggestion(null);
    setUploaded(null);
    setPhase('preparing');
    let prepared: PreparedPhoto;
    try {
      prepared = await preparePhoto(file);
    } catch (e) {
      if (id !== runId.current) return;
      setPhase('idle');
      setPhoto(null);
      setPhotoError(e instanceof PhotoError ? e.message : 'Não foi possível ler esta imagem.');
      return;
    }
    if (id !== runId.current) return;
    setPhoto(prepared);
    setPhase('uploading');
    let up: PhotoUpload;
    try {
      up = await upload.mutateAsync(new File([prepared.blob], 'descarte.jpg', { type: 'image/jpeg' }));
    } catch (e) {
      if (id !== runId.current) return;
      setPhase('error');
      setPhotoError(errorMessage(e));
      return;
    }
    if (id !== runId.current) return;
    setUploaded(up);

    if (up.ai.available && up.ai.categoryCode) {
      applySuggestion({ code: up.ai.categoryCode, confidence: up.ai.confidence ?? 0.5, reasoning: up.ai.reasoning, source: up.ai.source ?? 'CLAUDE', verified: up.ai.verified === true });
      setPhase('done');
      goTo(1);
      return;
    }
    // IA do servidor indisponível → modelo local no navegador (lazy, offline).
    try {
      const mod = await import('@/features/resident/disposal/localClassifier');
      if (!mod.isModelLoaded()) setPhase('loading-model');
      const guessPromise = mod.classify(prepared.thumb, (p) => {
        setModelProgress(p);
        if (p >= 1 && id === runId.current) setPhase('classifying');
      });
      if (mod.isModelLoaded()) setPhase('classifying');
      const guess = await guessPromise;
      if (id !== runId.current) return;
      applySuggestion({ code: guess.code, confidence: guess.confidence, reasoning: guess.reasoning, source: 'LOCAL', verified: false, labels: guess.labels });
    } catch {
      if (id !== runId.current) return;
      setSuggestion(null); // segue com escolha manual
    }
    setPhase('done');
    goTo(1);
  }, [upload, applySuggestion, goTo]);

  const resetPhoto = () => {
    runId.current++;
    setPhoto(null);
    setUploaded(null);
    setSuggestion(null);
    setPhase('idle');
    setPhotoError(null);
    setStep(0);
  };

  const toggleLocation = (on: boolean) => {
    setValue('shareLocation', on);
    if (on && geo.status !== 'success') geo.request();
    if (!on) setValue('collectionPointId', '');
  };

  const nextFromMaterial = async () => {
    if (await form.trigger('categoryId')) goTo(2);
  };

  const onSubmit = form.handleSubmit(async (v) => {
    const cat = categories.find((c) => c.id === v.categoryId);
    if (!cat) { setError('categoryId', { message: 'Escolha a categoria' }); goTo(1); return; }
    if (v.quantityKg > cat.maxKgPerDisposal) {
      setError('quantityKg', { message: `Máximo de ${formatNumber(cat.maxKgPerDisposal, 2)} kg por descarte de ${cat.name}` });
      return;
    }
    const source: AiSource = suggestion ? suggestion.source : 'MANUAL';
    try {
      const d = await create.mutateAsync({
        idempotencyKey: idemKey,
        body: {
          categoryId: cat.id,
          quantityKg: Number(v.quantityKg.toFixed(3)),
          photoId: uploaded?.id ?? null,
          latitude: located ? geo.latitude : null,
          longitude: located ? geo.longitude : null,
          collectionPointId: v.collectionPointId || null,
          disposedAt: new Date(v.disposedAt).toISOString(),
          aiSuggestedCode: suggestion?.code ?? null,
          aiConfidence: suggestion ? Number(suggestion.confidence.toFixed(3)) : null,
          aiSource: source,
          notes: v.notes?.trim() || null,
        },
      });
      setResult(d);
      if (d.status === 'APPROVED') refreshMe(qc);
      requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    } catch (e) {
      const touched = applyServerErrors(e, setError, { knownFields: ['categoryId', 'quantityKg', 'disposedAt', 'collectionPointId', 'notes'] });
      if (!touched && e instanceof ApiError && e.fieldErrors.some((f) => f.field === 'photoId')) {
        setError('root.server', { message: 'Esta foto já foi usada em outro descarte. Tire uma nova foto do resíduo.' });
      }
    }
  });

  const restart = () => {
    resetPhoto();
    form.reset({ categoryId: '', quantityKg: undefined, disposedAt: toLocalInput(new Date()), shareLocation, collectionPointId: '', notes: '' });
    setResult(null);
    setMaxReached(0);
    setIdemKey(newIdempotencyKey());
  };

  if (result) return <SuccessView d={result} onAgain={restart} balance={user.points} />;

  if (categoriesQ.error) return (<><Header /><ErrorState error={categoriesQ.error} onRetry={categoriesQ.refetch} /></>);

  const now = new Date();
  const minDate = toLocalInput(new Date(now.getTime() - 7 * DAY + 60_000));
  const maxDate = toLocalInput(now);
  const nearest = points.data?.filter((p) => !category || p.categories.includes(category.code)).slice(0, 8) ?? [];

  return (
    <>
      <Header />
      <div ref={topRef} className="scroll-mt-24" />
      <div className="mb-8"><Stepper steps={STEPS} current={step} maxReached={maxReached} onSelect={goTo} /></div>

      <form onSubmit={onSubmit} noValidate className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-12">
        <div className="min-w-0">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={step} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}>
              {step === 0 && (
                <PhotoStep
                  photo={photo} phase={phase} modelProgress={modelProgress} error={photoError}
                  onFile={analyze}
                  onRetry={() => lastFile.current && analyze(lastFile.current)}
                  onReset={resetPhoto}
                  onSkip={() => { setSuggestion(null); goTo(1); }}
                />
              )}

              {step === 1 && (
                <div className="space-y-8">
                  {uploaded?.duplicateSuspected && <DuplicateWarning onReplace={resetPhoto} />}
                  {suggestion ? (
                    <SuggestionPanel suggestion={suggestion} category={categories.find((c) => c.code === suggestion.code)} />
                  ) : photo ? (
                    <p className="flex items-start gap-2 rounded-xl border border-line px-4 py-3 text-sm text-muted">
                      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
                      Não conseguimos identificar o material automaticamente. Escolha a categoria abaixo.
                    </p>
                  ) : null}
                  {categoriesQ.isPending ? <Skeleton className="h-64 rounded-2xl" /> : (
                    <CategoryPicker
                      categories={categories}
                      value={categoryId}
                      suggested={suggestion?.code ?? null}
                      onChange={(id) => { setValue('categoryId', id, { shouldValidate: true }); clearErrors('quantityKg'); }}
                      error={errors.categoryId?.message}
                    />
                  )}
                  {suggestion && category && category.code !== suggestion.code && (
                    <p className="-mt-4 text-xs text-muted">Você corrigiu a sugestão para <span className="text-fg-soft">{category.name}</span>. A correção fica registrada para melhorar a IA.</p>
                  )}
                  {category && <GuidancePanel category={category} />}
                  <StepNav onBack={() => goTo(0)} onNext={nextFromMaterial} nextLabel="Continuar" />
                </div>
              )}

              {step === 2 && (
                <div className="space-y-7">
                  {uploaded?.duplicateSuspected && <DuplicateWarning onReplace={resetPhoto} />}
                  <FormError error={errors.root?.server} />

                  <Field label="Quantidade" required error={errors.quantityKg}
                    hint={category ? `Máximo de ${formatKg(category.maxKgPerDisposal)} por descarte de ${category.name.toLowerCase()}. Sem balança? Uma garrafa PET de 2 L pesa ≈ 0,05 kg; uma lata, ≈ 0,015 kg.` : 'Peso aproximado em quilos.'}>
                    {(a11y) => (
                      <div>
                        <Controller control={control} name="quantityKg" render={({ field }) => (
                          <NumberInput {...field} {...a11y} value={field.value} unit="kg" decimals={2} min={0.01} max={category?.maxKgPerDisposal ?? 50} step={0.1} inputSize="lg" placeholder="0,00" invalid={!!errors.quantityKg} />
                        )} />
                        <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Valores rápidos">
                          {QUICK_KG.filter((k) => !category || k <= category.maxKgPerDisposal).map((k) => (
                            <button key={k} type="button" onClick={() => setValue('quantityKg', k, { shouldValidate: true })}
                              className={cn('h-8 rounded-lg border px-2.5 font-mono text-xs tabular transition-colors', quantityKg === k ? 'border-fg-soft text-fg' : 'border-line text-muted hover:border-line-strong hover:text-fg')}>
                              {formatNumber(k, 2)} kg
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </Field>

                  <Field label="Quando foi o descarte" required error={errors.disposedAt} hint="Registre descartes de até 7 dias atrás.">
                    <Input type="datetime-local" min={minDate} max={maxDate} leftIcon={Clock} {...register('disposedAt')} />
                  </Field>

                  <div className="space-y-4 border-t border-line pt-6">
                    <Switch checked={shareLocation} onChange={toggleLocation} label="Anexar minha localização"
                      description="Ajuda a validar o descarte e a sugerir o ecoponto mais próximo. Usada só neste registro." />
                    {shareLocation && (
                      <div className="pl-0 sm:pl-14" aria-live="polite">
                        {geo.status === 'loading' && <p className="flex items-center gap-2 text-sm text-muted"><Crosshair className="size-4 animate-pulse" aria-hidden /> Obtendo sua localização…</p>}
                        {geo.status === 'success' && (
                          <p className="flex items-center gap-2 font-mono text-xs text-muted tabular">
                            <LocateFixed className="size-4 text-success" aria-hidden />
                            {geo.latitude!.toFixed(5)}, {geo.longitude!.toFixed(5)} · precisão ± {formatNumber(geo.accuracy ?? 0)} m
                          </p>
                        )}
                        {(geo.status === 'error' || geo.status === 'unsupported') && (
                          <div className="flex flex-wrap items-center gap-3 text-sm text-warning">
                            <span className="flex items-start gap-2"><AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />{geo.error}</span>
                            {geo.status === 'error' && <Button size="sm" variant="secondary" onClick={geo.request}>Tentar de novo</Button>}
                          </div>
                        )}
                      </div>
                    )}
                    <Field label="Onde você descartou" optional error={errors.collectionPointId}
                      hint={located ? 'Ecopontos que aceitam este material, do mais perto ao mais longe.' : 'Ative a localização para ordenar por distância.'}>
                      <Select {...register('collectionPointId')}>
                        <option value="">Coleta seletiva de casa / outro local</option>
                        {nearest.map((p) => (
                          <option key={p.id} value={p.id}>{p.name}{p.distanceKm != null ? ` · ${formatDistanceKm(p.distanceKm)}` : ` · ${p.neighborhood}`}</option>
                        ))}
                      </Select>
                    </Field>
                    {collectionPointId && (() => {
                      const p = nearest.find((x) => x.id === collectionPointId);
                      return p ? <p className="-mt-3 flex items-start gap-2 text-xs text-subtle"><MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden />{p.address} · {p.openingHours}</p> : null;
                    })()}
                  </div>

                  <Field label="Observações" optional error={errors.notes}>
                    <Textarea rows={3} maxLength={500} placeholder="Ex.: garrafas lavadas e sem tampa" {...register('notes')} />
                  </Field>

                  <div className="flex flex-col-reverse gap-3 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
                    <Button variant="ghost" leftIcon={ArrowLeft} onClick={() => goTo(1)}>Voltar</Button>
                    <Button type="submit" size="lg" rightIcon={Send} loading={isSubmitting} disabled={!category}>
                      Enviar descarte{estimated ? ` · ≈ ${formatNumber(estimated)} pts` : ''}
                    </Button>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <Summary photo={photo} category={category} quantityKg={quantityKg} estimated={estimated} suggestion={suggestion} />
      </form>
    </>
  );
}

function Header() {
  return (
    <PageHeader
      eyebrow="Registrar descarte"
      title="O que vai para a reciclagem hoje?"
      description="Foto, material e peso. Em menos de um minuto o registro vai para análise e os pontos entram quando for aprovado."
    />
  );
}

function StepNav({ onBack, onNext, nextLabel }: { onBack: () => void; onNext: () => void; nextLabel: string }) {
  return (
    <div className="flex flex-col-reverse gap-3 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
      <Button variant="ghost" leftIcon={ArrowLeft} onClick={onBack}>Voltar</Button>
      <Button size="lg" rightIcon={ArrowRight} onClick={onNext}>{nextLabel}</Button>
    </div>
  );
}

function DuplicateWarning({ onReplace }: { onReplace: () => void }) {
  return (
    <div role="alert" className="flex flex-col gap-3 rounded-xl border border-warning/30 bg-warning/[0.06] p-4 sm:flex-row sm:items-center">
      <AlertTriangle className="size-5 shrink-0 text-warning" aria-hidden />
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-medium text-warning">Foto parecida com outra já enviada</p>
        <p className="mt-0.5 text-fg-soft">Registros duplicados são recusados pela verificação antifraude e não geram pontos.</p>
      </div>
      <Button size="sm" variant="secondary" onClick={onReplace}>Trocar foto</Button>
    </div>
  );
}

function Summary({ photo, category, quantityKg, estimated, suggestion }: {
  photo: PreparedPhoto | null; category: Category | undefined; quantityKg: number | undefined; estimated: number; suggestion: Suggestion | null;
}) {
  return (
    <aside aria-label="Resumo do descarte" className="lg:sticky lg:top-[calc(var(--header-h)+24px)] lg:self-start">
      <div className="surface overflow-hidden rounded-2xl">
        {photo && <img src={photo.previewUrl} alt="" className="hidden aspect-[16/10] w-full object-cover lg:block" />}
        <div className="p-5">
          <p className="label-mono">Resumo</p>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted">Material</dt>
              <dd className="flex items-center gap-2 text-fg">
                {category ? <><CategoryIcon icon={category.icon} code={category.code} color={category.color} variant="plain" size="sm" />{category.name}</> : <span className="text-subtle">—</span>}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted">Quantidade</dt>
              <dd className="font-mono text-fg tabular">{quantityKg ? formatKg(quantityKg) : <span className="text-subtle">—</span>}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted">Identificação</dt>
              <dd className="text-fg-soft">{suggestion ? (suggestion.verified ? 'Confirmado pela IA (+10%)' : suggestion.source === 'LOCAL' ? 'Sugestão do navegador' : 'IA no servidor') : 'Manual'}</dd>
            </div>
          </dl>
          <div className="mt-5 border-t border-line pt-5">
            <p className="text-xs text-muted">Pontos estimados</p>
            <p className="mt-1 flex items-baseline gap-1.5">
              <span className="font-mono text-[34px] leading-none font-medium tracking-[-0.03em] text-fg tabular">{estimated ? `≈ ${formatNumber(estimated)}` : '—'}</span>
              {estimated > 0 && <span className="text-sm text-muted">pts</span>}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-subtle">
              {category ? `${formatNumber(category.pointsPerKg)} pts por kg de ${category.name.toLowerCase()}. ` : ''}
              Creditados uma única vez, quando o descarte for aprovado.
            </p>
            {category && quantityKg ? (
              <p className="mt-3 font-mono text-xs text-success tabular">≈ {formatKg(quantityKg * category.co2FactorKg)} de CO₂ evitado</p>
            ) : null}
          </div>
        </div>
      </div>
    </aside>
  );
}

function SuccessView({ d, onAgain, balance }: { d: Disposal; onAgain: () => void; balance: number }) {
  const approved = d.status === 'APPROVED';
  useDocumentTitle(approved ? 'Descarte aprovado' : 'Descarte enviado');
  return (
    <div className="mx-auto max-w-xl py-6 text-center sm:py-12">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}>
        <CheckCircle2 className="mx-auto size-12 text-success" strokeWidth={1.4} aria-hidden />
        <p className="label-mono mt-6">{d.category.name} · {formatKg(d.quantityKg)}</p>
        <h1 className="mt-3 text-[clamp(2rem,1.6rem+1.4vw,2.75rem)] leading-tight text-fg">
          {approved ? <>Aprovado na hora. <em>Obrigado!</em></> : <>Recebido. Agora é <em>com a gente.</em></>}
        </h1>
        <div className="mx-auto mt-8 grid max-w-md grid-cols-2 divide-x divide-line border-y border-line">
          <div className="py-5">
            <p className="text-xs text-muted">{approved ? 'Pontos creditados' : 'Pontos estimados'}</p>
            <p className="mt-1 font-mono text-3xl font-medium tracking-[-0.03em] text-fg tabular">{approved ? `+${formatNumber(d.pointsAwarded)}` : `≈ ${formatNumber(d.estimatedPoints)}`}</p>
          </div>
          <div className="py-5">
            <p className="text-xs text-muted">Status</p>
            <p className={cn('mt-2 inline-flex items-center gap-1.5 text-sm font-medium', approved ? 'text-success' : 'text-warning')}>
              {approved ? <Sparkles className="size-4" aria-hidden /> : <Clock className="size-4" aria-hidden />}
              {approved ? 'Aprovado' : 'Pendente de aprovação'}
            </p>
          </div>
        </div>
        <p className="mx-auto mt-6 max-w-[48ch] text-sm leading-relaxed text-muted">
          {approved
            ? `Baixo risco e foto válida: a verificação automática aprovou o registro. Seu novo saldo é de ${formatPoints(balance)}.`
            : 'Um agente confere a foto, a categoria e o peso — normalmente em até 24 horas. Os pontos entram no seu saldo uma única vez, assim que o descarte for aprovado. Você acompanha tudo em “Meus descartes”.'}
        </p>
        <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
          <Button size="lg" onClick={onAgain} leftIcon={ArrowRight}>Registrar outro</Button>
          <ButtonLink to="/app/descartes" size="lg" variant="secondary">Ver meus descartes</ButtonLink>
        </div>
      </motion.div>
    </div>
  );
}
