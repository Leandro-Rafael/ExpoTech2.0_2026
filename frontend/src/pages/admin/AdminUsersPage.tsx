import { useEffect, useMemo, useState } from 'react';
import { Lock, LockOpen, ShieldCheck, UserCheck, UserX, Users } from 'lucide-react';
import { mensagemDeErro } from '@/api/client';
import { useUsuariosAdmin, useAtualizarUsuarioAdmin } from '@/api/queries';
import { useDesbloquearUsuario } from '@/api/security';
import type { AdminUser, Role } from '@/api/types';
import { useUsuario } from '@/auth/AuthProvider';
import { Avatar, Etiqueta, Botao, DialogoConfirmacao, EstadoVazio, Campo, BotaoIcone, Modal, CabecalhoPagina, Paginacao, Selecao, PilulaStatus, toast } from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatarData, formatarDataHora, formatarNumero, formatarRelativo } from '@/lib/format';
import { perfil as roleLabels } from '@/lib/labels';
import { TabelaAdmin, CampoBusca, Segmentado, useDebounced, type ColunaAdmin } from '@/features/admin/ui';

type FiltroPerfil = Role | 'ALL';
const TAMANHO_PAGINA = 20;
const OPCOES_PERFIL: { value: Role; label: string; description: string }[] = [
  { value: 'USER', label: 'Morador', description: 'Registra descartes, acumula pontos e resgata recompensas.' },
  { value: 'COLLECTOR', label: 'Coletor', description: 'Acessa e executa rotas de coleta atribuídas.' },
  { value: 'ADMIN', label: 'Administrador', description: 'Acesso total: moderação, catálogo, usuários e rotas.' },
];

