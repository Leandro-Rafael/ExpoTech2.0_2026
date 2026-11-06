// Tela do coletor: escolhe a rota do dia e segue as paradas na ordem que a otimização definiu.
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { FormNumber } from '@/features/admin/formControls';
import { Check, CheckCircle2, Clock, Crosshair, Navigation, Play, Truck } from 'lucide-react';
import { aplicarErrosDoServidor } from '@/api/forms';
import { mensagemDeErro } from '@/api/client';
import { useRotasColetor, useConcluirParada, useIniciarRota } from '@/api/queries';
import type { Route, RouteStop } from '@/api/types';
import { Botao, Gaveta, classesBotao, EstadoVazio, EstadoErro, Campo, ErroFormulario, CabecalhoPagina, BarraProgresso, Esqueleto, PilulaStatus, toast } from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatarData, formatarDataCurta, formatarDistanciaKm, formatarKg, formatarMinutos, formatarNumero, dataHojeISO } from '@/lib/format';
import { statusRota } from '@/lib/labels';
import { useGeolocalizacao } from '@/hooks/useGeolocation';
import { MapaRota } from '@/features/admin/routing/RouteMap';
import { linkGoogleMaps } from '@/features/admin/routing/shared';

const ordenarParadas = (r: Route) => [...r.stops].sort((a, b) => a.sequence - b.sequence);

// 1. Abre direto na rota em andamento; se não houver, na próxima planejada.
function escolherPadrao(rotas: Route[]): string | null {
  return (rotas.find((r) => r.status === 'IN_PROGRESS') ?? rotas.find((r) => r.status === 'PLANNED') ?? rotas[0])?.id ?? null;
}

export default function PaginaRotasColetor() {
  const q = useRotasColetor();
  const [idAtivo, setIdAtivo] = useState<string | null>(null);
  const rotas = q.data ?? [];
  const rota = rotas.find((r) => r.id === idAtivo) ?? rotas.find((r) => r.id === escolherPadrao(rotas)) ?? null;

  return (
    <>
      <CabecalhoPagina sobretitulo="Coletor" title="Minhas rotas" description="Siga as paradas na ordem otimizada e registre o peso coletado em cada endereço." />
      {q.error && !q.data ? <EstadoErro erro={q.error} aoTentarDeNovo={q.refetch} />
        : q.isPending ? (
          <div className="space-y-4" role="status" aria-label="Carregando rotas">
            <div className="flex gap-2">{Array.from({ length: 3 }, (_, i) => <Esqueleto key={i} className="h-20 w-56 rounded-xl" />)}</div>
            <Esqueleto className="h-[44vh] rounded-2xl" />
          </div>
        ) : !rotas.length ? (
          <div className="surface rounded-2xl"><EstadoVazio icon={Truck} title="Nenhuma rota atribuída" description="Quando a administração criar uma rota para você, ela aparece aqui com o mapa e as paradas." /></div>
        ) : (
          <>
            <SeletorRota rotas={rotas} idAtivo={rota?.id ?? null} aoEscolher={setIdAtivo} />
            {rota && <VisaoRota key={rota.id} rota={rota} />}
          </>
        )}
    </>
  );
}

