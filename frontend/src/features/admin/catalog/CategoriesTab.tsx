import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Pencil, Plus, Shapes } from 'lucide-react';
import { aplicarErrosDoServidor } from '@/api/forms';
import { useCategorias, useSalvarCategoria } from '@/api/queries';
import type { Category, CategoryCode } from '@/api/types';
import { Etiqueta, Botao, EstadoVazio, Campo, ErroFormulario, BotaoIcone, CampoTexto, Modal, Selecao, Interruptor, AreaTexto, Dica, toast } from '@/components/ui';
import { IconeCategoria } from '@/components/CategoryIcon';
import { cn } from '@/lib/cn';
import { formatarNumero } from '@/lib/format';
import { CODIGOS_CATEGORIA, categoriaPadrao } from '@/lib/labels';
import { TabelaAdmin, type ColunaAdmin } from '../ui';
import { SeletorCor, SeletorIcone, EditorLista, FormNumber } from '../formControls';

// Aba do catálogo: categorias de material, com pontos por kg, limite de kg por descarte e fator de CO2.
export function AbaCategorias() {
  const q = useCategorias({ all: true });
  const [editando, setEditando] = useState<Category | 'new' | null>(null);
  const usados = new Set(q.data?.map((c) => c.code));
  const livres = CODIGOS_CATEGORIA.filter((c) => !usados.has(c));

  const colunas: ColunaAdmin<Category>[] = [
    {
      key: 'name', cabecalho: 'Categoria', celular: 'title', ordenar: (c) => c.name,
      celula: (c) => (
        <span className="flex items-center gap-3">
          <IconeCategoria icon={c.icon} cor={c.color} codigo={c.code} size="sm" />
          <span className="min-w-0">
            <span className="block font-medium text-fg">{c.name}</span>
            <span className="block font-mono text-[11px] text-subtle">{c.code}</span>
          </span>
        </span>
      ),
    },
    { key: 'status', cabecalho: 'Situação', celular: 'aside', ordenar: (c) => Number(c.active), celula: (c) => c.active ? <Etiqueta tone="success" ponto>Ativa</Etiqueta> : <Etiqueta ponto>Inativa</Etiqueta> },
    { key: 'pts', cabecalho: 'Pontos/kg', alinhamento: 'right', ordenar: (c) => c.pointsPerKg, celula: (c) => <span className="font-mono tabular">{formatarNumero(c.pointsPerKg)}</span> },
    { key: 'co2', cabecalho: 'CO₂/kg', alinhamento: 'right', ordenar: (c) => c.co2FactorKg, celula: (c) => <span className="font-mono tabular">{formatarNumero(c.co2FactorKg, 2)} kg</span> },
    { key: 'max', cabecalho: 'Máx. por descarte', alinhamento: 'right', ordenar: (c) => c.maxKgPerDisposal, celula: (c) => <span className="font-mono tabular">{formatarNumero(c.maxKgPerDisposal, 1)} kg</span> },
    { key: 'rec', cabecalho: 'Reciclável', ordenar: (c) => Number(c.recyclable), celula: (c) => <span className={c.recyclable ? 'text-fg-soft' : 'text-subtle'}>{c.recyclable ? 'Sim' : 'Não'}</span> },
    { key: 'guid', cabecalho: 'Orientações', alinhamento: 'right', celular: 'hidden', celula: (c) => <span className="font-mono text-muted tabular">{c.guidance.length}</span> },
    { key: 'act', cabecalho: <span className="sr-only">Ações</span>, alinhamento: 'right', celular: 'row', celula: (c) => <BotaoIcone icon={Pencil} size="sm" label={`Editar ${c.name}`} onClick={() => setEditando(c)} /> },
  ];

  const botaoNova = <Botao size="sm" variant="secondary" iconeEsquerda={Plus} disabled={!livres.length} onClick={() => setEditando('new')}>Nova categoria</Botao>;
  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-[13.5px] text-muted">Pontuação, fator de CO₂ e orientações de descarte de cada material.</p>
        {livres.length ? botaoNova : <Dica conteudo="Todos os 7 códigos de material já têm categoria. Edite uma existente.">{botaoNova}</Dica>}
      </div>
      <TabelaAdmin legenda="Categorias" colunas={colunas} linhas={q.data} chaveLinha={(c) => c.id} carregando={q.isPending} erro={q.error} aoTentarDeNovo={q.refetch}
        classeLinha={(c) => cn(!c.active && 'opacity-60')}
        vazio={<EstadoVazio compacto icon={Shapes} title="Nenhuma categoria" />} />
      {editando && <FormCategoria key={editando === 'new' ? 'new' : editando.id} categoria={editando === 'new' ? null : editando} codigosLivres={livres} onClose={() => setEditando(null)} />}
    </>
  );
}