// Gestão de usuários: perfil de acesso, ativar/desativar contas e desbloquear quem errou a senha demais.
export default function PaginaUsuarios() {
  const eu = useUsuario();
  const [busca, setBusca] = useState('');
  const q = useDebounced(busca.trim(), 300);
  const [filtroPerfil, setFiltroPerfil] = useState<FiltroPerfil>('ALL');
  const [pagina, setPagina] = useState(0);
  const [alvoPerfil, setAlvoPerfil] = useState<AdminUser | null>(null);
  const [alvoAtivacao, setAlvoAtivacao] = useState<AdminUser | null>(null);
  const [alvoDesbloqueio, setAlvoDesbloqueio] = useState<AdminUser | null>(null);
  const desbloquear = useDesbloquearUsuario();
  const atualizar = useAtualizarUsuarioAdmin();

  useEffect(() => { setPagina(0); }, [q, filtroPerfil]);
  const usuarios = useUsuariosAdmin({ q: q || undefined, role: filtroPerfil === 'ALL' ? undefined : filtroPerfil, page: pagina, size: TAMANHO_PAGINA });

  const colunas = useMemo<ColunaAdmin<AdminUser>[]>(() => [
    {
      key: 'name', cabecalho: 'Usuário', celular: 'title', ordenar: (u) => u.name,
      celula: (u) => (
        <span className="flex min-w-0 items-center gap-3">
          <Avatar nome={u.name} size="sm" className="max-md:hidden" />
          <span className="min-w-0">
            <span className="flex items-center gap-2 font-medium text-fg">
              <span className="truncate">{u.name}</span>
              {u.id === eu.id && <span className="text-[11px] font-normal text-subtle">(você)</span>}
            </span>
            <span className="block truncate text-xs text-muted">{u.email}</span>
          </span>
        </span>
      ),
    },
    { key: 'role', cabecalho: 'Perfil', celular: 'aside', ordenar: (u) => u.role, celula: (u) => <PilulaStatus mapa={roleLabels} value={u.role} /> },
    {
      key: 'status', cabecalho: 'Status', ordenar: (u) => (u.enabled ? (u.locked ? 1 : 0) : 2),
      celula: (u) => <StatusUsuario u={u} />,
    },
    {
      key: 'points', cabecalho: 'Pontos', alinhamento: 'right', ordenar: (u) => u.points,
      celula: (u) => (
        <span className="font-mono whitespace-nowrap tabular">
          <span className="text-fg">{formatarNumero(u.points)}</span>
          <span className="block text-[11px] text-subtle">{formatarNumero(u.totalEarned)} ganhos</span>
        </span>
      ),
    },
    { key: 'household', cabecalho: 'Residência', className: 'max-lg:hidden', celular: 'hidden', ordenar: (u) => u.household, celula: (u) => u.household ?? <span className="text-subtle">—</span> },
    {
      key: 'login', cabecalho: 'Último acesso', ordenar: (u) => (u.lastLoginAt ? Date.parse(u.lastLoginAt) : 0),
      celula: (u) => u.lastLoginAt ? <span className="whitespace-nowrap" title={formatarData(u.lastLoginAt)}>{formatarRelativo(u.lastLoginAt)}</span> : <span className="text-subtle">Nunca</span>,
    },
    { key: 'created', cabecalho: 'Cadastro', className: 'max-xl:hidden', celular: 'hidden', ordenar: (u) => Date.parse(u.createdAt), celula: (u) => <span className="font-mono text-[12.5px] whitespace-nowrap tabular">{new Date(u.createdAt).toLocaleDateString('pt-BR')}</span> },
    {
      key: 'actions', cabecalho: <span className="sr-only">Ações</span>, alinhamento: 'right', celular: 'row',
      celula: (u) => <AcoesUsuario u={u} proprio={u.id === eu.id} aoAlterarPerfil={() => setAlvoPerfil(u)} aoAlternar={() => setAlvoAtivacao(u)} aoDesbloquear={() => setAlvoDesbloqueio(u)} />,
    },
  ], [eu.id]);

  const confirmarAtivacao = () => {
    const u = alvoAtivacao!;
    atualizar.mutate({ id: u.id, enabled: !u.enabled }, {
      onSuccess: (r) => { toast.success(r.enabled ? `${r.name} foi reativado.` : `${r.name} foi desativado e desconectado.`); setAlvoAtivacao(null); },
      onError: (e) => toast.error(mensagemDeErro(e)),
    });
  };

  const d = usuarios.data;
  return (
    <>
      <CabecalhoPagina sobretitulo="Administração" title="Usuários" description="Perfis de acesso, status das contas e saldo de pontos de moradores, coletores e administradores." />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Segmentado<FiltroPerfil> label="Perfil" value={filtroPerfil} onChange={setFiltroPerfil}
          opcoes={[{ value: 'ALL', label: 'Todos' }, { value: 'USER', label: 'Moradores' }, { value: 'COLLECTOR', label: 'Coletores' }, { value: 'ADMIN', label: 'Administradores' }]} />
        <CampoBusca value={busca} onChange={setBusca} placeholder="Buscar por nome ou e-mail" className="w-full sm:w-80" />
      </div>

      <TabelaAdmin
        legenda="Usuários"
        colunas={colunas}
        linhas={d?.content}
        chaveLinha={(u) => u.id}
        carregando={usuarios.isFetching}
        erro={usuarios.error}
        aoTentarDeNovo={usuarios.refetch}
        classeLinha={(u) => cn(!u.enabled && 'opacity-60')}
        vazio={<EstadoVazio compacto icon={Users} title="Nenhum usuário encontrado" description={q ? `Nada corresponde a “${q}”.` : 'Ajuste os filtros.'} />}
        rodape={d && d.totalElements > 0 ? <Paginacao pagina={d.page} totalPaginas={d.totalPages} totalItens={d.totalElements} size={d.size} onChange={setPagina} /> : undefined}
      />

      <DialogoPerfil usuario={alvoPerfil} onClose={() => setAlvoPerfil(null)} />

      <DialogoConfirmacao
        open={!!alvoDesbloqueio}
        onClose={() => setAlvoDesbloqueio(null)}
        carregando={desbloquear.isPending}
        title="Desbloquear conta?"
        rotuloConfirmar="Desbloquear"
        description={alvoDesbloqueio ? `Libera o acesso de ${alvoDesbloqueio.name} imediatamente e zera os avisos de inspeção${alvoDesbloqueio.securityWarnings ? ` (${alvoDesbloqueio.securityWarnings}/3)` : ''}. A ação fica registrada na auditoria.` : undefined}
        aoConfirmar={() => desbloquear.mutate(alvoDesbloqueio!.id, {
          onSuccess: (r) => { toast.success(`${r.name} foi desbloqueado.`); setAlvoDesbloqueio(null); },
          onError: (e) => toast.error(mensagemDeErro(e)),
        })}
      />

      <DialogoConfirmacao
        open={!!alvoAtivacao}
        onClose={() => setAlvoAtivacao(null)}
        aoConfirmar={confirmarAtivacao}
        carregando={atualizar.isPending}
        tone={alvoAtivacao?.enabled ? 'danger' : 'default'}
        title={alvoAtivacao?.enabled ? 'Desativar conta?' : 'Reativar conta?'}
        rotuloConfirmar={alvoAtivacao?.enabled ? 'Desativar' : 'Reativar'}
        description={alvoAtivacao?.enabled
          ? `${alvoAtivacao?.name} não conseguirá mais entrar e as sessões abertas serão encerradas. Os pontos e o histórico são mantidos.`
          : `${alvoAtivacao?.name} poderá entrar novamente. Bloqueios por tentativas de login também serão liberados.`}
      />
    </>
  );
}

