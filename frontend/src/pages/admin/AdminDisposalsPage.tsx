// Moderação de descartes: fila à esquerda, revisão do item à direita (ou numa gaveta no celular).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, BadgeCheck, ImageOff, Inbox, Sparkles } from 'lucide-react';
import { mensagemDeErro } from '@/api/client';
import { qk, useDescartesAdmin, useVisaoGeralAdmin, useAprovarDescarte, useCategorias, useRecusarDescarte } from '@/api/queries';
import type { FiltroDescartesAdmin } from '@/api/admin';
import type { Disposal, DisposalStatus, Page } from '@/api/types';
import { Gaveta, EstadoVazio, EstadoErro, CabecalhoPagina, Paginacao, Esqueleto, PilulaStatus, Interruptor, toast } from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatarKg, formatarNumero, formatarRelativo } from '@/lib/format';
import { statusDescarte } from '@/lib/labels';
import { useEhDesktop } from '@/hooks/useMediaQuery';
import { Tecla, CampoBusca, Segmentado } from '@/features/admin/ui';
import { RevisaoDescarte, PontuacaoFraude, divergeDaIa, type CorrecaoAprovacao } from '@/features/admin/moderation/DisposalReview';
import { DialogoRecusa } from '@/features/admin/moderation/RejectDialog';

type FiltroStatus = DisposalStatus | 'ALL';
const TAMANHO_PAGINA = 20;

function estaDigitando(elemento: EventTarget | null) {
  const t = elemento as HTMLElement | null;
  if (!t) return false;
  return t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName);
}

