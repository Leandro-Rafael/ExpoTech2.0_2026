// Planejamento de coletas (aba "Planejar") e lista de rotas criadas (aba "Rotas").
import { useEffect, useMemo, useState } from 'react';
import { Crosshair, Cpu, MapPinned, RotateCcw, Sparkles, User, Warehouse } from 'lucide-react';
import { mensagemDeErro } from '@/api/client';
import { useSolicitacoesColetaAdmin, useCategorias, useOtimizarRotas } from '@/api/queries';
import type { CollectionRequest, CollectionRequestStatus, CollectionSource, GeoPoint, RouteOptimization } from '@/api/types';
import { useTrocarAba } from '@/components/layout/TabbedPage';
import { Botao, EstadoVazio, EstadoErro, CampoNumero, CabecalhoPagina, Esqueleto, PilulaStatus, toast } from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatarKg, formatarRelativo } from '@/lib/format';
import { categoriaPadrao, statusSolicitacaoColeta } from '@/lib/labels';
import { CampoBusca, Segmentado } from '@/features/admin/ui';
import { MapaColetas } from '@/features/admin/routing/CollectionsMap';
import { ResultadoOtimizacao } from '@/features/admin/routing/OptimizationResult';
import { FormCriarRotas } from '@/features/admin/routing/CreateRoutesForm';
import { AbaRotas } from '@/features/admin/routing/RoutesTab';
import { CAPACIDADE_PADRAO_KG, CENTRAL_PADRAO, tomDaPrioridade } from '@/features/admin/routing/shared';

type FiltroStatus = CollectionRequestStatus | 'OPEN' | 'ALL';
type FiltroOrigem = CollectionSource | 'ALL';

const EM_ABERTO: CollectionRequestStatus[] = ['REQUESTED', 'SCHEDULED', 'IN_ROUTE'];

