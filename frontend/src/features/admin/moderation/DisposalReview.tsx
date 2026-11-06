// Painel em que o admin revisa um descarte: foto, IA x categoria declarada, risco de fraude e aprovar/recusar.
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { FormNumber } from '@/features/admin/formControls';
import {
  AlertTriangle, Bot, Check, ChevronDown, ImageOff, MapPin, Maximize2, ShieldAlert, ShieldCheck, Sparkles, X,
} from 'lucide-react';
import type { Category, CategoryCode, Disposal } from '@/api/types';
import { Avatar, Botao, Campo, Modal, Selecao, PilulaStatus, Dica } from '@/components/ui';
import { IconeCategoria } from '@/components/CategoryIcon';
import { cn } from '@/lib/cn';
import { formatarDataHora, formatarKg, formatarNumero, formatarPercentual, formatarRelativo } from '@/lib/format';
import { origemIa, categoriaPadrao, statusDescarte } from '@/lib/labels';
import { Detalhe, Tecla, Medidor } from '../ui';

// Risco de fraude (0 a 100) é a soma dos sinais que o servidor encontrou (foto repetida, peso alto, muitos envios...).
// A partir de 40 o descarte fica sinalizado como suspeito; a partir de 70 aparece em vermelho.
const LIMITE_SUSPEITA = 40;

function tomDaFraude(pontuacao: number): 'danger' | 'warning' | 'neutral' {
  if (pontuacao >= 70) return 'danger';
  if (pontuacao >= LIMITE_SUSPEITA) return 'warning';
  return 'neutral';
}

// A IA sugeriu um material diferente do que o morador declarou: vale olhar a foto com mais cuidado.
export function divergeDaIa(d: Disposal): boolean {
  return !!d.ai?.suggestedCode && d.ai.suggestedCode !== d.category.code;
}

function nomeDoCodigo(codigo: CategoryCode | null | undefined, categorias?: Category[]): string {
  if (!codigo) return '—';
  return categorias?.find((c) => c.code === codigo)?.name ?? categoriaPadrao[codigo].name;
}

/** Pontuação de risco em mono com tom. */
export function PontuacaoFraude({ pontuacao, className }: { pontuacao: number; className?: string }) {
  const tom = tomDaFraude(pontuacao);
  return (
    <span className={cn('inline-flex items-baseline gap-0.5 font-mono text-[13px] tabular',
      tom === 'danger' ? 'text-danger' : tom === 'warning' ? 'text-warning' : 'text-subtle', className)}>
      {pontuacao}<span className="text-[10px] opacity-60">/100</span>
    </span>
  );
}

export interface CorrecaoAprovacao { categoryId?: string; quantityKg?: number }

interface Props {
  descarte: Disposal;
  categorias: Category[] | undefined;
  aoAprovar: (c: CorrecaoAprovacao) => void;
  aoRecusar: () => void;
  ocupado?: boolean;
  /** Mostra as dicas de atalho (desktop). */
  mostrarAtalhos?: boolean;
  /** Ref para o botão de aprovar com correção (atalho A). */
  refAprovar?: (fn: (() => void) | null) => void;
}

