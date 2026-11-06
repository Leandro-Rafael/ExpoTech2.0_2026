import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Gift, Pencil, Plus } from 'lucide-react';
import { aplicarErrosDoServidor } from '@/api/forms';
import { useRecompensasAdmin, useSalvarRecompensa } from '@/api/queries';
import type { Reward } from '@/api/types';
import { Etiqueta, Botao, EstadoVazio, Campo, ErroFormulario, BotaoIcone, CampoTexto, Modal, Interruptor, AreaTexto, toast } from '@/components/ui';
import { iconePorNome } from '@/components/icons';
import { cn } from '@/lib/cn';
import { formatarNumero } from '@/lib/format';
import { TabelaAdmin, type ColunaAdmin } from '../ui';
import { SeletorIcone, FormNumber } from '../formControls';

// Aba do catálogo: recompensas que os moradores trocam por pontos (custo, estoque, parceiro).
export function AbaRecompensas() {
  const q = useRecompensasAdmin();
  const [editando, setEditando] = useState<Reward | 'new' | null>(null);

  const colunas: ColunaAdmin<Reward>[] = [
    {
      key: 'name', cabecalho: 'Recompensa', celular: 'title', ordenar: (r) => r.name,
      celula: (r) => {
        const Icon = iconePorNome(r.icon, Gift);
        return (
          <span className="flex items-center gap-3">
            <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-line bg-surface-2 text-fg-soft"><Icon className="size-4" aria-hidden /></span>
            <span className="min-w-0">
              <span className="block font-medium text-fg">{r.name}</span>
              <span className="block truncate text-xs text-muted">{r.partner ?? 'Sem parceiro'}</span>
            </span>
          </span>
        );
      },
    },
    { key: 'status', cabecalho: 'Situação', celular: 'aside', ordenar: (r) => Number(r.active), celula: (r) => r.active ? <Etiqueta tone="success" ponto>Ativa</Etiqueta> : <Etiqueta ponto>Inativa</Etiqueta> },
    { key: 'cost', cabecalho: 'Custo', alinhamento: 'right', ordenar: (r) => r.costPoints, celula: (r) => <span className="font-mono tabular">{formatarNumero(r.costPoints)} pts</span> },
    {
      key: 'stock', cabecalho: 'Estoque', alinhamento: 'right', ordenar: (r) => r.stock,
      celula: (r) => <span className={cn('font-mono tabular', r.stock === 0 ? 'text-danger' : r.stock < 10 ? 'text-warning' : '')}>{r.stock === 0 ? 'Esgotado' : formatarNumero(r.stock)}</span>,
    },
    { key: 'act', cabecalho: <span className="sr-only">Ações</span>, alinhamento: 'right', celular: 'row', celula: (r) => <BotaoIcone icon={Pencil} size="sm" label={`Editar ${r.name}`} onClick={() => setEditando(r)} /> },
  ];

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-[13.5px] text-muted">Itens que os moradores trocam por pontos. Inativas não aparecem no catálogo.</p>
        <Botao size="sm" variant="secondary" iconeEsquerda={Plus} onClick={() => setEditando('new')}>Nova recompensa</Botao>
      </div>
      <TabelaAdmin legenda="Recompensas" colunas={colunas} linhas={q.data} chaveLinha={(r) => r.id} carregando={q.isPending} erro={q.error} aoTentarDeNovo={q.refetch}
        ordemPadrao={{ key: 'cost', direcao: 'asc' }} classeLinha={(r) => cn(!r.active && 'opacity-60')}
        vazio={<EstadoVazio compacto icon={Gift} title="Nenhuma recompensa" description="Cadastre a primeira recompensa do catálogo." />} />
      {editando && <FormRecompensa key={editando === 'new' ? 'new' : editando.id} recompensa={editando === 'new' ? null : editando} onClose={() => setEditando(null)} />}
    </>
  );
}

const esquema = z.object({
  name: z.string().trim().min(2, 'Mínimo de 2 caracteres').max(80, 'Máximo de 80 caracteres'),
  description: z.string().trim().max(500, 'Máximo de 500 caracteres'),
  costPoints: z.number({ invalid_type_error: 'Informe o custo', required_error: 'Informe o custo' }).int('Use um número inteiro').min(1, 'Mínimo de 1 ponto').max(1_000_000),
  stock: z.number({ invalid_type_error: 'Informe o estoque', required_error: 'Informe o estoque' }).int('Use um número inteiro').min(0).max(1_000_000),
  icon: z.string().min(1, 'Escolha um ícone'),
  partner: z.string().trim().max(120, 'Máximo de 120 caracteres'),
  active: z.boolean(),
});
type Valores = z.infer<typeof esquema>;

function FormRecompensa({ recompensa, onClose }: { recompensa: Reward | null; onClose: () => void }) {
  const salvar = useSalvarRecompensa();
  const formulario = useForm<Valores>({
    resolver: zodResolver(esquema),
    defaultValues: recompensa
      ? { name: recompensa.name, description: recompensa.description, costPoints: recompensa.costPoints, stock: recompensa.stock, icon: recompensa.icon, partner: recompensa.partner ?? '', active: recompensa.active }
      : { name: '', description: '', costPoints: undefined, stock: undefined, icon: 'gift', partner: '', active: true },
  });
  const { errors: erros, isSubmitting: enviando } = formulario.formState;
  const enviar = formulario.handleSubmit(async (v) => {
    try {
      const salva = await salvar.mutateAsync({ id: recompensa?.id, body: { ...v, name: v.name.trim(), description: v.description.trim(), partner: v.partner.trim() || null } });
      toast.success(recompensa ? `“${salva.name}” atualizada.` : `“${salva.name}” criada.`);
      onClose();
    } catch (e) { aplicarErrosDoServidor(e, formulario.setError); }
  });
  return (
    <Modal open onClose={onClose} size="lg" fecharAoClicarFora={false} title={recompensa ? 'Editar recompensa' : 'Nova recompensa'}
      rodape={<><Botao variant="ghost" onClick={onClose}>Cancelar</Botao><Botao type="submit" form="reward-form" carregando={enviando}>Salvar recompensa</Botao></>}>
      <form id="reward-form" noValidate onSubmit={enviar} className="space-y-4">
        <ErroFormulario erro={erros.root?.server} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo label="Nome" required erro={erros.name}><CampoTexto {...formulario.register('name')} maxLength={80} /></Campo>
          <Campo label="Parceiro" opcional erro={erros.partner}><CampoTexto {...formulario.register('partner')} maxLength={120} /></Campo>
        </div>
        <Campo label="Descrição" opcional erro={erros.description}><AreaTexto {...formulario.register('description')} maxLength={500} rows={2} /></Campo>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo label="Custo" required erro={erros.costPoints}>
            <FormNumber control={formulario.control} name="costPoints" casasDecimais={0} min={1} max={1_000_000} unidade="pts" />
          </Campo>
          <Campo label="Estoque" required erro={erros.stock} dica="0 = esgotado">
            <FormNumber control={formulario.control} name="stock" casasDecimais={0} min={0} max={1_000_000} comBotoes />
          </Campo>
        </div>
        <Campo label="Ícone" required erro={erros.icon}>
          {(a11y) => <Controller control={formulario.control} name="icon" render={({ field }) => <SeletorIcone {...a11y} value={field.value} onChange={field.onChange} />} />}
        </Campo>
        <Controller control={formulario.control} name="active" render={({ field }) => <Interruptor checked={field.value} onChange={field.onChange} label="Ativa" description="Disponível para resgate no catálogo." />} />
      </form>
    </Modal>
  );
}