export default function PaginaDescartes() {
  const qc = useQueryClient();
  const desktop = useEhDesktop();
  const [status, setStatus] = useState<FiltroStatus>('PENDING');
  const [soSuspeitos, setSoSuspeitos] = useState(false);
  const [pagina, setPagina] = useState(0);
  const [busca, setBusca] = useState('');
  const [idSelecionado, setIdSelecionado] = useState<string | null>(null);
  const [gavetaAberta, setGavetaAberta] = useState(false);
  const [recusando, setRecusando] = useState<Disposal | null>(null);
  const funcaoAprovar = useRef<(() => void) | null>(null);

  // 1. Busca a fila no servidor (por padrão, só os pendentes; "Só suspeitos" filtra os sinalizados pelo antifraude).
  const parametros: FiltroDescartesAdmin = useMemo(
    () => ({ status: status === 'ALL' ? undefined : status, flagged: soSuspeitos || undefined, page: pagina, size: TAMANHO_PAGINA }),
    [status, soSuspeitos, pagina],
  );
  const q = useDescartesAdmin(parametros);
  const resumo = useVisaoGeralAdmin();
  const categorias = useCategorias({ all: true });
  const aprovar = useAprovarDescarte();
  const recusar = useRecusarDescarte();

  const linhas = useMemo(() => {
    const lista = q.data?.content ?? [];
    const s = busca.trim().toLocaleLowerCase('pt-BR');
    if (!s) return lista;
    return lista.filter((d) => [d.user?.name, d.user?.email, d.category.name].some((x) => x?.toLocaleLowerCase('pt-BR').includes(s)));
  }, [q.data, busca]);

  // 2. O admin escolhe um item, com o mouse ou pelos atalhos J/K.
  // Seleção: no desktop sempre há um item selecionado (o primeiro da fila).
  const selecionado = linhas.find((d) => d.id === idSelecionado) ?? (desktop ? linhas[0] : undefined) ?? null;
  const indiceSelecionado = selecionado ? linhas.findIndex((d) => d.id === selecionado.id) : -1;

  useEffect(() => { setPagina(0); }, [status, soSuspeitos]);

  const selecionar = useCallback((d: Disposal) => {
    setIdSelecionado(d.id);
    if (!desktop) setGavetaAberta(true);
    requestAnimationFrame(() => document.getElementById(`q-${d.id}`)?.scrollIntoView({ block: 'nearest' }));
  }, [desktop]);

  const mover = useCallback((direcao: 1 | -1) => {
    if (!linhas.length) return;
    const i = indiceSelecionado < 0 ? 0 : Math.min(linhas.length - 1, Math.max(0, indiceSelecionado + direcao));
    selecionar(linhas[i]);
  }, [linhas, indiceSelecionado, selecionar]);

  // 3. Ao aprovar/recusar, o item sai da fila na hora, sem esperar o servidor; se a API der erro, volta.
  /** Atualização otimista: tira o item da fila (ou muda o status) e devolve se a API falhar. */
  const atualizarOtimista = useCallback(async (d: Disposal, novoStatus: Disposal['status'], alteracoes: Partial<Disposal> = {}) => {
    const chave = qk.admin.disposals(parametros);
    await qc.cancelQueries({ queryKey: chave });
    const anterior = qc.getQueryData<Page<Disposal>>(chave);
    const vizinho = linhas[indiceSelecionado + 1] ?? linhas[indiceSelecionado - 1] ?? null;
    if (anterior) {
      const saiDaFila = parametros.status === 'PENDING';
      qc.setQueryData<Page<Disposal>>(chave, {
        ...anterior,
        totalElements: saiDaFila ? Math.max(0, anterior.totalElements - 1) : anterior.totalElements,
        content: saiDaFila ? anterior.content.filter((x) => x.id !== d.id) : anterior.content.map((x) => (x.id === d.id ? { ...x, status: novoStatus, ...alteracoes } : x)),
      });
    }
    if (parametros.status === 'PENDING') setIdSelecionado(vizinho?.id ?? null);
    if (!desktop && parametros.status === 'PENDING') setGavetaAberta(false);
    return () => { if (anterior) qc.setQueryData(chave, anterior); setIdSelecionado(d.id); };
  }, [qc, parametros, linhas, indiceSelecionado, desktop]);

  // 4. Aprovar: o servidor credita os pontos ao morador (o admin pode corrigir categoria/peso antes).
  const confirmarAprovacao = useCallback(async (d: Disposal, c: CorrecaoAprovacao) => {
    const desfazer = await atualizarOtimista(d, 'APPROVED');
    aprovar.mutate({ id: d.id, ...c }, {
      onSuccess: (res) => toast.success(`Aprovado · +${formatarNumero(res.pointsAwarded)} pts para ${res.user?.name ?? 'o morador'}`),
      onError: (e) => { desfazer(); toast.error(mensagemDeErro(e)); },
    });
  }, [aprovar, atualizarOtimista]);

  // 5. Recusar: exige um motivo, que o morador vê no histórico dele; nenhum ponto é creditado.
  const confirmarRecusa = useCallback(async (d: Disposal, motivo: string) => {
    setRecusando(null);
    const desfazer = await atualizarOtimista(d, 'REJECTED', { rejectionReason: motivo });
    recusar.mutate({ id: d.id, reason: motivo }, {
      onSuccess: () => toast.success('Descarte recusado. O morador será avisado.'),
      onError: (e) => { desfazer(); toast.error(mensagemDeErro(e)); },
    });
  }, [recusar, atualizarOtimista]);

  // Atalhos: J/K navegam, A aprova, R recusa.
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || estaDigitando(e.target)) return;
      if (document.querySelector('[aria-modal="true"]') && !(gavetaAberta && !recusando)) return;
      const k = e.key.toLowerCase();
      if (k === 'j' || (k === 'arrowdown' && desktop)) { e.preventDefault(); mover(1); }
      else if (k === 'k' || (k === 'arrowup' && desktop)) { e.preventDefault(); mover(-1); }
      else if (k === 'a' && selecionado?.status === 'PENDING') { e.preventDefault(); funcaoAprovar.current?.(); }
      else if (k === 'r' && selecionado?.status === 'PENDING') { e.preventDefault(); setRecusando(selecionado); }
    };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [mover, selecionado, desktop, gavetaAberta, recusando]);

  const ov = resumo.data;
  const total = q.data?.totalElements;

  const revisao = selecionado && (
    <RevisaoDescarte
      key={selecionado.id}
      descarte={selecionado}
      categorias={categorias.data}
      mostrarAtalhos={desktop}
      ocupado={false}
      refAprovar={(fn) => { funcaoAprovar.current = fn; }}
      aoAprovar={(c) => void confirmarAprovacao(selecionado, c)}
      aoRecusar={() => setRecusando(selecionado)}
    />
  );

  return (
    <>
      <CabecalhoPagina
        sobretitulo="Administração"
        title="Moderação de descartes"
        description="Revise as fotos, compare a categoria declarada com a sugestão da IA e confira os sinais antifraude antes de liberar os pontos."
      />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <Segmentado<FiltroStatus>
            label="Status"
            value={status}
            onChange={setStatus}
            opcoes={[
              { value: 'PENDING', label: 'Pendentes', contagem: ov?.pendingDisposals ?? null, tom: 'warning' },
              { value: 'APPROVED', label: 'Aprovados' },
              { value: 'REJECTED', label: 'Recusados' },
              { value: 'ALL', label: 'Todos' },
            ]}
          />
          <Interruptor size="sm" checked={soSuspeitos} onChange={setSoSuspeitos}
            label={<span className="inline-flex items-center gap-2 text-[13px]">Só suspeitos {ov && <span className="font-mono text-[11px] text-danger tabular">{ov.flaggedDisposals}</span>}</span>} />
        </div>
        <div className="flex items-center gap-4">
          <CampoBusca value={busca} onChange={setBusca} placeholder="Filtrar por morador ou categoria" className="w-full lg:w-72" />
          {desktop && (
            <p className="hidden shrink-0 items-center gap-1.5 text-xs text-subtle xl:flex" aria-label="Atalhos: J e K navegam, A aprova, R recusa">
              <Tecla>J</Tecla><Tecla>K</Tecla> navegar <span className="mx-1 text-line-strong">·</span> <Tecla>A</Tecla> aprovar <span className="mx-1 text-line-strong">·</span> <Tecla>R</Tecla> recusar
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(380px,440px)]">
        {/* Fila */}
        <section aria-label="Fila de descartes" className="surface min-w-0 overflow-hidden rounded-2xl">
          <div className="flex h-11 items-center justify-between border-b border-line px-4 text-xs text-subtle">
            <span className="label-mono">Fila</span>
            {total != null && <span className="font-mono tabular">{formatarNumero(total)} {total === 1 ? 'item' : 'itens'}</span>}
          </div>
          {q.error && !q.data ? (
            <EstadoErro erro={q.error} aoTentarDeNovo={q.refetch} compacto />
          ) : q.isPending ? (
            <div role="status" aria-label="Carregando fila" className="divide-y divide-line">
              {Array.from({ length: 7 }, (_, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3"><Esqueleto className="size-12 rounded-lg" /><div className="flex-1 space-y-2"><Esqueleto className="h-3.5 w-1/3" /><Esqueleto className="h-3 w-1/4" /></div></div>
              ))}
            </div>
          ) : !linhas.length ? (
            <EstadoVazio compacto icon={status === 'PENDING' && !busca ? BadgeCheck : Inbox}
              title={busca ? 'Nada encontrado' : status === 'PENDING' ? 'Fila zerada' : 'Nenhum descarte'}
              description={busca ? 'Nenhum item desta página corresponde à busca.' : status === 'PENDING' ? (soSuspeitos ? 'Nenhum descarte suspeito aguardando revisão.' : 'Todos os descartes foram revisados. Bom trabalho.') : 'Nenhum descarte com esses filtros.'} />
          ) : (
            <ul aria-label="Descartes"
              className={cn('divide-y divide-line/70', q.isPlaceholderData && 'opacity-60')}>
              {linhas.map((d) => (
                <LinhaFila key={d.id} d={d} ativo={selecionado?.id === d.id} aoSelecionar={() => selecionar(d)} />
              ))}
            </ul>
          )}
          {q.data && q.data.totalPages > 1 && (
            <div className="border-t border-line px-4 py-3">
              <Paginacao pagina={q.data.page} totalPaginas={q.data.totalPages} totalItens={q.data.totalElements} size={q.data.size} onChange={setPagina} />
            </div>
          )}
        </section>

        {/* Painel de revisão (desktop) */}
        {desktop && (
          <aside aria-label="Revisão" className="surface sticky top-[calc(var(--header-h)+16px)] flex h-[calc(100dvh-var(--header-h)-32px)] min-h-[560px] flex-col overflow-hidden rounded-2xl">
            {revisao ?? (
              <EstadoVazio compacto icon={Inbox} title="Selecione um descarte" description="Escolha um item da fila para revisar." className="my-auto" />
            )}
          </aside>
        )}
      </div>

      {!desktop && (
        <Gaveta open={gavetaAberta && !!selecionado} onClose={() => setGavetaAberta(false)} lado="bottom" title="Revisar descarte" className="h-[88dvh]">
          <div className="-mx-5 -mb-5 h-full">{revisao}</div>
        </Gaveta>
      )}

      <DialogoRecusa descarte={recusando} onClose={() => setRecusando(null)} aoConfirmar={(reason) => recusando && void confirmarRecusa(recusando, reason)} />
    </>
  );
}