export default function PaginaColetas({ aba }: { aba: 'plan' | 'routes' }) {
  const irParaAba = useTrocarAba();
  const [status, setStatus] = useState<FiltroStatus>('REQUESTED');
  const [origem, setOrigem] = useState<FiltroOrigem>('ALL');
  const [busca, setBusca] = useState('');
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [destacada, setDestacada] = useState<string | null>(null);
  const [central, setCentral] = useState<GeoPoint>(CENTRAL_PADRAO);
  const [capacidade, setCapacidade] = useState<number | null>(CAPACIDADE_PADRAO_KG);
  const [escolhendoCentral, setEscolhendoCentral] = useState(false);
  const [resultado, setResultado] = useState<{ data: RouteOptimization; key: string; capacity: number } | null>(null);
  const [mostrarIngenua, setMostrarIngenua] = useState(true);
  const [emFoco, setEmFoco] = useState<number | null>(null);
  const [criadas, setCriadas] = useState<Set<string>>(new Set());

  // Busca todas e filtra no cliente (contagens por status sem várias requisições).
  const todas = useSolicitacoesColetaAdmin();
  const categorias = useCategorias();
  const otimizar = useOtimizarRotas();

  const corCategoria = (codigo: keyof typeof categoriaPadrao) => categorias.data?.find((c) => c.code === codigo)?.color ?? categoriaPadrao[codigo].color;

  const contagens = useMemo(() => {
    const c: Record<string, number> = { REQUESTED: 0, OPEN: 0, ALL: 0, COLLECTED: 0 };
    todas.data?.forEach((r) => { c.ALL++; c[r.status] = (c[r.status] ?? 0) + 1; if (EM_ABERTO.includes(r.status)) c.OPEN++; });
    return c;
  }, [todas.data]);

  // 1. Lista as solicitações (de moradores ou de lixeiras cheias), das mais urgentes para as menos.
  const linhas = useMemo(() => {
    const s = busca.trim().toLocaleLowerCase('pt-BR');
    return (todas.data ?? []).filter((r) =>
      (status === 'ALL' || (status === 'OPEN' ? EM_ABERTO.includes(r.status) : r.status === status))
      && (origem === 'ALL' || r.source === origem)
      && (!s || r.address.toLocaleLowerCase('pt-BR').includes(s) || r.requester?.name.toLocaleLowerCase('pt-BR').includes(s) || r.smartBin?.name.toLocaleLowerCase('pt-BR').includes(s)),
    ).sort((a, b) => b.priority - a.priority || a.createdAt.localeCompare(b.createdAt));
  }, [todas.data, status, origem, busca]);

  // Seleção só de solicitações em aberto ("Solicitada"); limpa ids que sumiram.
  useEffect(() => {
    if (!todas.data) return;
    const validas = new Set(todas.data.filter((r) => r.status === 'REQUESTED').map((r) => r.id));
    setSelecionadas((s) => { const n = new Set([...s].filter((id) => validas.has(id))); return n.size === s.size ? s : n; });
  }, [todas.data]);

  // 2. O admin marca quais vai atender. Se mudar a seleção, a central ou a capacidade depois de otimizar,
  //    o resultado fica "desatualizado" (stale) e precisa otimizar de novo.
  const solicitacoesSelecionadas = useMemo(() => (todas.data ?? []).filter((r) => selecionadas.has(r.id)), [todas.data, selecionadas]);
  const kgSelecionados = solicitacoesSelecionadas.reduce((s, r) => s + r.estimatedKg, 0);
  const chaveSelecao = `${[...selecionadas].sort().join(',')}|${central.latitude},${central.longitude}|${capacidade}`;
  const desatualizado = !!resultado && resultado.key !== chaveSelecao;
  const selecionaveis = linhas.filter((r) => r.status === 'REQUESTED');
  const todasVisiveisSelecionadas = selecionaveis.length > 0 && selecionaveis.every((r) => selecionadas.has(r.id));

  const alternar = (r: CollectionRequest) => {
    if (r.status !== 'REQUESTED') return;
    setSelecionadas((s) => { const n = new Set(s); if (n.has(r.id)) n.delete(r.id); else n.add(r.id); return n; });
  };
  const alternarTodasVisiveis = () => setSelecionadas((s) => {
    const n = new Set(s);
    if (todasVisiveisSelecionadas) selecionaveis.forEach((r) => n.delete(r.id)); else selecionaveis.forEach((r) => n.add(r.id));
    return n;
  });

  // 3. Otimizar: o servidor divide as paradas em viagens que cabem no caminhão e ordena cada uma
  //    para percorrer a menor distância, saindo e voltando da central.
  const capacidadeValida = capacidade != null && capacidade >= 10 && capacidade <= 50_000;
  const otimizarRotas = () => {
    if (!selecionadas.size) { toast.error('Selecione ao menos uma solicitação.'); return; }
    if (!capacidadeValida) { toast.error('Informe a capacidade do veículo entre 10 e 50.000 kg.'); return; }
    const chave = chaveSelecao;
    otimizar.mutate({ requestIds: [...selecionadas], depot: central, vehicleCapacityKg: capacidade }, {
      onSuccess: (data) => { setResultado({ data, key: chave, capacity: capacidade! }); setEmFoco(null); },
      onError: (e) => toast.error(mensagemDeErro(e)),
    });
  };

  const limpar = () => { setResultado(null); setSelecionadas(new Set()); setEmFoco(null); };
  const visiveisNoMapa = resultado ? (todas.data ?? []).filter((r) => selecionadas.has(r.id) || linhas.includes(r)) : linhas;
  const otimizado = !!resultado && !desatualizado;

  return (
    <>
      <CabecalhoPagina
        sobretitulo="Administração"
        title="Coletas e rotas"
        description="Escolha as solicitações em aberto, otimize o trajeto dos caminhões e transforme o plano em rotas para os coletores."
      />

      {aba === 'plan' && (
        <>
          <div className="grid gap-4 lg:grid-cols-[400px_minmax(0,1fr)]">
            {/* Lista */}
            <section aria-label="Solicitações de coleta" className="surface flex min-w-0 flex-col overflow-hidden rounded-2xl lg:h-[680px]">
              <div className="space-y-2.5 border-b border-line p-3">
                <Segmentado<FiltroStatus> label="Status" value={status} onChange={setStatus} className="w-full"
                  opcoes={[
                    { value: 'REQUESTED', label: 'Solicitadas', contagem: contagens.REQUESTED },
                    { value: 'OPEN', label: 'Em aberto', contagem: contagens.OPEN },
                    { value: 'COLLECTED', label: 'Coletadas', contagem: contagens.COLLECTED },
                    { value: 'ALL', label: 'Todas' },
                  ]} />
                <div className="flex gap-2">
                  <Segmentado<FiltroOrigem> label="Origem" value={origem} onChange={setOrigem}
                    opcoes={[{ value: 'ALL', label: 'Todas' }, { value: 'USER', label: 'Morador' }, { value: 'SMART_BIN', label: 'Lixeira' }]} />
                  <CampoBusca value={busca} onChange={setBusca} placeholder="Endereço" className="min-w-0 flex-1" />
                </div>
              </div>
              <div className="flex h-10 items-center justify-between border-b border-line px-3 text-xs">
                <label className={cn('inline-flex items-center gap-2 text-muted', !selecionaveis.length && 'opacity-50')}>
                  <input type="checkbox" checked={todasVisiveisSelecionadas} onChange={alternarTodasVisiveis} disabled={!selecionaveis.length}
                    className="size-4 cursor-pointer accent-[#ecefea]" aria-label="Selecionar todas as solicitações visíveis" />
                  Selecionar visíveis
                </label>
                <span className="font-mono text-subtle tabular" title="Ordenadas por prioridade">{linhas.length} · por prioridade</span>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto max-lg:max-h-[420px]" data-lenis-prevent>
                {todas.error && !todas.data ? <EstadoErro erro={todas.error} aoTentarDeNovo={todas.refetch} compacto />
                  : todas.isPending ? (
                    <div className="divide-y divide-line" role="status" aria-label="Carregando">
                      {Array.from({ length: 8 }, (_, i) => <div key={i} className="flex gap-3 px-3 py-3"><Esqueleto className="size-4" /><div className="flex-1 space-y-2"><Esqueleto className="h-3.5 w-2/3" /><Esqueleto className="h-3 w-1/3" /></div></div>)}
                    </div>
                  ) : !linhas.length ? (
                    <EstadoVazio compacto icon={MapPinned} title="Nenhuma solicitação" description={status === 'REQUESTED' ? 'Não há coletas aguardando roteirização.' : 'Ajuste os filtros.'} />
                  ) : (
                    <ul className="divide-y divide-line/70">
                      {linhas.map((r) => (
                        <LinhaSolicitacao key={r.id} r={r} marcada={selecionadas.has(r.id)} aoAlternar={() => alternar(r)}
                          aoPassarMouse={(h) => setDestacada(h ? r.id : null)} corCategoria={corCategoria} />
                      ))}
                    </ul>
                  )}
              </div>

              {/* Parâmetros */}
              <div className="space-y-3 border-t border-line bg-bg-deep/30 p-3">
                <div className="flex items-end gap-2">
                  <div className="min-w-0 flex-1">
                    <label htmlFor="cap" className="mb-1 block text-xs text-muted">Capacidade do veículo</label>
                    <CampoNumero id="cap" value={capacidade} onChange={setCapacidade} casasDecimais={0} min={10} max={50_000} step={100} unidade="kg" tamanhoCampo="sm" invalido={!capacidadeValida} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="mb-1 text-xs text-muted">Central (partida)</p>
                    <Botao size="sm" variant={escolhendoCentral ? 'outline' : 'secondary'} iconeEsquerda={escolhendoCentral ? Crosshair : Warehouse} larguraTotal
                      aria-pressed={escolhendoCentral} onClick={() => setEscolhendoCentral((p) => !p)}>
                      {escolhendoCentral ? 'Clique no mapa…' : 'Definir no mapa'}
                    </Botao>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[13px] text-muted">
                    <span className="font-mono text-fg tabular">{selecionadas.size}</span> selecionadas · <span className="font-mono text-fg-soft tabular">{formatarKg(kgSelecionados)}</span>
                  </p>
                  <div className="flex items-center gap-1">
                    {(selecionadas.size > 0 || resultado) && <Botao size="sm" variant="ghost" iconeEsquerda={RotateCcw} onClick={limpar}>Limpar</Botao>}
                    <Botao size="sm" variant={otimizado ? 'secondary' : 'primary'} iconeEsquerda={Sparkles} onClick={otimizarRotas} carregando={otimizar.isPending} disabled={!selecionadas.size}>
                      Otimizar rotas
                    </Botao>
                  </div>
                </div>
              </div>
            </section>

            {/* Mapa */}
            <div className="relative min-w-0">
              <MapaColetas
                className="h-[420px] rounded-2xl border border-line sm:h-[520px] lg:h-[680px]"
                solicitacoes={visiveisNoMapa}
                selecionadas={selecionadas}
                destacada={destacada}
                central={central}
                capacidadeKg={resultado?.capacity ?? capacidade ?? CAPACIDADE_PADRAO_KG}
                otimizacao={resultado && !desatualizado ? resultado.data : null}
                mostrarIngenua={mostrarIngenua}
                rotaEmFoco={emFoco}
                escolhendoCentral={escolhendoCentral}
                aoAlternar={alternar}
                aoEscolherCentral={(p) => { setCentral({ latitude: Number(p.latitude.toFixed(6)), longitude: Number(p.longitude.toFixed(6)) }); setEscolhendoCentral(false); toast.success('Central definida.'); }}
              />
              <LegendaMapa otimizado={otimizado} escolhendo={escolhendoCentral} />
            </div>
          </div>

          {/* 4. Resultado (comparação com a ordem de chegada) e formulário que cria as rotas para os coletores. */}
          {resultado && (
            <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
              <ResultadoOtimizacao resultado={resultado.data} capacidadeKg={resultado.capacity} mostrarIngenua={mostrarIngenua} aoMostrarIngenua={setMostrarIngenua}
                emFoco={emFoco} aoFocar={setEmFoco} desatualizado={desatualizado} />
              <FormCriarRotas
                requestIds={[...selecionadas]}
                depot={resultado.data.depot}
                capacidadeKg={resultado.capacity}
                viagens={resultado.data.routes.length}
                disabled={desatualizado}
                aoCriar={(rs) => { setCriadas(new Set(rs.map((r) => r.id))); limpar(); irParaAba('rotas'); }}
              />
            </div>
          )}
        </>
      )}

      {aba === 'routes' && <AbaRotas destaque={criadas} />}
    </>
  );
}

