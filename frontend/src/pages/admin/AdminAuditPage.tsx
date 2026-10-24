import { useEffect, useMemo, useState } from 'react';
import { ScrollText } from 'lucide-react';
import { useAdminAudit } from '@/api/queries';
import type { AuditEntry } from '@/api/types';
import { EmptyState, PageHeader, Pagination } from '@/components/ui';
import { toneDot } from '@/components/ui/Badge';
import { cn } from '@/lib/cn';
import { formatDateTime, formatRelative } from '@/lib/format';
import { AdminTable, SearchField, type AdminColumn } from '@/features/admin/ui';
import { AUDIT_GROUPS, auditMeta, type AuditGroup } from '@/features/admin/auditLabels';

/**
 * A API pagina sem filtro por ação; com filtro/busca ativos buscamos páginas maiores (100)
 * e filtramos no cliente — suficiente para a auditoria do protótipo.
 */
export default function AdminAuditPage() {
  const [page, setPage] = useState(0);
  const [group, setGroup] = useState<AuditGroup | 'ALL'>('ALL');
  const [action, setAction] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const filtering = group !== 'ALL' || action !== 'ALL' || !!search.trim();
  const size = filtering ? 100 : 25;
  const q = useAdminAudit({ page, size });

  useEffect(() => { setPage(0); }, [filtering]);

  const actionsInPage = useMemo(() => [...new Set(q.data?.content.map((e) => e.action) ?? [])].sort((a, b) => auditMeta(a).label.localeCompare(auditMeta(b).label, 'pt-BR')), [q.data]);

  const rows = useMemo(() => {
    const s = search.trim().toLocaleLowerCase('pt-BR');
    return q.data?.content.filter((e) => {
      const m = auditMeta(e.action);
      return (group === 'ALL' || m.group === group) && (action === 'ALL' || e.action === action)
        && (!s || [e.actor, e.details, e.ip, e.entity, m.label].some((x) => x?.toLocaleLowerCase('pt-BR').includes(s)));
    });
  }, [q.data, group, action, search]);

  const columns: AdminColumn<AuditEntry>[] = [
    {
      key: 'when', header: 'Quando', sort: (e) => Date.parse(e.createdAt), mobile: 'subtitle',
      cell: (e) => <span className="block whitespace-nowrap" title={formatDateTime(e.createdAt)}><span className="font-mono text-[12.5px] text-fg-soft tabular">{formatDateTime(e.createdAt)}</span><span className="block text-[11px] text-subtle">{formatRelative(e.createdAt)}</span></span>,
    },
    {
      key: 'action', header: 'Ação', mobile: 'title', sort: (e) => auditMeta(e.action).label,
      cell: (e) => {
        const m = auditMeta(e.action);
        return (
          <span className="flex items-center gap-2.5">
            <span aria-hidden className={cn('size-1.5 shrink-0 rounded-full', toneDot[m.tone])} />
            <span className="min-w-0">
              <span className="block font-medium text-fg">{m.label}</span>
              <span className="block font-mono text-[10.5px] text-subtle">{e.action}</span>
            </span>
          </span>
        );
      },
    },
    { key: 'actor', header: 'Autor', sort: (e) => e.actor ?? '', cell: (e) => e.actor ?? <span className="text-subtle">sistema</span> },
    { key: 'details', header: 'Detalhes', className: 'max-w-[360px]', cell: (e) => e.details ? <span className="line-clamp-2 text-[13px]" title={e.details}>{e.details}</span> : <span className="text-subtle">—</span> },
    { key: 'entity', header: 'Entidade', className: 'max-xl:hidden', mobile: 'hidden', cell: (e) => e.entity ? <span className="font-mono text-[11.5px] text-muted" title={e.entityId ?? undefined}>{e.entity}{e.entityId ? ` · ${e.entityId.slice(0, 8)}` : ''}</span> : <span className="text-subtle">—</span> },
    { key: 'ip', header: 'IP', sort: (e) => e.ip ?? '', cell: (e) => <span className="font-mono text-[12px] text-muted tabular">{e.ip ?? '—'}</span> },
  ];

  const d = q.data;
  return (
    <>
      <PageHeader eyebrow="Administração" title="Auditoria" description="Registro imutável das ações sensíveis: acessos, moderação, alterações de catálogo, rotas e exportações." />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          <select value={group} onChange={(e) => { setGroup(e.target.value as AuditGroup | 'ALL'); setAction('ALL'); }} aria-label="Filtrar por área"
            className="h-9 cursor-pointer rounded-[10px] border border-line bg-bg-deep/60 px-3 text-[13px] text-fg-soft focus:outline-none [&>option]:bg-surface">
            <option value="ALL">Todas as áreas</option>
            {(Object.keys(AUDIT_GROUPS) as AuditGroup[]).map((g) => <option key={g} value={g}>{AUDIT_GROUPS[g].label}</option>)}
          </select>
          <select value={action} onChange={(e) => setAction(e.target.value)} aria-label="Filtrar por ação"
            className="h-9 max-w-64 cursor-pointer rounded-[10px] border border-line bg-bg-deep/60 px-3 text-[13px] text-fg-soft focus:outline-none [&>option]:bg-surface">
            <option value="ALL">Todas as ações</option>
            {actionsInPage.filter((a) => group === 'ALL' || auditMeta(a).group === group).map((a) => <option key={a} value={a}>{auditMeta(a).label}</option>)}
          </select>
        </div>
        <SearchField value={search} onChange={setSearch} placeholder="Autor, IP ou detalhe" className="w-full lg:w-72" />
      </div>

      <AdminTable
        caption="Registro de auditoria"
        columns={columns}
        rows={rows}
        rowKey={(e) => e.id}
        loading={q.isFetching}
        error={q.error}
        onRetry={q.refetch}
        skeletonRows={10}
        empty={<EmptyState compact icon={ScrollText} title="Nenhum registro" description={filtering ? 'Nenhum evento desta página corresponde aos filtros.' : 'Ainda não há eventos.'} />}
        footer={d && d.totalElements > 0 ? (
          <div className="flex flex-col gap-2">
            {filtering && <p className="text-xs text-subtle">Filtrando {d.content.length} eventos desta página · {rows?.length ?? 0} correspondem.</p>}
            <Pagination page={d.page} totalPages={d.totalPages} totalElements={d.totalElements} size={d.size} onChange={setPage} />
          </div>
        ) : undefined}
      />
    </>
  );
}