function SeletorRota({ rotas, idAtivo, aoEscolher }: { rotas: Route[]; idAtivo: string | null; aoEscolher: (id: string) => void }) {
  return (
    <div role="tablist" aria-label="Rotas" className="-mx-4 mb-5 flex snap-x gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0">
      {rotas.map((r) => {
        const concluidas = r.stops.filter((s) => s.status === 'DONE').length;
        const ativa = r.id === idAtivo;
        const hoje = r.plannedDate === dataHojeISO();
        return (
          <button key={r.id} type="button" role="tab" aria-selected={ativa} onClick={() => aoEscolher(r.id)}
            className={cn('w-60 shrink-0 snap-start rounded-xl border p-3 text-left transition-colors',
              ativa ? 'border-line-strong bg-surface-2' : 'border-line bg-surface/60 hover:border-line-strong', r.status === 'DONE' && !ativa && 'opacity-60')}>
            <span className="flex items-center justify-between gap-2">
              <span className="font-mono text-[11px] text-subtle uppercase tabular">{hoje ? 'Hoje' : formatarDataCurta(r.plannedDate)}</span>
              <PilulaStatus mapa={statusRota} value={r.status} pulsar={r.status === 'IN_PROGRESS'} className="h-5 px-2 text-[11px]" />
            </span>
            <span className="mt-1.5 block truncate text-[14px] font-medium text-fg">{r.name}</span>
            <span className="mt-2 flex items-center gap-2">
              <BarraProgresso value={concluidas / Math.max(1, r.stops.length)} size="xs" rotuloValor={null} />
              <span className="shrink-0 font-mono text-[11px] text-muted tabular">{concluidas}/{r.stops.length}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function VisaoRota({ rota }: { rota: Route }) {
  const iniciar = useIniciarRota();
  const geo = useGeolocalizacao();
  const [concluindo, setConcluindo] = useState<RouteStop | null>(null);
  const [paradaEmFoco, setParadaEmFoco] = useState<string | null>(null);
  const paradas = useMemo(() => ordenarParadas(rota), [rota]);
  // 2. A próxima parada é a primeira pendente na sequência otimizada.
  const proxima = paradas.find((s) => s.status === 'PENDING') ?? null;
  const concluidas = paradas.filter((s) => s.status === 'DONE');
  const kgConcluidos = concluidas.reduce((s, x) => s + x.estimatedKg, 0);
  const progresso = concluidas.length / Math.max(1, paradas.length);
  const emAndamento = rota.status === 'IN_PROGRESS';
  const posicao = geo.latitude != null && geo.longitude != null ? [geo.latitude, geo.longitude] as [number, number] : null;

  // Pede a localização só quando a rota está em andamento (permissão sob demanda).
  const { status: statusGeo, request: pedirLocalizacao } = geo;
  useEffect(() => { if (emAndamento && statusGeo === 'idle') pedirLocalizacao(); }, [emAndamento, statusGeo, pedirLocalizacao]);

  // 3. "Iniciar rota" muda o status para em andamento e liga o GPS para mostrar o coletor no mapa.
  const aoIniciar = () => iniciar.mutate(rota.id, {
    onSuccess: () => { toast.success('Rota iniciada. Boa coleta!'); geo.request(); },
    onError: (e) => toast.error(mensagemDeErro(e)),
  });

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] [&>*]:min-w-0">
      <div className="space-y-4 lg:order-2">
        {/* Resumo */}
        <section aria-label="Resumo da rota" className="surface rounded-2xl p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="font-sans text-lg font-semibold tracking-tight text-fg">{rota.name}</h2>
              <p className="mt-0.5 text-[13px] text-muted">{formatarData(rota.plannedDate)}</p>
            </div>
            <PilulaStatus mapa={statusRota} value={rota.status} pulsar={emAndamento} />
          </div>
          <div className="mt-4">
            <BarraProgresso value={progresso} label={`${concluidas.length} de ${paradas.length} paradas`} rotuloValor={formatarKg(kgConcluidos) + ' coletados'} size="sm" />
          </div>
          <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-line pt-3.5">
            <div><dt className="text-[11px] tracking-[0.06em] text-subtle uppercase">Distância</dt><dd className="mt-0.5 font-mono text-[14px] text-fg tabular">{formatarDistanciaKm(rota.totalDistanceKm)}</dd></div>
            <div><dt className="text-[11px] tracking-[0.06em] text-subtle uppercase">Tempo</dt><dd className="mt-0.5 font-mono text-[14px] text-fg tabular">{formatarMinutos(rota.estimatedMinutes)}</dd></div>
            <div><dt className="text-[11px] tracking-[0.06em] text-subtle uppercase">Carga</dt><dd className="mt-0.5 font-mono text-[14px] text-fg tabular">{formatarKg(rota.loadKg)}</dd></div>
          </dl>
          {rota.status === 'PLANNED' && (
            <Botao size="lg" larguraTotal iconeEsquerda={Play} className="mt-4" carregando={iniciar.isPending} onClick={aoIniciar}>Iniciar rota</Botao>
          )}
          {rota.status === 'DONE' && (
            <p className="mt-4 flex items-center gap-2 text-[13.5px] text-success"><CheckCircle2 className="size-4" aria-hidden /> Rota concluída. Obrigado!</p>
          )}
        </section>

        {/* Próxima parada */}
        {emAndamento && proxima && (
          <section aria-label="Próxima parada" className="rounded-2xl border border-brand-300/30 bg-brand-500/[0.06] p-4 sm:p-5">
            <p className="label-mono text-brand-300">Próxima parada · {proxima.sequence} de {paradas.length}</p>
            <p className="mt-2 text-[16px] leading-snug font-medium text-fg">{proxima.address}</p>
            <p className="mt-1 text-[13px] text-muted"><span className="font-mono tabular">{formatarKg(proxima.estimatedKg)}</span> estimados</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <a href={linkGoogleMaps(proxima)} target="_blank" rel="noopener noreferrer"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-line-strong text-[15px] font-medium text-fg hover:bg-white/[0.04]">
                <Navigation className="size-[18px]" aria-hidden /> Navegar
              </a>
              <Botao size="lg" iconeEsquerda={Check} onClick={() => setConcluindo(proxima)}>Concluir</Botao>
            </div>
          </section>
        )}
      </div>

      {/* Mapa */}
      <div className="relative lg:order-1">
        <MapaRota rota={rota} posicao={posicao} idParadaAtiva={paradaEmFoco ?? proxima?.id} aoClicarParada={setParadaEmFoco}
          className="h-[46vh] min-h-[300px] rounded-2xl border border-line lg:sticky lg:top-[calc(var(--header-h)+16px)] lg:h-[620px]" />
        {emAndamento && geo.status !== 'success' && (
          <button type="button" onClick={geo.request}
            className="absolute top-3 right-3 z-[500] inline-flex h-9 items-center gap-1.5 rounded-lg border border-line-strong bg-[#0a0e0c]/90 px-3 text-[12.5px] text-fg-soft">
            <Crosshair className="size-4" aria-hidden /> {geo.status === 'loading' ? 'Localizando…' : 'Minha posição'}
          </button>
        )}
      </div>

      {/* Paradas */}
      <section aria-labelledby="stops-title" className="lg:order-3 lg:col-span-2">
        <h3 id="stops-title" className="label-mono mb-2.5">Paradas</h3>
        <ol className="surface divide-y divide-line overflow-hidden rounded-2xl">
          {paradas.map((s) => {
            const concluida = s.status === 'DONE';
            const ehProxima = emAndamento && s.id === proxima?.id;
            return (
              <li key={s.id} className={cn('flex items-center gap-3 px-4 py-3', ehProxima && 'bg-white/[0.03]')}
                onMouseEnter={() => setParadaEmFoco(s.id)} onMouseLeave={() => setParadaEmFoco(null)}>
                <span className={cn('inline-flex size-8 shrink-0 items-center justify-center rounded-full border font-mono text-[12px] font-semibold tabular',
                  concluida ? 'border-line text-subtle' : ehProxima ? 'border-transparent bg-brand-300 text-bg' : 'border-brand-300/50 text-brand-300')}>
                  {concluida ? <Check className="size-4" aria-label="Concluída" /> : s.sequence}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={cn('truncate text-[14px]', concluida ? 'text-muted' : 'text-fg')}>{s.address}</p>
                  <p className="mt-0.5 flex items-center gap-2 text-xs text-muted">
                    <span className="font-mono tabular">{formatarKg(s.estimatedKg)}</span>
                    {concluida && s.completedAt && <span className="inline-flex items-center gap-1"><Clock className="size-3" aria-hidden />{new Date(s.completedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>}
                  </p>
                </div>
                {!concluida && (
                  <div className="flex shrink-0 items-center gap-1">
                    <a href={linkGoogleMaps(s)} target="_blank" rel="noopener noreferrer" aria-label={`Navegar até ${s.address}`}
                      className={classesBotao({ variant: 'ghost', size: 'sm' })}>
                      <Navigation aria-hidden /><span className="max-sm:hidden">Navegar</span>
                    </a>
                    {emAndamento && !ehProxima && (
                      <Botao variant="secondary" size="sm" onClick={() => setConcluindo(s)} aria-label={`Concluir parada ${s.sequence}`}>Concluir</Botao>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </section>

      <GavetaConcluirParada rota={rota} parada={concluindo} onClose={() => setConcluindo(null)} />
    </div>
  );
}

const esquema = z.object({
  collectedKg: z.number({ invalid_type_error: 'Informe o peso coletado', required_error: 'Informe o peso coletado' }).min(0, 'Não pode ser negativo').max(5000, 'Máximo de 5.000 kg'),
});
type Valores = z.infer<typeof esquema>;

// 4. Em cada endereço o coletor informa o peso coletado; ao concluir a última parada, o servidor finaliza a rota.
function GavetaConcluirParada({ rota, parada, onClose }: { rota: Route; parada: RouteStop | null; onClose: () => void }) {
  const concluir = useConcluirParada();
  const formulario = useForm<Valores>({ resolver: zodResolver(esquema), defaultValues: { collectedKg: undefined } });
  useEffect(() => { if (parada) formulario.reset({ collectedKg: parada.estimatedKg }); }, [parada, formulario]);
  const { errors: erros, isSubmitting: enviando } = formulario.formState;
  const restantes = rota.stops.filter((s) => s.status === 'PENDING').length;

  return (
    <Gaveta open={!!parada} onClose={onClose} lado="bottom" title={parada ? `Concluir parada ${parada.sequence}` : undefined} description={parada?.address}
      className="sm:mx-auto sm:max-w-lg sm:rounded-3xl sm:border sm:bottom-4">
      <form noValidate className="space-y-4 pt-2" onSubmit={formulario.handleSubmit(async (v) => {
        try {
          const r = await concluir.mutateAsync({ routeId: rota.id, stopId: parada!.id, collectedKg: v.collectedKg });
          toast.success(r.status === 'DONE' ? 'Última parada concluída. Rota finalizada!' : `Parada concluída · ${formatarNumero(v.collectedKg, 2)} kg`);
          onClose();
        } catch (e) { aplicarErrosDoServidor(e, formulario.setError); }
      })}>
        <ErroFormulario erro={erros.root?.server} />
        <Campo label="Peso coletado" required erro={erros.collectedKg} dica={parada ? `Estimado: ${formatarKg(parada.estimatedKg)}` : undefined}>
          <FormNumber control={formulario.control} name="collectedKg" unidade="kg" casasDecimais={2} min={0} max={5000} step={0.5} comBotoes tamanhoCampo="lg" data-autofocus />
        </Campo>
        <div className="grid grid-cols-2 gap-2 pb-1">
          <Botao variant="ghost" size="lg" onClick={onClose}>Cancelar</Botao>
          <Botao type="submit" size="lg" iconeEsquerda={Check} carregando={enviando}>{restantes <= 1 ? 'Finalizar rota' : 'Concluir'}</Botao>
        </div>
      </form>
    </Gaveta>
  );
}
