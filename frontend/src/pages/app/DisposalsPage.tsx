import { useState } from 'react';
import { BrainCircuit, CircleDashed, MapPin, Recycle, ScanLine, XCircle } from 'lucide-react';
import { useDescarte, useDescartes } from '@/api/queries';
import type { Disposal, DisposalStatus } from '@/api/types';
import { IconeCategoria } from '@/components/CategoryIcon';
import {
  LinkBotao, Gaveta, EstadoVazio, EstadoErro, CabecalhoPagina, Paginacao, EsqueletoTexto, PilulaStatus, Abas,
} from '@/components/ui';
import { LinhaDescarte } from '@/features/resident/shared';
import { useEhDesktop } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/cn';
import { nomeDaCategoria } from '@/lib/category';
import { formatarDataHora, formatarKg, formatarNumero, formatarPercentual, formatarPontos } from '@/lib/format';
import { origemIa, statusDescarte } from '@/lib/labels';

type Filtro = 'ALL' | DisposalStatus;
const FILTROS: { value: Filtro; label: string }[] = [
  { value: 'ALL', label: 'Todos' },
  { value: 'PENDING', label: 'Pendentes' },
  { value: 'APPROVED', label: 'Aprovados' },
  { value: 'REJECTED', label: 'Recusados' },
];
const VAZIO: Record<Filtro, { title: string; description: string }> = {
  ALL: { title: 'Nenhum descarte registrado', description: 'Registre seu primeiro resíduo com uma foto. Ele aparece aqui com o status da análise.' },
  PENDING: { title: 'Nada aguardando análise', description: 'Todos os seus descartes já foram analisados.' },
  APPROVED: { title: 'Nenhum descarte aprovado ainda', description: 'Quando um registro for aprovado, os pontos aparecem aqui e no seu saldo.' },
  REJECTED: { title: 'Nenhum descarte recusado', description: 'Ótimo sinal: seus registros estão dentro das regras.' },
};
const TAMANHO_PAGINA = 12;

