import { useEffect, useMemo, useState } from 'react';
import { Lock, ShieldCheck, UserCheck, UserX, Users } from 'lucide-react';
import { errorMessage } from '@/api/client';
import { useAdminUsers, useUpdateAdminUser } from '@/api/queries';
import type { AdminUser, Role } from '@/api/types';
import { useUser } from '@/auth/AuthProvider';
import { Avatar, Badge, Button, ConfirmDialog, EmptyState, Field, IconButton, Modal, PageHeader, Pagination, Select, StatusPill, toast } from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatDate, formatDateTime, formatNumber, formatRelative } from '@/lib/format';
import { role as roleLabels } from '@/lib/labels';
import { AdminTable, SearchField, Segmented, useDebounced, type AdminColumn } from '@/features/admin/ui';

type RoleFilter = Role | 'ALL';
const SIZE = 20;
const ROLE_OPTIONS: { value: Role; label: string; description: string }[] = [
  { value: 'USER', label: 'Morador', description: 'Registra descartes, acumula pontos e resgata recompensas.' },
  { value: 'COLLECTOR', label: 'Coletor', description: 'Acessa e executa rotas de coleta atribuídas.' },
  { value: 'ADMIN', label: 'Administrador', description: 'Acesso total: moderação, catálogo, usuários e rotas.' },
];

export default function AdminUsersPage() {
  const me = useUser();
  const [search, setSearch] = useState('');
  const q = useDebounced(search.trim(), 300);
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('ALL');
  const [page, setPage] = useState(0);
  const [roleTarget, setRoleTarget] = useState<AdminUser | null>(null);
  const [toggleTarget, setToggleTarget] = useState<AdminUser | null>(null);
  const update = useUpdateAdminUser();

  useEffect(() => { setPage(0); }, [q, roleFilter]);
  const users = useAdminUsers({ q: q || undefined, role: roleFilter === 'ALL' ? undefined : roleFilter, page, size: SIZE });

  const columns = useMemo<AdminColumn<AdminUser>[]>(() => [
    {
      key: 'name', header: 'Usuário', mobile: 'title', sort: (u) => u.name,
      cell: (u) => (
        <span className="flex min-w-0 items-center gap-3">
          <Avatar name={u.name} size="sm" className="max-md:hidden" />
          <span className="min-w-0">
            <span className="flex items-center gap-2 font-medium text-fg">
              <span className="truncate">{u.name}</span>
              {u.id === me.id && <span className="text-[11px] font-normal text-subtle">(você)</span>}
            </span>
            <span className="block truncate text-xs text-muted">{u.email}</span>
          </span>
        </span>
      ),
    },
    { key: 'role', header: 'Perfil', mobile: 'aside', sort: (u) => u.role, cell: (u) => <StatusPill map={roleLabels} value={u.role} /> },
    {
      key: 'status', header: 'Status', sort: (u) => (u.enabled ? (u.locked ? 1 : 0) : 2),
      cell: (u) => !u.enabled ? <Badge tone="danger" dot>Desativado</Badge>
        : u.locked ? (
          <span title={u.lockedUntil ? `Até ${formatDateTime(u.lockedUntil)}` : undefined}>
            <Badge tone="warning" icon={Lock}>{u.lockReason === 'INSPECTION' ? 'Bloqueado · inspeção' : 'Bloqueado · senha'}</Badge>
            {u.lockedUntil && <span className="mt-0.5 block text-[11px] text-subtle">até {formatDateTime(u.lockedUntil)}</span>}
          </span>
        )
          : (u.securityWarnings ?? 0) > 0 ? (
            <span className="inline-flex items-center gap-1.5 text-[13px] text-fg-soft" title="Avisos de inspeção do navegador (no 3º o acesso é bloqueado)">
              <span className="size-1.5 rounded-full bg-warning" aria-hidden />Ativo <span className="font-mono text-[11px] text-warning tabular">{u.securityWarnings}/3 avisos</span>
            </span>
          )
          : <span className="inline-flex items-center gap-1.5 text-[13px] text-fg-soft"><span className="size-1.5 rounded-full bg-success" aria-hidden />Ativo</span>,
    },
    {
      key: 'points', header: 'Pontos', align: 'right', sort: (u) => u.points,
      cell: (u) => (
        <span className="font-mono tabular">
          <span className="text-fg">{formatNumber(u.points)}</span>
          <span className="block text-[11px] text-subtle">{formatNumber(u.totalEarned)} ganhos</span>
        </span>
      ),
    },
    { key: 'household', header: 'Residência', className: 'max-lg:hidden', mobile: 'hidden', sort: (u) => u.household, cell: (u) => u.household ?? <span className="text-subtle">—</span> },
    {
      key: 'login', header: 'Último acesso', sort: (u) => (u.lastLoginAt ? Date.parse(u.lastLoginAt) : 0),
      cell: (u) => u.lastLoginAt ? <span title={formatDate(u.lastLoginAt)}>{formatRelative(u.lastLoginAt)}</span> : <span className="text-subtle">Nunca</span>,
    },
    { key: 'created', header: 'Cadastro', className: 'max-xl:hidden', mobile: 'hidden', sort: (u) => Date.parse(u.createdAt), cell: (u) => <span className="font-mono text-[12.5px] tabular">{formatDate(u.createdAt)}</span> },
    {
      key: 'actions', header: <span className="sr-only">Ações</span>, align: 'right', mobile: 'row',
      cell: (u) => <UserActions u={u} self={u.id === me.id} onRole={() => setRoleTarget(u)} onToggle={() => setToggleTarget(u)} />,
    },
  ], [me.id]);

  const confirmToggle = () => {
    const u = toggleTarget!;
    update.mutate({ id: u.id, enabled: !u.enabled }, {
      onSuccess: (r) => { toast.success(r.enabled ? `${r.name} foi reativado.` : `${r.name} foi desativado e desconectado.`); setToggleTarget(null); },
      onError: (e) => toast.error(errorMessage(e)),
    });
  };

  const d = users.data;
  return (
    <>
      <PageHeader eyebrow="Administração" title="Usuários" description="Perfis de acesso, status das contas e saldo de pontos de moradores, coletores e administradores." />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Segmented<RoleFilter> label="Perfil" value={roleFilter} onChange={setRoleFilter}
          options={[{ value: 'ALL', label: 'Todos' }, { value: 'USER', label: 'Moradores' }, { value: 'COLLECTOR', label: 'Coletores' }, { value: 'ADMIN', label: 'Administradores' }]} />
        <SearchField value={search} onChange={setSearch} placeholder="Buscar por nome ou e-mail" className="w-full sm:w-80" />
      </div>

      <AdminTable
        caption="Usuários"
        columns={columns}
        rows={d?.content}
        rowKey={(u) => u.id}
        loading={users.isFetching}
        error={users.error}
        onRetry={users.refetch}
        rowClassName={(u) => cn(!u.enabled && 'opacity-60')}
        empty={<EmptyState compact icon={Users} title="Nenhum usuário encontrado" description={q ? `Nada corresponde a “${q}”.` : 'Ajuste os filtros.'} />}
        footer={d && d.totalElements > 0 ? <Pagination page={d.page} totalPages={d.totalPages} totalElements={d.totalElements} size={d.size} onChange={setPage} /> : undefined}
      />

      <RoleDialog user={roleTarget} onClose={() => setRoleTarget(null)} />

      <ConfirmDialog
        open={!!toggleTarget}
        onClose={() => setToggleTarget(null)}
        onConfirm={confirmToggle}
        loading={update.isPending}
        tone={toggleTarget?.enabled ? 'danger' : 'default'}
        title={toggleTarget?.enabled ? 'Desativar conta?' : 'Reativar conta?'}
        confirmLabel={toggleTarget?.enabled ? 'Desativar' : 'Reativar'}
        description={toggleTarget?.enabled
          ? `${toggleTarget?.name} não conseguirá mais entrar e as sessões abertas serão encerradas. Os pontos e o histórico são mantidos.`
          : `${toggleTarget?.name} poderá entrar novamente. Bloqueios por tentativas de login também serão liberados.`}
      />
    </>
  );
}