function AcoesUsuario({ u, proprio, aoAlterarPerfil, aoAlternar, aoDesbloquear }: { u: AdminUser; proprio: boolean; aoAlterarPerfil: () => void; aoAlternar: () => void; aoDesbloquear: () => void }) {
  if (proprio) return <span className="text-xs text-subtle">—</span>;
  const podeDesbloquear = u.locked || (u.securityWarnings ?? 0) > 0;
  return (
    <span className="inline-flex items-center gap-0.5">
      {podeDesbloquear && <BotaoIcone icon={LockOpen} size="sm" label={`Desbloquear ${u.name}`} onClick={aoDesbloquear} className="text-warning hover:text-warning" />}
      <BotaoIcone icon={ShieldCheck} size="sm" label={`Alterar perfil de ${u.name}`} onClick={aoAlterarPerfil} />
      <BotaoIcone icon={u.enabled ? UserX : UserCheck} size="sm" variant={u.enabled ? 'danger' : 'ghost'}
        label={u.enabled ? `Desativar ${u.name}` : `Reativar ${u.name}`} onClick={aoAlternar} />
    </span>
  );
}

const horaMinuto = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

function StatusUsuario({ u }: { u: AdminUser }) {
  const avisos = u.securityWarnings ?? 0;
  const selo = avisos > 0 && (
    <span title="Avisos por tentar inspecionar o código no navegador. No 3º, o acesso é bloqueado por 30 minutos."
      className="inline-flex h-5 items-center rounded-md border border-warning/30 px-1.5 font-mono text-[11px] text-warning tabular">
      Avisos {avisos}/3
    </span>
  );
  if (!u.enabled) return <Etiqueta tone="danger" ponto>Desativado</Etiqueta>;
  if (u.locked) {
    return (
      <span className="flex flex-col items-start gap-1">
        <Etiqueta tone="warning" icon={Lock}>{u.lockReason === 'INSPECTION' ? 'Bloqueado por inspeção' : 'Bloqueado por senha'}</Etiqueta>
        <span className="flex items-center gap-1.5">
          {u.lockedUntil && <span className="font-mono text-[11px] text-subtle tabular" title={formatarDataHora(u.lockedUntil)}>até {horaMinuto(u.lockedUntil)}</span>}
          {selo}
        </span>
      </span>
    );
  }
  return (
    <span className="flex flex-wrap items-center gap-2">
      <span className="inline-flex items-center gap-1.5 text-[13px] text-fg-soft"><span className="size-1.5 rounded-full bg-success" aria-hidden />Ativo</span>
      {selo}
    </span>
  );
}

function DialogoPerfil({ usuario, onClose }: { usuario: AdminUser | null; onClose: () => void }) {
  const [valor, setValor] = useState<Role>('USER');
  const atualizar = useAtualizarUsuarioAdmin();
  useEffect(() => { if (usuario) setValor(usuario.role); }, [usuario]);
  const alterado = !!usuario && valor !== usuario.role;
  const promovendoAdmin = valor === 'ADMIN' && usuario?.role !== 'ADMIN';
  return (
    <Modal open={!!usuario} onClose={onClose} title="Alterar perfil" description={usuario ? `${usuario.name} · ${usuario.email}` : undefined} size="sm"
      rodape={
        <>
          <Botao variant="ghost" onClick={onClose}>Cancelar</Botao>
          <Botao disabled={!alterado} carregando={atualizar.isPending}
            onClick={() => atualizar.mutate({ id: usuario!.id, role: valor }, {
              onSuccess: (r) => { toast.success(`${r.name} agora é ${roleLabels[r.role].label.toLowerCase()}.`); onClose(); },
              onError: (e) => toast.error(mensagemDeErro(e)),
            })}>
            Confirmar alteração
          </Botao>
        </>
      }>
      <Campo label="Novo perfil">
        <Selecao value={valor} onChange={(e) => setValor(e.target.value as Role)} opcoes={OPCOES_PERFIL.map((o) => ({ value: o.value, label: o.label }))} />
      </Campo>
      <p className="mt-3 text-[13px] leading-relaxed text-muted">{OPCOES_PERFIL.find((o) => o.value === valor)?.description}</p>
      {promovendoAdmin && (
        <p className="mt-3 rounded-lg border border-warning/30 bg-warning/[0.07] px-3 py-2.5 text-[13px] text-warning">
          Administradores podem aprovar descartes, alterar o catálogo e gerenciar outros usuários. Confirme que esta pessoa é da equipe.
        </p>
      )}
    </Modal>
  );
}