function LinhaSolicitacao({ r, marcada, aoAlternar, aoPassarMouse, corCategoria }: {
  r: CollectionRequest; marcada: boolean; aoAlternar: () => void; aoPassarMouse: (h: boolean) => void; corCategoria: (c: keyof typeof categoriaPadrao) => string;
}) {
  const selecionavel = r.status === 'REQUESTED';
  const tom = tomDaPrioridade(r.priority);
  const id = `req-${r.id}`;
  return (
    <li onMouseEnter={() => aoPassarMouse(true)} onMouseLeave={() => aoPassarMouse(false)}
      className={cn('relative flex items-start gap-3 px-3 py-3 transition-colors', marcada && 'bg-white/[0.04]', selecionavel && 'hover:bg-white/[0.025]')}>
      <input id={id} type="checkbox" checked={marcada} onChange={aoAlternar} disabled={!selecionavel}
        onFocus={() => aoPassarMouse(true)} onBlur={() => aoPassarMouse(false)}
        className="mt-0.5 size-4 shrink-0 cursor-pointer accent-[#ecefea] disabled:cursor-not-allowed disabled:opacity-30" />
      <label htmlFor={id} className={cn('min-w-0 flex-1', selecionavel ? 'cursor-pointer' : 'cursor-default')}>
        <span className="flex items-start justify-between gap-2">
          <span className="truncate text-[13.5px] font-medium text-fg">{r.address}</span>
          <span title="Prioridade (0–100)" className={cn('shrink-0 font-mono text-[12.5px] tabular', tom === 'danger' ? 'text-danger' : tom === 'warning' ? 'text-warning' : 'text-subtle')}>
            P{r.priority}
          </span>
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted">
          <span className="inline-flex items-center gap-1">
            {r.source === 'SMART_BIN' ? <Cpu className="size-3" aria-hidden /> : <User className="size-3" aria-hidden />}
            {r.source === 'SMART_BIN' ? r.smartBin?.name ?? 'Lixeira' : r.requester?.name ?? 'Morador'}
          </span>
          <span className="font-mono tabular">{formatarKg(r.estimatedKg)}</span>
          <span className="inline-flex items-center gap-1" aria-label={`Materiais: ${r.categoryCodes.map((c) => categoriaPadrao[c].name).join(', ')}`}>
            {r.categoryCodes.map((c) => <span key={c} className="size-1.5 rounded-full" style={{ backgroundColor: corCategoria(c) }} title={categoriaPadrao[c].name} />)}
          </span>
          <span>{formatarRelativo(r.createdAt)}</span>
          {r.status !== 'REQUESTED' && <PilulaStatus mapa={statusSolicitacaoColeta} value={r.status} className="h-5 px-2 text-[11px]" />}
        </span>
      </label>
    </li>
  );
}

function LegendaMapa({ otimizado, escolhendo }: { otimizado: boolean; escolhendo: boolean }) {
  return (
    <div className="pointer-events-none absolute top-3 left-3 z-[500] max-w-[calc(100%-24px)] rounded-xl border border-line-strong bg-[#0a0e0c]/85 px-3 py-2 text-[11.5px] text-muted">
      {escolhendo ? (
        <span className="flex items-center gap-2 text-fg-soft"><Crosshair className="size-3.5" aria-hidden /> Clique no mapa para posicionar a central</span>
      ) : otimizado ? (
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-brand-300" />Otimizada</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-0 w-4 border-t-2 border-dashed border-fg-soft/60" />Ordem de chegada</span>
          <span className="inline-flex items-center gap-1.5"><Warehouse className="size-3" aria-hidden />Central</span>
        </span>
      ) : (
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-danger" />Urgente</span>
          <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-warning" />Média</span>
          <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-muted" />Normal</span>
          <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full border border-muted" />Lixeira</span>
          <span className="text-subtle">· clique para selecionar</span>
        </span>
      )}
    </div>
  );
}
