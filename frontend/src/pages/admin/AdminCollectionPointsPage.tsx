import { useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Clock, MapPinned, Pencil, Plus, Trash2 } from 'lucide-react';
import { aplicarErrosDoServidor } from '@/api/forms';
import { mensagemDeErro } from '@/api/client';
import { useEcopontosAdmin, useCategorias, useExcluirEcoponto, useSalvarEcoponto } from '@/api/queries';
import type { CategoryCode, CollectionPoint } from '@/api/types';
import { Botao, DialogoConfirmacao, EstadoVazio, EstadoErro, Campo, ErroFormulario, BotaoIcone, CampoTexto, Modal, CabecalhoPagina, Esqueleto, Interruptor, toast } from '@/components/ui';
import { DotMarker, LocationPicker, MapView, type LatLngTuple } from '@/components/map';
import { cn } from '@/lib/cn';
import { categoriaPadrao } from '@/lib/labels';
import { CampoBusca, Segmentado } from '@/features/admin/ui';
import { SeletorCategorias, FormNumber } from '@/features/admin/formControls';

type FiltroSituacao = 'ALL' | 'ACTIVE' | 'INACTIVE';
const HORARIOS_PRONTOS = ['Seg a sex, 8h às 17h', 'Seg a sáb, 8h às 18h', 'Todos os dias, 24 horas', 'Seg a sex, 7h às 19h; sáb, 8h às 12h'];