// Histórico de descartes do morador, com o status da análise e o motivo quando foi recusado.
export default function PaginaDescartes() {
  const [filtro, setFiltro] = useState<Filtro>('ALL');
  const [pagina, setPagina] = useState(0);
  const [selecionado, setSelecionado] = useState<Disposal | null>(null);
  const q = useDescartes({ status: filtro === 'ALL' ? undefined : filtro, page: pagina, size: TAMANHO_PAGINA });
  const telaGrande = useEhDesktop();

  return (
    <>
      <CabecalhoPagina
        sobretitulo="Histórico"
        title="Meus descartes"
        description="Cada registro passa por análise. Só descartes aprovados geram pontos — e uma única vez."
      />

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Abas idBase="dsp" aria-label="Filtrar por status" itens={FILTROS}
          value={filtro} onChange={(v) => { setFiltro(v); setPagina(0); }} />
        {q.data && <p className="font-mono text-xs text-subtle tabular">{formatarNumero(q.data.totalElements)} {q.data.totalElements === 1 ? 'registro' : 'registros'}</p>}
      </div>

      <div id={`dsp-panel-${filtro}`} role="tabpanel" aria-labelledby={`dsp-tab-${filtro}`}>
        {q.isPending ? <EsqueletoTexto linhas={8} /> : q.error ? (
          <EstadoErro erro={q.error} aoTentarDeNovo={q.refetch} />
        ) : q.data.content.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line-strong">
            <EstadoVazio icon={Recycle} title={VAZIO[filtro].title} description={VAZIO[filtro].description}
              acao={filtro === 'ALL' || filtro === 'APPROVED' ? <LinkBotao to="/app/descartar" iconeEsquerda={ScanLine}>Registrar descarte</LinkBotao> : undefined} />
          </div>
        ) : (
          <>
            <div className={cn('divide-y divide-line border-y border-line transition-opacity', q.isPlaceholderData && 'opacity-60')}>
              {q.data.content.map((d) => <LinhaDescarte key={d.id} d={d} onClick={() => setSelecionado(d)} />)}
            </div>
            <Paginacao className="mt-6" pagina={q.data.page} totalPaginas={q.data.totalPages} totalItens={q.data.totalElements} size={q.data.size}
              onChange={(p) => { setPagina(p); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />
          </>
        )}
      </div>

      <Gaveta open={!!selecionado} onClose={() => setSelecionado(null)} lado={telaGrande ? 'right' : 'bottom'}
        title={selecionado ? `${selecionado.category.name} · ${formatarKg(selecionado.quantityKg)}` : ''}
        description={selecionado ? `Registrado em ${formatarDataHora(selecionado.createdAt)}` : undefined}>
        {selecionado && <DetalheDescarte inicial={selecionado} />}
      </Gaveta>
    </>
  );
}

function DetalheDescarte({ inicial }: { inicial: Disposal }) {
  const q = useDescarte(inicial.id);
  const d = q.data ?? inicial;
  const aprovado = d.status === 'APPROVED';
  const corrigido = d.ai?.suggestedCode && d.ai.suggestedCode !== d.category.code;

  const etapas = [
    { label: 'Descartado', at: d.disposedAt, state: 'done' as const },
    { label: 'Registrado no app', at: d.createdAt, state: 'done' as const },
    d.status === 'PENDING'
      ? { label: 'Aguardando análise', at: null, state: 'current' as const }
      : { label: aprovado ? 'Aprovado' : 'Recusado', at: d.reviewedAt, state: aprovado ? 'done' as const : 'rejected' as const },
  ];

  return (
    <div className="space-y-6 pt-2">
      {d.photoUrl ? (
        <img src={d.photoUrl} alt={`Foto do descarte de ${d.category.name}`} className="aspect-[4/3] w-full rounded-xl border border-line bg-bg-deep object-cover" />
      ) : (
        <div className="flex aspect-[4/3] items-center justify-center rounded-xl border border-dashed border-line-strong text-sm text-subtle">Registrado sem foto</div>
      )}

      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-3">
          <IconeCategoria icon={d.category.icon} codigo={d.category.code} cor={d.category.color} />
          <span>
            <span className="block text-sm font-semibold text-fg">{d.category.name}</span>
            <span className="block font-mono text-xs text-muted tabular">{formatarKg(d.quantityKg)}</span>
          </span>
        </span>
        <PilulaStatus mapa={statusDescarte} value={d.status} size="md" />
      </div>

      {d.status === 'REJECTED' && (
        <div role="note" className="rounded-xl border border-danger/30 bg-danger/[0.06] p-4">
          <p className="flex items-center gap-2 text-sm font-medium text-danger"><XCircle className="size-4" aria-hidden /> Motivo da recusa</p>
          <p className="mt-1.5 text-sm text-fg-soft">{d.rejectionReason ?? 'Não informado.'}</p>
        </div>
      )}

      <dl className="divide-y divide-line border-y border-line text-sm">
        <Linha label={aprovado ? 'Pontos creditados' : d.status === 'PENDING' ? 'Pontos estimados' : 'Pontos'}>
          <span className={cn('font-mono tabular', aprovado ? 'text-success' : d.status === 'REJECTED' ? 'text-subtle line-through' : 'text-fg')}>
            {aprovado ? `+${formatarPontos(d.pointsAwarded)}` : `≈ ${formatarPontos(d.estimatedPoints)}`}
          </span>
        </Linha>
        <Linha label="Identificação">
          {d.ai?.verified ? (
            <span className="inline-flex items-center gap-1.5 text-success"><BrainCircuit className="size-3.5" aria-hidden />Confirmado pela IA (+10%)</span>
          ) : d.ai?.source === 'LOCAL' ? (
            <span className="inline-flex items-center gap-1.5 text-fg-soft"><BrainCircuit className="size-3.5" aria-hidden />Sugestão do navegador</span>
          ) : d.ai?.source ? (
            <span className="inline-flex items-center gap-1.5 text-fg-soft"><BrainCircuit className="size-3.5" aria-hidden />{origemIa[d.ai.source].label}</span>
          ) : <span className="text-fg-soft">Manual</span>}
        </Linha>
        {d.ai?.suggestedCode && (
          <Linha label="Sugestão da IA">
            <span className="text-fg-soft">
              {nomeDaCategoria(d.ai.suggestedCode)}
              {d.ai.confidence != null && <span className="ml-1.5 font-mono text-xs text-subtle tabular">{formatarPercentual(d.ai.confidence)}</span>}
              {corrigido && <span className="ml-1.5 text-xs text-warning">· corrigida por você</span>}
            </span>
          </Linha>
        )}
        <Linha label="Local">
          {d.collectionPoint ? (
            <span className="inline-flex items-center gap-1.5 text-right text-fg-soft"><MapPin className="size-3.5 shrink-0" aria-hidden />{d.collectionPoint.name}</span>
          ) : d.latitude != null ? (
            <span className="font-mono text-xs text-fg-soft tabular">{d.latitude.toFixed(4)}, {d.longitude?.toFixed(4)}</span>
          ) : <span className="text-subtle">Não informado</span>}
        </Linha>
        {d.notes && <Linha label="Observações"><span className="text-right text-fg-soft">{d.notes}</span></Linha>}
      </dl>

      <section aria-label="Linha do tempo">
        <p className="label-mono mb-3">Linha do tempo</p>
        <ol className="relative space-y-4 border-l border-line pl-5">
          {etapas.map((s) => (
            <li key={s.label} className="relative">
              <span aria-hidden className={cn('absolute top-1 -left-[25px] flex size-[9px] rounded-full ring-4 ring-surface-2',
                s.state === 'done' ? 'bg-success' : s.state === 'rejected' ? 'bg-danger' : 'bg-warning')} />
              <p className="flex items-center gap-1.5 text-sm text-fg">{s.state === 'current' && <CircleDashed className="size-3.5 text-warning" aria-hidden />}{s.label}</p>
              <p className="font-mono text-xs text-subtle tabular">{s.at ? formatarDataHora(s.at) : 'normalmente em até 24 h'}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function Linha({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <dt className="shrink-0 text-muted">{label}</dt>
      <dd className="min-w-0 text-right">{children}</dd>
    </div>
  );
}