const esquema = z.object({
  code: z.enum(['PLASTICO', 'PAPEL', 'VIDRO', 'METAL', 'ORGANICO', 'ELETRONICO', 'REJEITO'], { errorMap: () => ({ message: 'Escolha o código' }) }),
  name: z.string().trim().min(2, 'Mínimo de 2 caracteres').max(60, 'Máximo de 60 caracteres'),
  description: z.string().trim().max(500, 'Máximo de 500 caracteres'),
  guidance: z.array(z.string().trim().min(1).max(300)).max(12, 'Até 12 orientações'),
  pointsPerKg: z.number({ invalid_type_error: 'Informe os pontos', required_error: 'Informe os pontos' }).int('Use um número inteiro').min(0).max(1000, 'Máximo de 1.000'),
  co2FactorKg: z.number({ invalid_type_error: 'Informe o fator', required_error: 'Informe o fator' }).min(0).max(50, 'Máximo de 50'),
  maxKgPerDisposal: z.number({ invalid_type_error: 'Informe o limite', required_error: 'Informe o limite' }).min(0.1, 'Mínimo de 0,1 kg').max(1000, 'Máximo de 1.000 kg'),
  recyclable: z.boolean(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Use o formato #RRGGBB'),
  icon: z.string().min(1, 'Escolha um ícone').max(40),
  active: z.boolean(),
});
type Valores = z.infer<typeof esquema>;

function FormCategoria({ categoria, codigosLivres, onClose }: { categoria: Category | null; codigosLivres: CategoryCode[]; onClose: () => void }) {
  const salvar = useSalvarCategoria();
  const primeiro = codigosLivres[0] ?? 'PLASTICO';
  const formulario = useForm<Valores>({
    resolver: zodResolver(esquema),
    defaultValues: categoria
      ? { code: categoria.code, name: categoria.name, description: categoria.description, guidance: categoria.guidance, pointsPerKg: categoria.pointsPerKg, co2FactorKg: categoria.co2FactorKg, maxKgPerDisposal: categoria.maxKgPerDisposal, recyclable: categoria.recyclable, color: categoria.color.toUpperCase(), icon: categoria.icon, active: categoria.active }
      : { code: primeiro, name: categoriaPadrao[primeiro].name, description: '', guidance: [], pointsPerKg: 10, co2FactorKg: 1, maxKgPerDisposal: 20, recyclable: true, color: categoriaPadrao[primeiro].color.toUpperCase(), icon: categoriaPadrao[primeiro].icon, active: true },
  });
  const { errors: erros, isSubmitting: enviando } = formulario.formState;
  const [cor, icone, nome, codigo] = formulario.watch(['color', 'icon', 'name', 'code']);

  const enviar = formulario.handleSubmit(async (v) => {
    try {
      const salva = await salvar.mutateAsync({ id: categoria?.id, body: { ...v, name: v.name.trim(), description: v.description.trim(), guidance: v.guidance.map((g) => g.trim()).filter(Boolean) } });
      toast.success(categoria ? `Categoria “${salva.name}” atualizada.` : `Categoria “${salva.name}” criada.`);
      onClose();
    } catch (e) { aplicarErrosDoServidor(e, formulario.setError); }
  });

  return (
    <Modal open onClose={onClose} size="xl" fecharAoClicarFora={false} title={categoria ? 'Editar categoria' : 'Nova categoria'}
      rodape={<><Botao variant="ghost" onClick={onClose}>Cancelar</Botao><Botao type="submit" form="cat-form" carregando={enviando}>Salvar categoria</Botao></>}>
      <form id="cat-form" noValidate onSubmit={enviar} className="grid gap-x-6 gap-y-5 md:grid-cols-2">
        <ErroFormulario erro={erros.root?.server} className="md:col-span-2" />
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-xl border border-line p-3">
            <IconeCategoria icon={icone} cor={/^#[0-9a-f]{6}$/i.test(cor) ? cor : undefined} codigo={codigo} size="lg" />
            <div className="min-w-0">
              <p className="font-medium text-fg">{nome || 'Sem nome'}</p>
              <p className="font-mono text-[11px] text-subtle">{codigo} · pré-visualização</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Código" required erro={erros.code} dica={categoria ? 'Não pode ser alterado' : undefined}>
              <Selecao {...formulario.register('code')} disabled={!!categoria}
                opcoes={(categoria ? [categoria.code] : codigosLivres).map((c) => ({ value: c, label: `${c} · ${categoriaPadrao[c].name}` }))} />
            </Campo>
            <Campo label="Nome" required erro={erros.name}><CampoTexto {...formulario.register('name')} maxLength={60} /></Campo>
          </div>
          <Campo label="Descrição" opcional erro={erros.description}><AreaTexto {...formulario.register('description')} maxLength={500} rows={2} /></Campo>
          <div className="grid grid-cols-3 gap-3">
            <Campo label="Pontos por kg" required erro={erros.pointsPerKg}>
              <FormNumber control={formulario.control} name="pointsPerKg" casasDecimais={0} min={0} max={1000} />
            </Campo>
            <Campo label="CO₂ evitado/kg" required erro={erros.co2FactorKg}>
              <FormNumber control={formulario.control} name="co2FactorKg" casasDecimais={2} min={0} max={50} unidade="kg" />
            </Campo>
            <Campo label="Máx. por descarte" required erro={erros.maxKgPerDisposal}>
              <FormNumber control={formulario.control} name="maxKgPerDisposal" casasDecimais={1} min={0.1} max={1000} unidade="kg" />
            </Campo>
          </div>
          <div className="flex flex-wrap gap-6">
            <Controller control={formulario.control} name="recyclable" render={({ field }) => <Interruptor checked={field.value} onChange={field.onChange} label="Reciclável" />} />
            <Controller control={formulario.control} name="active" render={({ field }) => <Interruptor checked={field.value} onChange={field.onChange} label="Ativa" description="Inativas somem do registro de descarte." />} />
          </div>
        </div>
        <div className="space-y-4">
          <Campo label="Cor" required erro={erros.color}>
            {(a11y) => <Controller control={formulario.control} name="color" render={({ field }) => <SeletorCor {...a11y} value={field.value} onChange={field.onChange} />} />}
          </Campo>
          <Campo label="Ícone" required erro={erros.icon}>
            {(a11y) => <Controller control={formulario.control} name="icon" render={({ field }) => <SeletorIcone {...a11y} value={field.value} onChange={field.onChange} cor={cor} />} />}
          </Campo>
          <Campo label="Orientações de descarte" erro={erros.guidance?.message ?? erros.guidance?.root?.message}>
            {(a11y) => <Controller control={formulario.control} name="guidance" render={({ field }) => <EditorLista {...a11y} value={field.value} onChange={field.onChange} placeholder="Ex.: Lave e seque as embalagens" />} />}
          </Campo>
        </div>
      </form>
    </Modal>
  );
}