// Cadastro dos ecopontos que aparecem no mapa dos moradores.
export default function PaginaEcopontos() {
  const ecopontos = useEcopontosAdmin();
  const categorias = useCategorias();
  const excluir = useExcluirEcoponto();
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<FiltroSituacao>('ALL');
  const [categoria, setCategoria] = useState<CategoryCode | 'ALL'>('ALL');
  const [editando, setEditando] = useState<CollectionPoint | 'new' | null>(null);
  const [removendo, setRemovendo] = useState<CollectionPoint | null>(null);
  const [emFoco, setEmFoco] = useState<string | null>(null);

  const cores = useMemo(() => Object.fromEntries((categorias.data ?? []).map((c) => [c.code, c.color])) as Partial<Record<CategoryCode, string>>, [categorias.data]);

  const linhas = useMemo(() => {
    const s = busca.trim().toLocaleLowerCase('pt-BR');
    return (ecopontos.data ?? []).filter((p) =>
      (filtro === 'ALL' || (filtro === 'ACTIVE' ? p.active : !p.active))
      && (categoria === 'ALL' || p.categories.includes(categoria))
      && (!s || [p.name, p.address, p.neighborhood].some((x) => x.toLocaleLowerCase('pt-BR').includes(s))),
    ).sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name, 'pt-BR'));
  }, [ecopontos.data, filtro, categoria, busca]);

  const contagens = useMemo(() => ({
    ALL: ecopontos.data?.length ?? 0, ACTIVE: ecopontos.data?.filter((p) => p.active).length ?? 0, INACTIVE: ecopontos.data?.filter((p) => !p.active).length ?? 0,
  }), [ecopontos.data]);

  const limites = useMemo<LatLngTuple[]>(() => linhas.map((p) => [p.latitude, p.longitude]), [linhas]);

  const confirmarExclusao = () => {
    const p = removendo!;
    excluir.mutate(p.id, {
      onSuccess: () => { toast.success(`Ecoponto “${p.name}” removido.`); setRemovendo(null); },
      onError: (e) => toast.error(mensagemDeErro(e)),
    });
  };

  return (
    <>
      <CabecalhoPagina
        sobretitulo="Administração"
        title="Ecopontos"
        description="Pontos de entrega voluntária exibidos no mapa dos moradores: localização, materiais aceitos e horário."
        acoes={<Botao iconeEsquerda={Plus} onClick={() => setEditando('new')}>Novo ecoponto</Botao>}
      />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Segmentado<FiltroSituacao> label="Situação" value={filtro} onChange={setFiltro}
            opcoes={[{ value: 'ALL', label: 'Todos', contagem: contagens.ALL }, { value: 'ACTIVE', label: 'Ativos', contagem: contagens.ACTIVE }, { value: 'INACTIVE', label: 'Inativos', contagem: contagens.INACTIVE }]} />
          <select value={categoria} onChange={(e) => setCategoria(e.target.value as CategoryCode | 'ALL')} aria-label="Filtrar por material"
            className="h-9 cursor-pointer rounded-[10px] border border-line bg-bg-deep/60 px-3 text-[13px] text-fg-soft focus:outline-none [&>option]:bg-surface">
            <option value="ALL">Todos os materiais</option>
            {Object.entries(categoriaPadrao).map(([c, m]) => <option key={c} value={c}>{m.name}</option>)}
          </select>
        </div>
        <CampoBusca value={busca} onChange={setBusca} placeholder="Buscar nome, endereço ou bairro" className="w-full lg:w-80" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <section aria-label="Lista de ecopontos" className="surface min-w-0 overflow-hidden rounded-2xl lg:max-h-[640px] lg:overflow-y-auto" data-lenis-prevent>
          {ecopontos.error && !ecopontos.data ? <EstadoErro erro={ecopontos.error} aoTentarDeNovo={ecopontos.refetch} compacto />
            : ecopontos.isPending ? (
              <div className="divide-y divide-line" role="status" aria-label="Carregando">
                {Array.from({ length: 6 }, (_, i) => <div key={i} className="space-y-2 p-4"><Esqueleto className="h-4 w-1/2" /><Esqueleto className="h-3 w-3/4" /></div>)}
              </div>
            ) : !linhas.length ? (
              <EstadoVazio compacto icon={MapPinned} title="Nenhum ecoponto" description={busca || categoria !== 'ALL' || filtro !== 'ALL' ? 'Ajuste os filtros.' : 'Cadastre o primeiro ponto de entrega.'} />
            ) : (
              <ul className="divide-y divide-line/70">
                {linhas.map((p) => (
                  <li key={p.id} onMouseEnter={() => setEmFoco(p.id)} onMouseLeave={() => setEmFoco(null)}
                    className={cn('group flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-white/[0.02]', !p.active && 'opacity-60')}>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2">
                        <span className="truncate text-[14px] font-medium text-fg">{p.name}</span>
                        {!p.active && <span className="rounded border border-line-strong px-1.5 text-[11px] text-muted">Inativo</span>}
                      </p>
                      <p className="mt-0.5 truncate text-[12.5px] text-muted">{p.address} · {p.neighborhood}</p>
                      <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-subtle">
                        <span className="inline-flex items-center gap-1"><Clock className="size-3" aria-hidden />{p.openingHours}</span>
                        <span className="inline-flex items-center gap-1" aria-label={`Aceita: ${p.categories.map((c) => categoriaPadrao[c].name).join(', ')}`}>
                          {p.categories.map((c) => <span key={c} title={categoriaPadrao[c].name} className="size-2 rounded-full" style={{ backgroundColor: cores[c] ?? categoriaPadrao[c].color }} />)}
                        </span>
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-0.5">
                      <BotaoIcone icon={Pencil} size="sm" label={`Editar ${p.name}`} onClick={() => setEditando(p)} onFocus={() => setEmFoco(p.id)} />
                      <BotaoIcone icon={Trash2} size="sm" variant="danger" label={`Excluir ${p.name}`} onClick={() => setRemovendo(p)} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
        </section>

        <div className="min-w-0">
          <MapView className="h-[380px] rounded-2xl border border-line lg:sticky lg:top-[calc(var(--header-h)+16px)] lg:h-[640px]" bounds={limites} ariaLabel="Mapa de ecopontos">
            {linhas.map((p) => (
              <DotMarker key={p.id} position={[p.latitude, p.longitude]} cor={p.active ? '#34d399' : '#7d8680'} selecionado={emFoco === p.id} size={13}
                label={p.name} tooltip={<span><b className="font-medium text-fg">{p.name}</b><br />{p.neighborhood}</span>} onClick={() => setEditando(p)} />
            ))}
          </MapView>
        </div>
      </div>

      <FormEcoponto key={editando === 'new' ? 'new' : editando?.id ?? 'none'} ecoponto={editando} onClose={() => setEditando(null)} cores={cores}
        contexto={(ecopontos.data ?? []).filter((p) => editando === 'new' || p.id !== (editando as CollectionPoint | null)?.id).map((p) => [p.latitude, p.longitude] as LatLngTuple)} />

      <DialogoConfirmacao open={!!removendo} onClose={() => setRemovendo(null)} aoConfirmar={confirmarExclusao} carregando={excluir.isPending} tone="danger"
        title="Excluir ecoponto?" rotuloConfirmar="Excluir"
        description={`“${removendo?.name}” deixa de aparecer no mapa dos moradores. Se houver descartes vinculados, ele é apenas desativado para preservar o histórico.`} />
    </>
  );
}

const esquema = z.object({
  name: z.string().trim().min(3, 'Mínimo de 3 caracteres').max(120, 'Máximo de 120 caracteres'),
  address: z.string().trim().min(5, 'Mínimo de 5 caracteres').max(200, 'Máximo de 200 caracteres'),
  neighborhood: z.string().trim().min(2, 'Informe o bairro').max(80, 'Máximo de 80 caracteres'),
  latitude: z.number({ invalid_type_error: 'Informe a latitude', required_error: 'Informe a latitude' }).min(-90, 'Entre -90 e 90').max(90, 'Entre -90 e 90'),
  longitude: z.number({ invalid_type_error: 'Informe a longitude', required_error: 'Informe a longitude' }).min(-180, 'Entre -180 e 180').max(180, 'Entre -180 e 180'),
  openingHours: z.string().trim().min(3, 'Informe o horário').max(120, 'Máximo de 120 caracteres'),
  categories: z.array(z.enum(['PLASTICO', 'PAPEL', 'VIDRO', 'METAL', 'ORGANICO', 'ELETRONICO', 'REJEITO'])).min(1, 'Selecione ao menos um material'),
  active: z.boolean(),
});
type Valores = z.infer<typeof esquema>;

function FormEcoponto({ ecoponto, onClose, cores, contexto }: {
  ecoponto: CollectionPoint | 'new' | null; onClose: () => void; cores: Partial<Record<CategoryCode, string>>; contexto: LatLngTuple[];
}) {
  const salvar = useSalvarEcoponto();
  const existente = ecoponto && ecoponto !== 'new' ? ecoponto : null;
  const formulario = useForm<Valores>({
    resolver: zodResolver(esquema),
    defaultValues: existente
      ? { name: existente.name, address: existente.address, neighborhood: existente.neighborhood, latitude: existente.latitude, longitude: existente.longitude, openingHours: existente.openingHours, categories: existente.categories, active: existente.active }
      : { name: '', address: '', neighborhood: '', latitude: undefined, longitude: undefined, openingHours: '', categories: [], active: true },
  });
  const { errors: erros, isSubmitting: enviando } = formulario.formState;
  const lat = formulario.watch('latitude');
  const lon = formulario.watch('longitude');

  const enviar = formulario.handleSubmit(async (v) => {
    try {
      const salvo = await salvar.mutateAsync({ id: existente?.id, body: { ...v, name: v.name.trim(), address: v.address.trim(), neighborhood: v.neighborhood.trim(), openingHours: v.openingHours.trim() } });
      toast.success(existente ? `“${salvo.name}” atualizado.` : `“${salvo.name}” cadastrado.`);
      onClose();
    } catch (e) { aplicarErrosDoServidor(e, formulario.setError); }
  });

  return (
    <Modal open={!!ecoponto} onClose={onClose} size="xl" fecharAoClicarFora={false}
      title={existente ? 'Editar ecoponto' : 'Novo ecoponto'}
      description="Clique no mapa para posicionar o ponto; as coordenadas também podem ser digitadas."
      rodape={
        <>
          <Botao variant="ghost" onClick={onClose}>Cancelar</Botao>
          <Botao type="submit" form="point-form" carregando={enviando}>{existente ? 'Salvar alterações' : 'Cadastrar ecoponto'}</Botao>
        </>
      }>
      <form id="point-form" noValidate onSubmit={enviar} className="grid gap-5 md:grid-cols-2">
        <div className="space-y-4">
          <ErroFormulario erro={erros.root?.server} />
          <Campo label="Nome" required erro={erros.name}><CampoTexto {...formulario.register('name')} maxLength={120} placeholder="Ecoponto Jardim Maria Rosa" /></Campo>
          <Campo label="Endereço" required erro={erros.address}><CampoTexto {...formulario.register('address')} maxLength={200} placeholder="Rua, número" /></Campo>
          <Campo label="Bairro" required erro={erros.neighborhood}><CampoTexto {...formulario.register('neighborhood')} maxLength={80} /></Campo>
          <Campo label="Horário de funcionamento" required erro={erros.openingHours}>
            <CampoTexto {...formulario.register('openingHours')} maxLength={120} list="hours-presets" placeholder="Seg a sex, 8h às 17h" />
          </Campo>
          <datalist id="hours-presets">{HORARIOS_PRONTOS.map((h) => <option key={h} value={h} />)}</datalist>
          <Campo label="Materiais aceitos" required erro={erros.categories?.message ?? erros.categories?.root?.message}>
            {(a11y) => (
              <Controller control={formulario.control} name="categories"
                render={({ field }) => <SeletorCategorias {...a11y} value={field.value} onChange={field.onChange} cores={cores} />} />
            )}
          </Campo>
          <Controller control={formulario.control} name="active"
            render={({ field }) => <Interruptor checked={field.value} onChange={field.onChange} label="Ativo" description="Inativos não aparecem para os moradores." />} />
        </div>
        <div className="space-y-3">
          <LocationPicker
            className="h-72 md:h-[360px]"
            value={lat != null && lon != null ? { latitude: lat, longitude: lon } : null}
            invalido={!!(erros.latitude || erros.longitude)}
            referencias={contexto}
            onChange={(p) => {
              formulario.setValue('latitude', p.latitude, { shouldValidate: true, shouldDirty: true });
              formulario.setValue('longitude', p.longitude, { shouldValidate: true, shouldDirty: true });
            }}
          />
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Latitude" required erro={erros.latitude}>
              <FormNumber control={formulario.control} name="latitude" casasDecimais={6} min={-90} max={90} step={0.001} permitirNegativo tamanhoCampo="sm" />
            </Campo>
            <Campo label="Longitude" required erro={erros.longitude}>
              <FormNumber control={formulario.control} name="longitude" casasDecimais={6} min={-180} max={180} step={0.001} permitirNegativo tamanhoCampo="sm" />
            </Campo>
          </div>
        </div>
      </form>
    </Modal>
  );
}