/** Painel de revisão de um descarte: foto grande, IA × declarado, risco, correção e ações. */
export function RevisaoDescarte({ descarte: d, categorias, aoAprovar, aoRecusar, ocupado, mostrarAtalhos, refAprovar }: Props) {
  const [ampliada, setAmpliada] = useState(false);
  const [corrigindo, setCorrigindo] = useState(false);
  const pendente = d.status === 'PENDING';
  const divergente = divergeDaIa(d);
  const pontuacao = d.fraud?.score ?? 0;
  const tom = tomDaFraude(pontuacao);
  const sinais = d.fraud?.flags ?? [];
  const categoriasAtivas = useMemo(() => (categorias ?? []).filter((c) => c.active || c.id === d.category.id), [categorias, d.category.id]);

  const esquema = useMemo(() => z.object({
    categoryId: z.string().min(1, 'Escolha a categoria'),
    quantityKg: z.number({ invalid_type_error: 'Informe a quantidade', required_error: 'Informe a quantidade' }).min(0.01, 'Mínimo de 0,01 kg'),
  }).superRefine((v, ctx) => {
    const categoria = categorias?.find((c) => c.id === v.categoryId);
    if (categoria && v.quantityKg > categoria.maxKgPerDisposal) {
      ctx.addIssue({ code: 'custom', path: ['quantityKg'], message: `Máximo de ${formatarNumero(categoria.maxKgPerDisposal, 2)} kg para ${categoria.name}` });
    }
  }), [categorias]);
  type Valores = z.infer<typeof esquema>;
  const formulario = useForm<Valores>({ resolver: zodResolver(esquema), defaultValues: { categoryId: d.category.id, quantityKg: d.quantityKg } });

  useEffect(() => {
    formulario.reset({ categoryId: d.category.id, quantityKg: d.quantityKg });
    setCorrigindo(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d.id]);

  const idCategoria = formulario.watch('categoryId');
  const kg = formulario.watch('quantityKg');
  const escolhida = categorias?.find((c) => c.id === idCategoria);
  const corrigido = idCategoria !== d.category.id || (kg != null && Math.abs(kg - d.quantityKg) > 1e-9);
  const pontosPrevistos = escolhida && kg ? Math.round(kg * escolhida.pointsPerKg) : d.estimatedPoints;

  // Aprovar: sem correção manda vazio; com correção manda só o que mudou (categoria e/ou peso),
  // e o servidor recalcula os pontos com esses valores.
  const enviarAprovacao = formulario.handleSubmit((v) => {
    if (!corrigido) return aoAprovar({});
    aoAprovar({ categoryId: v.categoryId !== d.category.id ? v.categoryId : undefined, quantityKg: Math.abs(v.quantityKg - d.quantityKg) > 1e-9 ? v.quantityKg : undefined });
  }, () => setCorrigindo(true));

  useEffect(() => {
    refAprovar?.(pendente ? () => void enviarAprovacao() : null);
    return () => refAprovar?.(null);
  });

  const aplicarSugestaoIa = () => {
    const alvo = categorias?.find((c) => c.code === d.ai?.suggestedCode);
    if (!alvo) return;
    setCorrigindo(true);
    formulario.setValue('categoryId', alvo.id, { shouldDirty: true, shouldValidate: true });
  };

  return (
    <article aria-label={`Descarte de ${d.user?.name ?? 'usuário'}`} className="flex h-full flex-col">
      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-5" data-lenis-prevent>
        {/* Foto */}
        <div className="relative overflow-hidden rounded-xl border border-line bg-bg-deep">
          {d.photoUrl ? (
            <button type="button" onClick={() => setAmpliada(true)} className="group block w-full" aria-label="Ampliar foto">
              <img src={d.photoUrl} alt={`Foto enviada: ${d.category.name}, ${formatarKg(d.quantityKg)}`} className="aspect-[4/3] w-full object-cover" />
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
          {!pendente && <PilulaStatus mapa={statusDescarte} value={d.status} className="absolute top-2.5 left-2.5 bg-[#070a08]/85" />}
        </div>

        {/* Identificação */}
        <div className="flex items-start gap-3">
          <IconeCategoria icon={d.category.icon} cor={d.category.color} codigo={d.category.code} size="md" />
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold text-fg">{d.category.name} · <span className="font-mono tabular">{formatarKg(d.quantityKg)}</span></p>
            <p className="mt-0.5 text-[13px] text-muted">
              {formatarDataHora(d.disposedAt)} · <span className="font-mono tabular">≈ {formatarNumero(d.estimatedPoints)} pts</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 border-y border-line py-3">
          <Avatar nome={d.user?.name} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13.5px] font-medium text-fg">{d.user?.name ?? 'Usuário'}</p>
            <p className="truncate text-xs text-muted">{d.user?.email}</p>
          </div>
          <p className="text-xs text-subtle">enviado {formatarRelativo(d.createdAt)}</p>
        </div>

        {/* Classificação: declarado × IA */}
        <section aria-labelledby={`cls-${d.id}`}>
          <h4 id={`cls-${d.id}`} className="label-mono mb-2.5">Classificação</h4>
          <div className={cn('grid grid-cols-2 overflow-hidden rounded-xl border', divergente ? 'border-warning/35' : 'border-line')}>
            <div className="p-3.5">
              <p className="text-[11px] tracking-[0.06em] text-subtle uppercase">Declarado</p>
              <p className="mt-1.5 flex items-center gap-2 text-[14px] font-medium text-fg">
                <IconeCategoria variant="plain" size="sm" icon={d.category.icon} cor={d.category.color} codigo={d.category.code} />
                {d.category.name}
              </p>
            </div>
            <div className={cn('border-l p-3.5', divergente ? 'border-warning/35 bg-warning/[0.06]' : 'border-line')}>
              <p className="flex items-center gap-1.5 text-[11px] tracking-[0.06em] text-subtle uppercase">
                <Sparkles className="size-3" aria-hidden /> Sugestão da IA
              </p>
              {d.ai?.suggestedCode ? (
                <>
                  <p className={cn('mt-1.5 flex items-center gap-2 text-[14px] font-medium', divergente ? 'text-warning' : 'text-fg')}>
                    <IconeCategoria variant="plain" size="sm" codigo={d.ai.suggestedCode} />
                    {nomeDoCodigo(d.ai.suggestedCode, categorias)}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    <span className="font-mono tabular">{formatarPercentual(d.ai.confidence ?? 0)}</span> de confiança
                    {d.ai.source && <> · {origemIa[d.ai.source].label}</>}

                  </p>
                </>
              ) : <p className="mt-1.5 text-[13px] text-subtle">Sem sugestão</p>}
              {d.ai?.suggestedCode && (
                <Dica conteudo={d.ai.verified
                  ? 'Classificada pela IA do servidor. Só a IA verificada conta para o bônus de +10% quando bate com a categoria declarada.'
                  : 'Palpite do modelo que roda no navegador do morador: serve de referência, mas não conta para o bônus de +10%.'}>
                  <span tabIndex={0} className={cn('mt-2 inline-flex items-center gap-1 rounded-md border px-1.5 py-px text-[11px]',
                    d.ai.verified ? 'border-success/30 text-success' : 'border-line-strong text-muted')}>
                    {d.ai.verified ? <ShieldCheck className="size-3" aria-hidden /> : <Bot className="size-3" aria-hidden />}
                    {d.ai.verified ? 'IA verificada' : 'Palpite do navegador'}
                  </span>
                </Dica>
              )}
            </div>
          </div>
          {divergente && pendente && (
            <div className="mt-2 flex items-center justify-between gap-3 text-[13px]">
              <p className="flex items-center gap-1.5 text-warning"><AlertTriangle className="size-3.5" aria-hidden /> Categoria declarada diverge da IA</p>
              <Botao variant="link" size="sm" onClick={aplicarSugestaoIa} className="text-[13px]">Usar sugestão</Botao>
            </div>
          )}
        </section>

        {/* Risco */}
        <section aria-labelledby={`risk-${d.id}`}>
          <div className="mb-2.5 flex items-center justify-between">
            <h4 id={`risk-${d.id}`} className="label-mono flex items-center gap-1.5">
              Risco de fraude
              <Dica conteudo="Soma de sinais do motor antifraude (0–100). A partir de 40 o descarte é sinalizado para revisão cuidadosa.">
                <button type="button" className="inline-flex size-4 items-center justify-center rounded-full border border-line-strong text-[10px] text-muted" aria-label="Como a pontuação funciona">?</button>
              </Dica>
            </h4>
            <PontuacaoFraude pontuacao={pontuacao} className="text-[15px]" />
          </div>
          <Medidor value={pontuacao / 100} tone={tom === 'neutral' ? 'brand' : tom} marca={LIMITE_SUSPEITA / 100} label="Risco de fraude" />
          {sinais.length ? (
            <ul className="mt-3 space-y-2">
              {sinais.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-[13px] leading-snug text-fg-soft">
                  <ShieldAlert className={cn('mt-0.5 size-3.5 shrink-0', tom === 'danger' ? 'text-danger' : 'text-warning')} aria-hidden />
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
          <Detalhe label="Local">
            {d.collectionPoint ? d.collectionPoint.name : d.latitude != null ? (
              <span className="inline-flex items-center gap-1 font-mono text-[12.5px] tabular"><MapPin className="size-3 text-subtle" aria-hidden />{d.latitude.toFixed(4)}, {d.longitude?.toFixed(4)}</span>
            ) : 'Não informado'}
          </Detalhe>
          <Detalhe label="Origem"><span className="inline-flex items-center gap-1.5"><Bot className="size-3.5 text-subtle" aria-hidden />{d.ai?.source ? origemIa[d.ai.source].label : 'Manual'}</span></Detalhe>
          {d.notes && <Detalhe label="Observação" className="col-span-2"><span className="whitespace-normal">{d.notes}</span></Detalhe>}
          {d.status === 'REJECTED' && d.rejectionReason && <Detalhe label="Motivo da recusa" className="col-span-2"><span className="whitespace-normal">{d.rejectionReason}</span></Detalhe>}
          {d.status === 'APPROVED' && <Detalhe label="Pontos creditados" mono>{formatarNumero(d.pointsAwarded)} pts</Detalhe>}
          {d.reviewedAt && <Detalhe label="Revisado">{formatarDataHora(d.reviewedAt)}</Detalhe>}
        </dl>

        {/* Correção */}
        {pendente && (
          <section className="rounded-xl border border-line">
            <button type="button" onClick={() => setCorrigindo((c) => !c)} aria-expanded={corrigindo}
              className="flex w-full items-center justify-between gap-3 px-3.5 py-3 text-left text-[13.5px] font-medium text-fg-soft hover:text-fg">
              <span>Corrigir antes de aprovar {corrigido && <span className="ml-1.5 font-mono text-xs text-warning">· alterado</span>}</span>
              <ChevronDown className={cn('size-4 text-subtle transition-transform', corrigindo && 'rotate-180')} aria-hidden />
            </button>
            {corrigindo && (
              <form noValidate onSubmit={(e) => { e.preventDefault(); void enviarAprovacao(); }} className="grid grid-cols-1 gap-3 border-t border-line p-3.5 sm:grid-cols-2">
                <Campo label="Categoria" erro={formulario.formState.errors.categoryId}>
                  <Selecao tamanhoCampo="sm" {...formulario.register('categoryId')} opcoes={categoriasAtivas.map((c) => ({ value: c.id, label: c.name }))} />
                </Campo>
                <Campo label="Quantidade" erro={formulario.formState.errors.quantityKg} dica={escolhida ? `Máx. ${formatarNumero(escolhida.maxKgPerDisposal, 2)} kg` : undefined}>
                  <FormNumber control={formulario.control} name="quantityKg" tamanhoCampo="sm" unidade="kg" casasDecimais={3} min={0.01} max={escolhida?.maxKgPerDisposal ?? 1000} />
                </Campo>
                <p className="text-xs text-muted sm:col-span-2">
                  Pontos com a correção: <span className="font-mono text-fg-soft tabular">≈ {formatarNumero(pontosPrevistos)} pts</span>
                </p>
              </form>
            )}
          </section>
        )}
      </div>

      {pendente && (
        <footer className="flex items-center gap-2 border-t border-line bg-surface/80 p-4">
          <Botao variant="danger" iconeEsquerda={X} onClick={aoRecusar} disabled={ocupado} className="flex-1 sm:flex-none">
            Recusar {mostrarAtalhos && <Tecla className="ml-1 border-danger/30 bg-transparent text-danger">R</Tecla>}
          </Botao>
          <Botao variant="primary" iconeEsquerda={Check} onClick={() => void enviarAprovacao()} carregando={ocupado} className="flex-1">
            {corrigido ? 'Aprovar com correção' : 'Aprovar'} {mostrarAtalhos && <Tecla className="ml-1 border-black/20 bg-black/10 text-accent-ink shadow-none">A</Tecla>}
          </Botao>
        </footer>
      )}

      <Modal open={ampliada} onClose={() => setAmpliada(false)} title={`${d.category.name} · ${formatarKg(d.quantityKg)}`} description={d.user?.name} size="xl">
        {d.photoUrl && <img src={d.photoUrl} alt={`Foto enviada por ${d.user?.name ?? 'usuário'}`} className="max-h-[72dvh] w-full rounded-xl object-contain" />}
      </Modal>
    </article>
  );
}