function LinhaFila({ d, ativo, aoSelecionar }: { d: Disposal; ativo: boolean; aoSelecionar: () => void }) {
  const divergente = divergeDaIa(d);
  const pontuacao = d.fraud?.score ?? 0;
  return (
    <li id={`q-${d.id}`}>
      <button type="button" onClick={aoSelecionar} aria-current={ativo || undefined}
        className={cn('relative flex w-full items-center gap-3.5 px-4 py-3 text-left transition-colors hover:bg-white/[0.025] focus-visible:outline-offset-[-2px]',
          ativo && 'bg-white/[0.05] hover:bg-white/[0.05]')}>
        {ativo && <span aria-hidden className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-fg" />}
        <span className="relative size-12 shrink-0 overflow-hidden rounded-lg border border-line bg-bg-deep">
          {d.photoUrl ? <img src={d.photoUrl} alt="" loading="lazy" className="size-full object-cover" />
            : <span className="flex size-full items-center justify-center text-subtle"><ImageOff className="size-4" aria-hidden /></span>}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: d.category.color }} aria-hidden />
            <span className="truncate text-[13.5px] font-medium text-fg">{d.category.name}</span>
            <span className="font-mono text-[12.5px] text-fg-soft tabular">{formatarKg(d.quantityKg)}</span>
            {divergente && (
              <span className="inline-flex items-center gap-1 rounded-md border border-warning/30 px-1.5 py-px text-[11px] text-warning" title="A sugestão da IA difere da categoria declarada">
                <Sparkles className="size-3" aria-hidden /> IA ≠
              </span>
            )}
          </span>
          <span className="mt-0.5 block truncate text-xs text-muted">{d.user?.name ?? 'Usuário'} · {formatarRelativo(d.createdAt)}</span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1">
          {d.status !== 'PENDING' ? <PilulaStatus mapa={statusDescarte} value={d.status} /> : (
            <span className="inline-flex items-center gap-1.5">
              {pontuacao >= 40 && <AlertTriangle className={cn('size-3.5', pontuacao >= 70 ? 'text-danger' : 'text-warning')} aria-label="Sinalizado" />}
              <PontuacaoFraude pontuacao={pontuacao} />
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
