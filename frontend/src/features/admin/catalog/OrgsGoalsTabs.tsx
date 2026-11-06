import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { FormNumber } from '../formControls';
import { Building2, Flag, Pencil, Plus } from 'lucide-react';
import { aplicarErrosDoServidor } from '@/api/forms';
import { useMetasAdmin, useOrganizacoesAdmin, useCriarOrganizacao, useSalvarMeta } from '@/api/queries';
import type { Goal, Organization, OrganizationType } from '@/api/types';
import { Botao, EstadoVazio, Campo, ErroFormulario, BotaoIcone, CampoTexto, Modal, Selecao, PilulaStatus, toast } from '@/components/ui';
import { formatarKg, formatarPercentual } from '@/lib/format';
import { tipoOrganizacao } from '@/lib/labels';
import { TabelaAdmin, Medidor, type ColunaAdmin } from '../ui';

// ------------------------------------------------------------------ Organizações

export function AbaOrganizacoes() {
  const q = useOrganizacoesAdmin();
  const [aberto, setAberto] = useState(false);
  const colunas: ColunaAdmin<Organization>[] = [
    { key: 'name', cabecalho: 'Organização', celular: 'title', ordenar: (o) => o.name, celula: (o) => <span className="font-medium text-fg">{o.name}</span> },
    { key: 'type', cabecalho: 'Tipo', celular: 'aside', ordenar: (o) => o.type, celula: (o) => <PilulaStatus mapa={tipoOrganizacao} value={o.type} /> },
  ];
  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-[13.5px] text-muted">Turmas, escolas, empresas e condomínios que competem no ranking.</p>
        <Botao size="sm" variant="secondary" iconeEsquerda={Plus} onClick={() => setAberto(true)}>Nova organização</Botao>
      </div>
      <TabelaAdmin legenda="Organizações" colunas={colunas} linhas={q.data} chaveLinha={(o) => o.id} carregando={q.isPending} erro={q.error} aoTentarDeNovo={q.refetch}
        ordemPadrao={{ key: 'name', direcao: 'asc' }}
        vazio={<EstadoVazio compacto icon={Building2} title="Nenhuma organização" />} />
      {aberto && <FormOrganizacao onClose={() => setAberto(false)} />}
    </>
  );
}

const esquemaOrganizacao = z.object({
  name: z.string().trim().min(2, 'Mínimo de 2 caracteres').max(120, 'Máximo de 120 caracteres'),
  type: z.enum(['TURMA', 'EMPRESA', 'CONDOMINIO', 'ESCOLA']),
});

function FormOrganizacao({ onClose }: { onClose: () => void }) {
  const criar = useCriarOrganizacao();
  const formulario = useForm<z.infer<typeof esquemaOrganizacao>>({ resolver: zodResolver(esquemaOrganizacao), defaultValues: { name: '', type: 'TURMA' } });
  const { errors: erros, isSubmitting: enviando } = formulario.formState;
  return (
    <Modal open onClose={onClose} size="sm" title="Nova organização"
      rodape={<><Botao variant="ghost" onClick={onClose}>Cancelar</Botao><Botao type="submit" form="org-form" carregando={enviando}>Criar</Botao></>}>
      <form id="org-form" noValidate className="space-y-4" onSubmit={formulario.handleSubmit(async (v) => {
        try { const o = await criar.mutateAsync({ name: v.name.trim(), type: v.type }); toast.success(`“${o.name}” criada.`); onClose(); }
        catch (e) { aplicarErrosDoServidor(e, formulario.setError); }
      })}>
        <ErroFormulario erro={erros.root?.server} />
        <Campo label="Nome" required erro={erros.name}><CampoTexto {...formulario.register('name')} maxLength={120} placeholder="3º semestre — ADS" data-autofocus /></Campo>
        <Campo label="Tipo" required erro={erros.type}>
          <Selecao {...formulario.register('type')} opcoes={(Object.keys(tipoOrganizacao) as OrganizationType[]).map((t) => ({ value: t, label: tipoOrganizacao[t].label }))} />
        </Campo>
      </form>
    </Modal>
  );
}

// ------------------------------------------------------------------ Metas