function UserActions({ u, self, onRole, onToggle }: { u: AdminUser; self: boolean; onRole: () => void; onToggle: () => void }) {
  if (self) return <span className="text-xs text-subtle">—</span>;
  return (
    <span className="inline-flex items-center gap-0.5">
      <IconButton icon={ShieldCheck} size="sm" label={`Alterar perfil de ${u.name}`} onClick={onRole} />
      <IconButton icon={u.enabled ? UserX : UserCheck} size="sm" variant={u.enabled ? 'danger' : 'ghost'}
        label={u.enabled ? `Desativar ${u.name}` : `Reativar ${u.name}`} onClick={onToggle} />
    </span>
  );
}

function RoleDialog({ user, onClose }: { user: AdminUser | null; onClose: () => void }) {
  const [value, setValue] = useState<Role>('USER');
  const update = useUpdateAdminUser();
  useEffect(() => { if (user) setValue(user.role); }, [user]);
  const changed = !!user && value !== user.role;
  const elevating = value === 'ADMIN' && user?.role !== 'ADMIN';
  return (
    <Modal open={!!user} onClose={onClose} title="Alterar perfil" description={user ? `${user.name} · ${user.email}` : undefined} size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button disabled={!changed} loading={update.isPending}
            onClick={() => update.mutate({ id: user!.id, role: value }, {
              onSuccess: (r) => { toast.success(`${r.name} agora é ${roleLabels[r.role].label.toLowerCase()}.`); onClose(); },
              onError: (e) => toast.error(errorMessage(e)),
            })}>
            Confirmar alteração
          </Button>
        </>
      }>
      <Field label="Novo perfil">
        <Select value={value} onChange={(e) => setValue(e.target.value as Role)} options={ROLE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))} />
      </Field>
      <p className="mt-3 text-[13px] leading-relaxed text-muted">{ROLE_OPTIONS.find((o) => o.value === value)?.description}</p>
      {elevating && (
        <p className="mt-3 rounded-lg border border-warning/30 bg-warning/[0.07] px-3 py-2.5 text-[13px] text-warning">
          Administradores podem aprovar descartes, alterar o catálogo e gerenciar outros usuários. Confirme que esta pessoa é da equipe.
        </p>
      )}
    </Modal>
  );
}
