// Registrar descarte: Foto -> Material (IA sugere, morador confirma) -> Detalhes -> resultado.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AnimatePresence, motion } from 'motion/react';
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, Clock, Crosshair, LocateFixed, MapPin, Send, Sparkles } from 'lucide-react';
import { ErroApi, aplicarErrosDoServidor, mensagemDeErro, novaChaveIdempotencia } from '@/api';
import { recarregarUsuario, useCategorias, useEcopontos, useCriarDescarte, useEnviarFoto } from '@/api/queries';
import type { AiSource, Category, Disposal, PhotoUpload } from '@/api/types';
import { useUsuario } from '@/auth/AuthProvider';
import { IconeCategoria } from '@/components/CategoryIcon';
import {
  Botao, LinkBotao, EstadoErro, Campo, ErroFormulario, CampoTexto, CampoNumero, CabecalhoPagina, Selecao, Esqueleto, Interruptor, AreaTexto,
} from '@/components/ui';
import { SeletorCategoria, PainelOrientacao, PainelSugestao, type Sugestao } from '@/features/resident/disposal/MaterialStep';
import { EtapaFoto, type FaseAnalise } from '@/features/resident/disposal/PhotoStep';
import { IndicadorEtapas } from '@/features/resident/disposal/Stepper';
import { ErroFoto, prepararFoto, type FotoPreparada } from '@/features/resident/disposal/image';
import { useGeolocalizacao } from '@/hooks/useGeolocation';
import { useTituloDocumento } from '@/hooks/useDocumentTitle';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/cn';
import { formatarDistanciaKm, formatarKg, formatarNumero, formatarPontos } from '@/lib/format';

const ETAPAS = [
  { id: 'foto', label: 'Foto', hint: 'Câmera ou arquivo' },
  { id: 'material', label: 'Material', hint: 'IA sugere, você confirma' },
  { id: 'detalhes', label: 'Detalhes', hint: 'Peso, data e local' },
];
const DIA = 86_400_000;
const KG_RAPIDOS = [0.1, 0.5, 1, 2, 5];

const completarZeros = (n: number) => String(n).padStart(2, '0');
function paraEntradaLocal(d: Date) {
  return `${d.getFullYear()}-${completarZeros(d.getMonth() + 1)}-${completarZeros(d.getDate())}T${completarZeros(d.getHours())}:${completarZeros(d.getMinutes())}`;
}

// Data limitada aos últimos 7 dias e nunca no futuro, para não registrar descarte antigo só pelos pontos.
const esquema = z.object({
  categoryId: z.string({ required_error: 'Escolha a categoria do material' }).min(1, 'Escolha a categoria do material'),
  quantityKg: z.number({ required_error: 'Informe a quantidade', invalid_type_error: 'Informe a quantidade' }).min(0.01, 'O mínimo é 0,01 kg'),
  disposedAt: z.string().min(1, 'Informe quando foi o descarte').refine((v) => {
    const t = new Date(v).getTime();
    return Number.isFinite(t) && t <= Date.now() + 60_000 && t >= Date.now() - 7 * DIA;
  }, 'Use uma data dos últimos 7 dias (não pode ser no futuro)'),
  shareLocation: z.boolean(),
  collectionPointId: z.string().optional(),
  notes: z.string().max(500, 'Máximo de 500 caracteres').optional(),
});
type ValoresFormulario = z.infer<typeof esquema>;

