import { useEffect, useMemo, useState } from 'react';
import { ScrollText } from 'lucide-react';
import { useAuditoriaAdmin } from '@/api/queries';
import type { AuditEntry } from '@/api/types';
import { EstadoVazio, CabecalhoPagina, Paginacao } from '@/components/ui';
import { pontoTom } from '@/components/ui/Badge';
import { cn } from '@/lib/cn';
import { formatarDataHora, formatarRelativo } from '@/lib/format';
import { TabelaAdmin, CampoBusca, type ColunaAdmin } from '@/features/admin/ui';
import { GRUPOS_AUDITORIA, opcoesAcoesAuditoria, acoesDoGrupo, infoAuditoria, type GrupoAuditoria } from '@/features/admin/auditLabels';
import { useValorAtrasado } from '@/features/admin/useDebounced';

/** Filtros por área, ação e texto aplicados no servidor (GET /admin/audit?action&q), com paginação real. */
export default function PaginaAuditoria() {
  const [pagina, setPagina] = useState(0);
  const [grupo, setGrupo] = useState<GrupoAuditoria | 'ALL'>('ALL');
  const [acao, setAcao] = useState<string>('ALL');
  const [busca, setBusca] = useState('');
  const q = useValorAtrasado(busca.trim(), 350);
  const filtrando = grupo !== 'ALL' || acao !== 'ALL' || !!q;

  const acoes = useMemo(() => {
    if (acao !== 'ALL') return acao.split(',');
    if (grupo !== 'ALL') return acoesDoGrupo(grupo);
    return undefined;
  }, [grupo, acao]);
  const consulta = useAuditoriaAdmin({ page: pagina, size: 25, action: acoes, q: q || undefined });

  useEffect(() => { setPagina(0); }, [grupo, acao, q]);

  const opcoesAcao = useMemo(() => opcoesAcoesAuditoria(grupo), [grupo]);
  const linhas = consulta.data?.content;

  const colunas: ColunaAdmin<AuditEntry>[] = [
    {
      key: 'when', cabecalho: 'Quando', ordenar: (e) => Date.parse(e.createdAt), celular: 'subtitle',
      celula: (e) => <span className="block whitespace-nowrap" title={formatarDataHora(e.createdAt)}><span className="font-mono text-[12.5px] text-fg-soft tabular">{formatarDataHora(e.createdAt)}</span><span className="block text-[11px] text-subtle">{formatarRelativo(e.createdAt)}</span></span>,
    },
    {
      key: 'action', cabecalho: 'Ação', celular: 'title', ordenar: (e) => infoAuditoria(e.action).label,
      celula: (e) => {
        const m = infoAuditoria(e.action);
        return (
          <span className="flex items-center gap-2.5">
            <span aria-hidden className={cn('size-1.5 shrink-0 rounded-full', pontoTom[m.tone])} />
            <span className="min-w-0">
              <span className="block font-medium text-fg">{m.label}</span>
              <span className="block font-mono text-[10.5px] text-subtle">{e.action}</span>
            </span>
          </span>
        );
      },
    },
    { key: 'actor', cabecalho: 'Autor', ordenar: (e) => e.actor ?? '', celula: (e) => <Autor autor={e.actor} /> },
    { key: 'details', cabecalho: 'Detalhes', className: 'max-w-[360px]', celula: (e) => e.details ? <span className="line-clamp-2 text-[13px]" title={e.details}>{e.details}</span> : <span className="text-subtle">—</span> },
    { key: 'entity', cabecalho: 'Entidade', className: 'max-xl:hidden', celular: 'hidden', celula: (e) => e.entity ? <span className="font-mono text-[11.5px] text-muted" title={e.entityId ?? undefined}>{e.entity}{e.entityId ? ` · ${e.entityId.slice(0, 8)}` : ''}</span> : <span className="text-subtle">—</span> },
    { key: 'ip', cabecalho: 'IP', ordenar: (e) => e.ip ?? '', celula: (e) => <span className="font-mono text-[12px] text-muted tabular">{e.ip ?? '—'}</span> },
  ];

  const d = consulta.data;
  return (
    <>
      <CabecalhoPagina sobretitulo="Administração" title="Auditoria" description="Registro imutável das ações sensíveis: acessos, moderação, alterações de catálogo, rotas e exportações." />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          <select value={grupo} onChange={(e) => { setGrupo(e.target.value as GrupoAuditoria | 'ALL'); setAcao('ALL'); }} aria-label="Filtrar por área"
            className="h-9 cursor-pointer rounded-[10px] border border-line bg-bg-deep/60 px-3 text-[13px] text-fg-soft focus:outline-none [&>option]:bg-surface">
            <option value="ALL">Todas as áreas</option>
            {(Object.keys(GRUPOS_AUDITORIA) as GrupoAuditoria[]).map((g) => <option key={g} value={g}>{GRUPOS_AUDITORIA[g].label}</option>)}
          </select>
          <select value={acao} onChange={(e) => setAcao(e.target.value)} aria-label="Filtrar por ação"
            className="h-9 max-w-64 cursor-pointer rounded-[10px] border border-line bg-bg-deep/60 px-3 text-[13px] text-fg-soft focus:outline-none [&>option]:bg-surface">
            <option value="ALL">Todas as ações</option>
            {opcoesAcao.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <CampoBusca value={busca} onChange={setBusca} placeholder="Autor, IP ou detalhe" className="w-full lg:w-72" />
      </div>

      <TabelaAdmin
        legenda="Registro de auditoria"
        colunas={colunas}
        linhas={linhas}
        chaveLinha={(e) => e.id}
        carregando={consulta.isFetching}
        erro={consulta.error}
        aoTentarDeNovo={consulta.refetch}
        linhasCarregando={10}
        vazio={<EstadoVazio compacto icon={ScrollText} title="Nenhum registro" description={filtrando ? 'Nenhum evento corresponde aos filtros.' : 'Ainda não há eventos.'} />}
        rodape={d && d.totalElements > 0 ? (
          <div className="flex flex-col gap-2">
            {filtrando && <p className="text-xs text-subtle">{d.totalElements} eventos correspondem aos filtros.</p>}
            <Paginacao pagina={d.page} totalPaginas={d.totalPages} totalItens={d.totalElements} size={d.size} onChange={setPagina} />
          </div>
        ) : undefined}
      />
    </>
  );
}

/** "Nome <email>" → nome em destaque e e-mail menor. */
function Autor({ autor }: { autor: string | null }) {
  if (!autor) return <span className="text-subtle">sistema</span>;
  const m = autor.match(/^(.*?)\s*<([^>]+)>$/);
  if (!m) return <span className="break-all">{autor}</span>;
  return (
    <span className="block min-w-0">
      <span className="block truncate text-fg-soft">{m[1]}</span>
      <span className="block truncate text-[11.5px] text-subtle">{m[2]}</span>
    </span>
  );
}