export function AbaMetas() {
  const q = useMetasAdmin();
  const [editando, setEditando] = useState<Goal | 'new' | null>(null);
  const colunas: ColunaAdmin<Goal>[] = [
    { key: 'year', cabecalho: 'Ano', celular: 'aside', ordenar: (g) => g.year, celula: (g) => <span className="font-mono text-fg tabular">{g.year}</span> },
    { key: 'title', cabecalho: 'Meta', celular: 'title', ordenar: (g) => g.title, celula: (g) => <span className="font-medium text-fg">{g.title}</span> },
    {
      key: 'rate', cabecalho: 'Taxa de reciclagem', ordenar: (g) => g.targetRecyclingRate,
      celula: (g) => <span className="font-mono tabular"><span className="text-fg">{formatarPercentual(g.currentRate, 1)}</span> <span className="text-subtle">/ {formatarPercentual(g.targetRecyclingRate)}</span></span>,
    },
    {
      key: 'kg', cabecalho: 'Volume', ordenar: (g) => g.targetKg,
      celula: (g) => <span className="font-mono tabular"><span className="text-fg">{formatarKg(g.currentKg)}</span> <span className="text-subtle">/ {formatarKg(g.targetKg)}</span></span>,
    },
    {
      key: 'progress', cabecalho: 'Progresso', ordenar: (g) => g.progress,
      celula: (g) => (
        <span className="flex min-w-32 items-center gap-2.5">
          <Medidor value={g.progress} tone={g.progress >= 1 ? 'brand' : g.progress >= 0.5 ? 'brand' : 'warning'} label={`Progresso de ${g.title}`} />
          <span className="shrink-0 font-mono text-[12px] text-muted tabular">{formatarPercentual(g.progress)}</span>
        </span>
      ),
    },
    { key: 'act', cabecalho: <span className="sr-only">Ações</span>, alinhamento: 'right', celular: 'row', celula: (g) => <BotaoIcone icon={Pencil} size="sm" label={`Editar ${g.title}`} onClick={() => setEditando(g)} /> },
  ];
  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-[13.5px] text-muted">Metas anuais da cidade até 2050, acompanhadas no painel de impacto.</p>
        <Botao size="sm" variant="secondary" iconeEsquerda={Plus} onClick={() => setEditando('new')}>Nova meta</Botao>
      </div>
      <TabelaAdmin legenda="Metas" colunas={colunas} linhas={q.data} chaveLinha={(g) => g.id} carregando={q.isPending} erro={q.error} aoTentarDeNovo={q.refetch}
        ordemPadrao={{ key: 'year', direcao: 'asc' }}
        vazio={<EstadoVazio compacto icon={Flag} title="Nenhuma meta" />} />
      {editando && <FormMeta key={editando === 'new' ? 'new' : editando.id} meta={editando === 'new' ? null : editando} onClose={() => setEditando(null)} />}
    </>
  );
}

const esquemaMeta = z.object({
  year: z.number({ invalid_type_error: 'Informe o ano', required_error: 'Informe o ano' }).int('Ano inteiro').min(2024, 'A partir de 2024').max(2100, 'Até 2100'),
  title: z.string().trim().min(3, 'Mínimo de 3 caracteres').max(120, 'Máximo de 120 caracteres'),
  ratePct: z.number({ invalid_type_error: 'Informe a taxa', required_error: 'Informe a taxa' }).min(0).max(100, 'Máximo de 100%'),
  targetKg: z.number({ invalid_type_error: 'Informe o volume', required_error: 'Informe o volume' }).min(0).max(1_000_000_000),
});

function FormMeta({ meta, onClose }: { meta: Goal | null; onClose: () => void }) {
  const salvar = useSalvarMeta();
  const formulario = useForm<z.infer<typeof esquemaMeta>>({
    resolver: zodResolver(esquemaMeta),
    defaultValues: meta
      ? { year: meta.year, title: meta.title, ratePct: Math.round(meta.targetRecyclingRate * 1000) / 10, targetKg: meta.targetKg }
      : { year: new Date().getFullYear() + 1, title: '', ratePct: undefined, targetKg: undefined },
  });
  const { errors: erros, isSubmitting: enviando } = formulario.formState;
  return (
    <Modal open onClose={onClose} size="md" fecharAoClicarFora={false} title={meta ? 'Editar meta' : 'Nova meta'}
      rodape={<><Botao variant="ghost" onClick={onClose}>Cancelar</Botao><Botao type="submit" form="goal-form" carregando={enviando}>Salvar meta</Botao></>}>
      <form id="goal-form" noValidate className="space-y-4" onSubmit={formulario.handleSubmit(async (v) => {
        try {
          const g = await salvar.mutateAsync({ id: meta?.id, body: { year: v.year, title: v.title.trim(), targetRecyclingRate: Math.round(v.ratePct * 10) / 1000, targetKg: v.targetKg } });
          toast.success(`Meta ${g.year} salva.`);
          onClose();
        } catch (e) { aplicarErrosDoServidor(e, formulario.setError, { fieldMap: { targetRecyclingRate: 'ratePct' } }); }
      })}>
        <ErroFormulario erro={erros.root?.server} />
        <div className="grid grid-cols-[120px_1fr] gap-3">
          <Campo label="Ano" required erro={erros.year}>
            <FormNumber control={formulario.control} name="year" casasDecimais={0} min={2024} max={2100} />
          </Campo>
          <Campo label="Título" required erro={erros.title}><CampoTexto {...formulario.register('title')} maxLength={120} placeholder="Reciclar metade do lixo" /></Campo>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Campo label="Taxa de reciclagem" required erro={erros.ratePct}>
            <FormNumber control={formulario.control} name="ratePct" casasDecimais={1} min={0} max={100} unidade="%" />
          </Campo>
          <Campo label="Volume reciclado" required erro={erros.targetKg}>
            <FormNumber control={formulario.control} name="targetKg" casasDecimais={0} min={0} max={1_000_000_000} unidade="kg" />
          </Campo>
        </div>
      </form>
    </Modal>
  );
}