export default function PaginaNovoDescarte() {
  const usuario = useUsuario();
  const consultaCategorias = useCategorias();
  const categorias = useMemo(() => consultaCategorias.data ?? [], [consultaCategorias.data]);
  const enviarFoto = useEnviarFoto();
  const criar = useCriarDescarte();
  const geo = useGeolocalizacao();
  const qc = useQueryClient();

  const [etapa, setEtapa] = useState(0);
  const [maximoAlcancado, setMaximoAlcancado] = useState(0);
  const [foto, setFoto] = useState<FotoPreparada | null>(null);
  const [fotoEnviada, setFotoEnviada] = useState<PhotoUpload | null>(null);
  const [fase, setFase] = useState<FaseAnalise>('idle');
  const [erroFoto, setErroFoto] = useState<string | null>(null);
  const [progressoModelo, setProgressoModelo] = useState(0);
  const [sugestao, setSugestao] = useState<Sugestao | null>(null);
  const [resultado, setResultado] = useState<Disposal | null>(null);
  // Uma chave por intenção de registro: re-tentativas reaproveitam a mesma.
  // Assim o servidor não cria o mesmo descarte duas vezes se a rede falhar e o morador reenviar.
  const [chaveIdempotencia, setChaveIdempotencia] = useState(() => novaChaveIdempotencia());
  const ultimoArquivo = useRef<File | null>(null);
  // Se o morador trocar de foto no meio da análise, o resultado da foto antiga é descartado.
  const idExecucao = useRef(0);
  const refTopo = useRef<HTMLDivElement>(null);

  const formulario = useForm<ValoresFormulario>({
    resolver: zodResolver(esquema),
    defaultValues: { categoryId: '', quantityKg: undefined, disposedAt: paraEntradaLocal(new Date()), shareLocation: false, collectionPointId: '', notes: '' },
    mode: 'onTouched',
  });
  const { control, register, watch, setValue, setError, clearErrors, formState: { errors, isSubmitting } } = formulario;
  const idCategoria = watch('categoryId');
  const quantidadeKg = watch('quantityKg');
  const compartilharLocal = watch('shareLocation');
  const idPontoColeta = watch('collectionPointId');
  const categoria = categorias.find((c) => c.id === idCategoria);
  const estimado = categoria && quantidadeKg ? Math.max(1, Math.round(quantidadeKg * categoria.pointsPerKg)) : 0;

  const localizado = compartilharLocal && geo.status === 'success';
  const pontos = useEcopontos(localizado
    ? { lat: geo.latitude!, lon: geo.longitude!, radiusKm: 15, category: categoria?.code }
    : { category: categoria?.code });

  // Libera o objectURL da pré-visualização.
  useEffect(() => () => { if (foto) URL.revokeObjectURL(foto.previewUrl); }, [foto]);

  const irPara = useCallback((i: number) => {
    setEtapa(i);
    setMaximoAlcancado((m) => Math.max(m, i));
    requestAnimationFrame(() => refTopo.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }, []);

  const aplicarSugestao = useCallback((s: Sugestao) => {
    setSugestao(s);
    const cat = categorias.find((c) => c.code === s.code);
    if (cat) { setValue('categoryId', cat.id, { shouldValidate: true }); }
  }, [categorias, setValue]);

  const analisar = useCallback(async (arquivo: File) => {
    // 1. Começa uma análise nova e limpa o resultado anterior.
    const id = ++idExecucao.current;
    ultimoArquivo.current = arquivo;
    setErroFoto(null);
    setSugestao(null);
    setFotoEnviada(null);
    setFase('preparing');
    let preparada: FotoPreparada;
    // 2. Reduz a foto e gera a miniatura no próprio navegador.
    try {
      preparada = await prepararFoto(arquivo);
    } catch (e) {
      if (id !== idExecucao.current) return;
      setFase('idle');
      setFoto(null);
      setErroFoto(e instanceof ErroFoto ? e.message : 'Não foi possível ler esta imagem.');
      return;
    }
    if (id !== idExecucao.current) return;
    setFoto(preparada);
    setFase('uploading');
    // 3. Envia a foto; o servidor avisa se ela parece repetida e pode rodar a IA dele.
    let envio: PhotoUpload;
    try {
      envio = await enviarFoto.mutateAsync(new File([preparada.blob], 'descarte.jpg', { type: 'image/jpeg' }));
    } catch (e) {
      if (id !== idExecucao.current) return;
      setFase('error');
      setErroFoto(mensagemDeErro(e));
      return;
    }
    if (id !== idExecucao.current) return;
    setFotoEnviada(envio);

    // 4. Se a IA do servidor respondeu, usa a sugestão dela (verified = confirmada, dá bônus).
    if (envio.ai.available && envio.ai.categoryCode) {
      aplicarSugestao({ code: envio.ai.categoryCode, confidence: envio.ai.confidence ?? 0.5, reasoning: envio.ai.reasoning, source: envio.ai.source ?? 'CLAUDE', verified: envio.ai.verified === true });
      setFase('done');
      irPara(1);
      return;
    }
    // IA do servidor indisponível → modelo local no navegador (lazy, offline).
    // 5. Carrega o MobileNet só agora e classifica a miniatura.
    try {
      const modulo = await import('@/features/resident/disposal/localClassifier');
      if (!modulo.modeloCarregado()) setFase('loading-model');
      const promessaPalpite = modulo.classificar(preparada.thumb, (p) => {
        setProgressoModelo(p);
        if (p >= 1 && id === idExecucao.current) setFase('classifying');
      });
      if (modulo.modeloCarregado()) setFase('classifying');
      const palpite = await promessaPalpite;
      if (id !== idExecucao.current) return;
      aplicarSugestao({ code: palpite.code, confidence: palpite.confidence, reasoning: palpite.reasoning, source: 'LOCAL', verified: false, labels: palpite.labels });
    } catch {
      if (id !== idExecucao.current) return;
      setSugestao(null); // segue com escolha manual
    }
    // 6. Com ou sem sugestão, vai para a etapa Material, onde o morador confirma ou corrige.
    setFase('done');
    irPara(1);
  }, [enviarFoto, aplicarSugestao, irPara]);

  const limparFoto = () => {
    idExecucao.current++;
    setFoto(null);
    setFotoEnviada(null);
    setSugestao(null);
    setFase('idle');
    setErroFoto(null);
    setEtapa(0);
  };

  const alternarLocalizacao = (ativo: boolean) => {
    setValue('shareLocation', ativo);
    if (ativo && geo.status !== 'success') geo.request();
    if (!ativo) setValue('collectionPointId', '');
  };

  const avancarDoMaterial = async () => {
    if (await formulario.trigger('categoryId')) irPara(2);
  };

  const aoEnviar = formulario.handleSubmit(async (v) => {
    // 1. Cada material tem um teto de kg por descarte, contra exageros.
    const cat = categorias.find((c) => c.id === v.categoryId);
    if (!cat) { setError('categoryId', { message: 'Escolha a categoria' }); irPara(1); return; }
    if (v.quantityKg > cat.maxKgPerDisposal) {
      setError('quantityKg', { message: `Máximo de ${formatarNumero(cat.maxKgPerDisposal, 2)} kg por descarte de ${cat.name}` });
      return;
    }
    // 2. Registra de onde veio o material: IA do servidor, IA local ou manual.
    const origem: AiSource = sugestao ? sugestao.source : 'MANUAL';
    try {
      // 3. Envia com a chave de idempotência.
      const d = await criar.mutateAsync({
        idempotencyKey: chaveIdempotencia,
        body: {
          categoryId: cat.id,
          quantityKg: Number(v.quantityKg.toFixed(3)),
          photoId: fotoEnviada?.id ?? null,
          latitude: localizado ? geo.latitude : null,
          longitude: localizado ? geo.longitude : null,
          collectionPointId: v.collectionPointId || null,
          disposedAt: new Date(v.disposedAt).toISOString(),
          aiSuggestedCode: sugestao?.code ?? null,
          aiConfidence: sugestao ? Number(sugestao.confidence.toFixed(3)) : null,
          aiSource: origem,
          notes: v.notes?.trim() || null,
        },
      });
      // 4. Mostra o resultado; se já foi aprovado na hora, atualiza o saldo.
      setResultado(d);
      if (d.status === 'APPROVED') recarregarUsuario(qc);
      requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    } catch (e) {
      // 5. Erros do servidor vão para o campo certo (caso especial: foto já usada).
      const tratado = aplicarErrosDoServidor(e, setError, { knownFields: ['categoryId', 'quantityKg', 'disposedAt', 'collectionPointId', 'notes'] });
      if (!tratado && e instanceof ErroApi && e.fieldErrors.some((f) => f.field === 'photoId')) {
        setError('root.server', { message: 'Esta foto já foi usada em outro descarte. Tire uma nova foto do resíduo.' });
      }
    }
  });

  // Outro descarte = outra chave de idempotência.
  const recomecar = () => {
    limparFoto();
    formulario.reset({ categoryId: '', quantityKg: undefined, disposedAt: paraEntradaLocal(new Date()), shareLocation: compartilharLocal, collectionPointId: '', notes: '' });
    setResultado(null);
    setMaximoAlcancado(0);
    setChaveIdempotencia(novaChaveIdempotencia());
  };

  if (resultado) return <TelaSucesso d={resultado} aoRegistrarOutro={recomecar} saldo={usuario.points} />;

  if (consultaCategorias.error) return (<><Cabecalho /><EstadoErro erro={consultaCategorias.error} aoTentarDeNovo={consultaCategorias.refetch} /></>);

  const agora = new Date();
  const dataMinima = paraEntradaLocal(new Date(agora.getTime() - 7 * DIA + 60_000));
  const dataMaxima = paraEntradaLocal(agora);
  const maisProximos = pontos.data?.filter((p) => !categoria || p.categories.includes(categoria.code)).slice(0, 8) ?? [];

  return (
    <>
      <Cabecalho />
      <div ref={refTopo} className="scroll-mt-24" />
      <div className="mb-8"><IndicadorEtapas etapas={ETAPAS} atual={etapa} maximoAlcancado={maximoAlcancado} aoSelecionar={irPara} /></div>

      <form onSubmit={aoEnviar} noValidate className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-12">
        <div className="min-w-0">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={etapa} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}>
              {etapa === 0 && (
                <EtapaFoto
                  foto={foto} fase={fase} progressoModelo={progressoModelo} error={erroFoto}
                  aoEscolherArquivo={analisar}
                  aoTentarDeNovo={() => ultimoArquivo.current && analisar(ultimoArquivo.current)}
                  aoTrocarFoto={limparFoto}
                  aoPular={() => { setSugestao(null); irPara(1); }}
                />
              )}

              {etapa === 1 && (
                <div className="space-y-8">
                  {fotoEnviada?.duplicateSuspected && <AvisoDuplicada aoTrocar={limparFoto} />}
                  {sugestao ? (
                    <PainelSugestao sugestao={sugestao} categoria={categorias.find((c) => c.code === sugestao.code)} />
                  ) : foto ? (
                    <p className="flex items-start gap-2 rounded-xl border border-line px-4 py-3 text-sm text-muted">
                      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
                      Não conseguimos identificar o material automaticamente. Escolha a categoria abaixo.
                    </p>
                  ) : null}
                  {consultaCategorias.isPending ? <Esqueleto className="h-64 rounded-2xl" /> : (
                    <SeletorCategoria
                      categorias={categorias}
                      value={idCategoria}
                      sugerida={sugestao?.code ?? null}
                      onChange={(id) => { setValue('categoryId', id, { shouldValidate: true }); clearErrors('quantityKg'); }}
                      error={errors.categoryId?.message}
                    />
                  )}
                  {sugestao && categoria && categoria.code !== sugestao.code && (
                    <p className="-mt-4 text-xs text-muted">Você corrigiu a sugestão para <span className="text-fg-soft">{categoria.name}</span>. A correção fica registrada para melhorar a IA.</p>
                  )}
                  {categoria && <PainelOrientacao categoria={categoria} />}
                  <NavegacaoEtapas aoVoltar={() => irPara(0)} aoAvancar={avancarDoMaterial} rotuloAvancar="Continuar" />
                </div>
              )}

              {etapa === 2 && (
                <div className="space-y-7">
                  {fotoEnviada?.duplicateSuspected && <AvisoDuplicada aoTrocar={limparFoto} />}
                  <ErroFormulario erro={errors.root?.server} />

                  <Campo label="Quantidade" required erro={errors.quantityKg}
                    dica={categoria ? `Máximo de ${formatarKg(categoria.maxKgPerDisposal)} por descarte de ${categoria.name.toLowerCase()}. Sem balança? Uma garrafa PET de 2 L pesa ≈ 0,05 kg; uma lata, ≈ 0,015 kg.` : 'Peso aproximado em quilos.'}>
                    {(a11y) => (
                      <div>
                        <Controller control={control} name="quantityKg" render={({ field }) => (
                          <CampoNumero {...field} {...a11y} value={field.value} unidade="kg" casasDecimais={2} min={0.01} max={categoria?.maxKgPerDisposal ?? 50} step={0.1} tamanhoCampo="lg" placeholder="0,00" invalido={!!errors.quantityKg} />
                        )} />
                        <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Valores rápidos">
                          {KG_RAPIDOS.filter((k) => !categoria || k <= categoria.maxKgPerDisposal).map((k) => (
                            <button key={k} type="button" onClick={() => setValue('quantityKg', k, { shouldValidate: true })}
                              className={cn('h-8 rounded-lg border px-2.5 font-mono text-xs tabular transition-colors', quantidadeKg === k ? 'border-fg-soft text-fg' : 'border-line text-muted hover:border-line-strong hover:text-fg')}>
                              {formatarNumero(k, 2)} kg
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </Campo>

                  <Campo label="Quando foi o descarte" required erro={errors.disposedAt} dica="Registre descartes de até 7 dias atrás.">
                    <CampoTexto type="datetime-local" min={dataMinima} max={dataMaxima} iconeEsquerda={Clock} {...register('disposedAt')} />
                  </Campo>

                  <div className="space-y-4 border-t border-line pt-6">
                    <Interruptor checked={compartilharLocal} onChange={alternarLocalizacao} label="Anexar minha localização"
                      description="Ajuda a validar o descarte e a sugerir o ecoponto mais próximo. Usada só neste registro." />
                    {compartilharLocal && (
                      <div className="pl-0 sm:pl-14" aria-live="polite">
                        {geo.status === 'loading' && <p className="flex items-center gap-2 text-sm text-muted"><Crosshair className="size-4 animate-pulse" aria-hidden /> Obtendo sua localização…</p>}
                        {geo.status === 'success' && (
                          <p className="flex items-center gap-2 font-mono text-xs text-muted tabular">
                            <LocateFixed className="size-4 text-success" aria-hidden />
                            {geo.latitude!.toFixed(5)}, {geo.longitude!.toFixed(5)} · precisão ± {formatarNumero(geo.precisao ?? 0)} m
                          </p>
                        )}
                        {(geo.status === 'error' || geo.status === 'unsupported') && (
                          <div className="flex flex-wrap items-center gap-3 text-sm text-warning">
                            <span className="flex items-start gap-2"><AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />{geo.erro}</span>
                            {geo.status === 'error' && <Botao size="sm" variant="secondary" onClick={geo.request}>Tentar de novo</Botao>}
                          </div>
                        )}
                      </div>
                    )}
                    <Campo label="Onde você descartou" opcional erro={errors.collectionPointId}
                      dica={localizado ? 'Ecopontos que aceitam este material, do mais perto ao mais longe.' : 'Ative a localização para ordenar por distância.'}>
                      <Selecao {...register('collectionPointId')}>
                        <option value="">Coleta seletiva de casa / outro local</option>
                        {maisProximos.map((p) => (
                          <option key={p.id} value={p.id}>{p.name}{p.distanceKm != null ? ` · ${formatarDistanciaKm(p.distanceKm)}` : ` · ${p.neighborhood}`}</option>
                        ))}
                      </Selecao>
                    </Campo>
                    {idPontoColeta && (() => {
                      const p = maisProximos.find((x) => x.id === idPontoColeta);
                      return p ? <p className="-mt-3 flex items-start gap-2 text-xs text-subtle"><MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden />{p.address} · {p.openingHours}</p> : null;
                    })()}
                  </div>

                  <Campo label="Observações" opcional erro={errors.notes}>
                    <AreaTexto rows={3} maxLength={500} placeholder="Ex.: garrafas lavadas e sem tampa" {...register('notes')} />
                  </Campo>

                  <div className="flex flex-col-reverse gap-3 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
                    <Botao variant="ghost" iconeEsquerda={ArrowLeft} onClick={() => irPara(1)}>Voltar</Botao>
                    <Botao type="submit" size="lg" iconeDireita={Send} carregando={isSubmitting} disabled={!categoria}>
                      Enviar descarte{estimado ? ` · ≈ ${formatarNumero(estimado)} pts` : ''}
                    </Botao>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <Resumo foto={foto} categoria={categoria} quantidadeKg={quantidadeKg} estimado={estimado} sugestao={sugestao} />
      </form>
    </>
  );
}

function Cabecalho() {
  return (
    <CabecalhoPagina
      sobretitulo="Registrar descarte"
      title="O que vai para a reciclagem hoje?"
      description="Foto, material e peso. Em menos de um minuto o registro vai para análise e os pontos entram quando for aprovado."
    />
  );
}

function NavegacaoEtapas({ aoVoltar, aoAvancar, rotuloAvancar }: { aoVoltar: () => void; aoAvancar: () => void; rotuloAvancar: string }) {
  return (
    <div className="flex flex-col-reverse gap-3 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
      <Botao variant="ghost" iconeEsquerda={ArrowLeft} onClick={aoVoltar}>Voltar</Botao>
      <Botao size="lg" iconeDireita={ArrowRight} onClick={aoAvancar}>{rotuloAvancar}</Botao>
    </div>
  );
}

function AvisoDuplicada({ aoTrocar }: { aoTrocar: () => void }) {
  return (
    <div role="alert" className="flex flex-col gap-3 rounded-xl border border-warning/30 bg-warning/[0.06] p-4 sm:flex-row sm:items-center">
      <AlertTriangle className="size-5 shrink-0 text-warning" aria-hidden />
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-medium text-warning">Foto parecida com outra já enviada</p>
        <p className="mt-0.5 text-fg-soft">Registros duplicados são recusados pela verificação antifraude e não geram pontos.</p>
      </div>
      <Botao size="sm" variant="secondary" onClick={aoTrocar}>Trocar foto</Botao>
    </div>
  );
}

function Resumo({ foto, categoria, quantidadeKg, estimado, sugestao }: {
  foto: FotoPreparada | null; categoria: Category | undefined; quantidadeKg: number | undefined; estimado: number; sugestao: Sugestao | null;
}) {
  return (
    <aside aria-label="Resumo do descarte" className="lg:sticky lg:top-[calc(var(--header-h)+24px)] lg:self-start">
      <div className="surface overflow-hidden rounded-2xl">
        {foto && <img src={foto.previewUrl} alt="" className="hidden aspect-[16/10] w-full object-cover lg:block" />}
        <div className="p-5">
          <p className="label-mono">Resumo</p>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted">Material</dt>
              <dd className="flex items-center gap-2 text-fg">
                {categoria ? <><IconeCategoria icon={categoria.icon} codigo={categoria.code} cor={categoria.color} variant="plain" size="sm" />{categoria.name}</> : <span className="text-subtle">—</span>}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted">Quantidade</dt>
              <dd className="font-mono text-fg tabular">{quantidadeKg ? formatarKg(quantidadeKg) : <span className="text-subtle">—</span>}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted">Identificação</dt>
              <dd className="text-fg-soft">{sugestao ? (sugestao.verified ? 'Confirmado pela IA (+10%)' : sugestao.source === 'LOCAL' ? 'Sugestão do navegador' : 'IA no servidor') : 'Manual'}</dd>
            </div>
          </dl>
          <div className="mt-5 border-t border-line pt-5">
            <p className="text-xs text-muted">Pontos estimados</p>
            <p className="mt-1 flex items-baseline gap-1.5">
              <span className="font-mono text-[34px] leading-none font-medium tracking-[-0.03em] text-fg tabular">{estimado ? `≈ ${formatarNumero(estimado)}` : '—'}</span>
              {estimado > 0 && <span className="text-sm text-muted">pts</span>}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-subtle">
              {categoria ? `${formatarNumero(categoria.pointsPerKg)} pts por kg de ${categoria.name.toLowerCase()}. ` : ''}
              Creditados uma única vez, quando o descarte for aprovado.
            </p>
            {categoria && quantidadeKg ? (
              <p className="mt-3 font-mono text-xs text-success tabular">≈ {formatarKg(quantidadeKg * categoria.co2FactorKg)} de CO₂ evitado</p>
            ) : null}
          </div>
        </div>
      </div>
    </aside>
  );
}

function TelaSucesso({ d, aoRegistrarOutro, saldo }: { d: Disposal; aoRegistrarOutro: () => void; saldo: number }) {
  const aprovado = d.status === 'APPROVED';
  useTituloDocumento(aprovado ? 'Descarte aprovado' : 'Descarte enviado');
  return (
    <div className="mx-auto max-w-xl py-6 text-center sm:py-12">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}>
        <CheckCircle2 className="mx-auto size-12 text-success" strokeWidth={1.4} aria-hidden />
        <p className="label-mono mt-6">{d.category.name} · {formatarKg(d.quantityKg)}</p>
        <h1 className="mt-3 text-[clamp(2rem,1.6rem+1.4vw,2.75rem)] leading-tight text-fg">
          {aprovado ? <>Aprovado na hora. <em>Obrigado!</em></> : <>Recebido. Agora é <em>com a gente.</em></>}
        </h1>
        <div className="mx-auto mt-8 grid max-w-md grid-cols-2 divide-x divide-line border-y border-line">
          <div className="py-5">
            <p className="text-xs text-muted">{aprovado ? 'Pontos creditados' : 'Pontos estimados'}</p>
            <p className="mt-1 font-mono text-3xl font-medium tracking-[-0.03em] text-fg tabular">{aprovado ? `+${formatarNumero(d.pointsAwarded)}` : `≈ ${formatarNumero(d.estimatedPoints)}`}</p>
          </div>
          <div className="py-5">
            <p className="text-xs text-muted">Status</p>
            <p className={cn('mt-2 inline-flex items-center gap-1.5 text-sm font-medium', aprovado ? 'text-success' : 'text-warning')}>
              {aprovado ? <Sparkles className="size-4" aria-hidden /> : <Clock className="size-4" aria-hidden />}
              {aprovado ? 'Aprovado' : 'Pendente de aprovação'}
            </p>
          </div>
        </div>
        <p className="mx-auto mt-6 max-w-[48ch] text-sm leading-relaxed text-muted">
          {aprovado
            ? `Baixo risco e foto válida: a verificação automática aprovou o registro. Seu novo saldo é de ${formatarPontos(saldo)}.`
            : 'Um agente confere a foto, a categoria e o peso — normalmente em até 24 horas. Os pontos entram no seu saldo uma única vez, assim que o descarte for aprovado. Você acompanha tudo em “Meus descartes”.'}
        </p>
        <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
          <Botao size="lg" onClick={aoRegistrarOutro} iconeEsquerda={ArrowRight}>Registrar outro</Botao>
          <LinkBotao to="/app/descartes" size="lg" variant="secondary">Ver meus descartes</LinkBotao>
        </div>
      </motion.div>
    </div>
  );
}
