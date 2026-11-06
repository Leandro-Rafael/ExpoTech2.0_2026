import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertTriangle, Cpu, Crown, LogOut, Plus, Radio, Trash2 } from 'lucide-react';
import { aplicarErrosDoServidor, mensagemDeErro } from '@/api';
import {
  useCategorias, useCriarLixeira, useExcluirLixeira, useResidencia, useLixeirasResidencia, useSairResidencia, useEnviarLeituraLixeira,
} from '@/api/queries';
import type { Household, SmartBin, SmartBinCreated } from '@/api/types';
import { useUsuario } from '@/auth/AuthProvider';
import {
  Avatar, Botao, DialogoConfirmacao, EstadoVazio, EstadoErro, Campo, ErroFormulario, BotaoIcone, CampoTexto, Modal, CampoNumero,
  CabecalhoPagina, EsqueletoPagina, Selecao, EsqueletoCartao, CartaoIndicador, toast,
} from '@/components/ui';
import { ConfigurarResidencia } from '@/features/resident/home/SetupHousehold';
import { PainelLixeira, BotaoCopiar, TituloSecao } from '@/features/resident/shared';
import { formatarKg, formatarNumero } from '@/lib/format';

// "Minha casa": residência do morador e suas lixeiras inteligentes (que pedem coleta sozinhas quando enchem).
export default function PaginaCasa() {
  const q = useResidencia();
  if (q.isPending) return <EsqueletoPagina />;
  if (q.error) return (<><CabecalhoPagina sobretitulo="Smart Home 2050" title="Minha casa" /><EstadoErro erro={q.error} aoTentarDeNovo={q.refetch} /></>);
  if (!q.data) {
    return (
      <>
        <CabecalhoPagina sobretitulo="Smart Home 2050" title="Sua casa, conectada à reciclagem"
          description="Uma residência reúne quem mora junto: pontos somados, ranking próprio e lixeiras inteligentes que pedem a coleta sozinhas." />
        <ConfigurarResidencia />
      </>
    );
  }
  return <VisaoResidencia h={q.data} />;
}

function VisaoResidencia({ h }: { h: Household }) {
  const usuario = useUsuario();
  const lixeiras = useLixeirasResidencia(true, 20_000);
  const [adicionando, setAdicionando] = useState(false);
  const [criada, setCriada] = useState<SmartBinCreated | null>(null);
  const [removendo, setRemovendo] = useState<SmartBin | null>(null);
  const [saindo, setSaindo] = useState(false);
  const excluir = useExcluirLixeira();
  const sair = useSairResidencia();
  const ehResponsavel = h.members.some((m) => m.id === usuario.id && m.isOwner);
  const emAtencao = lixeiras.data?.filter((b) => b.status === 'FULL' || b.status === 'ATTENTION').length ?? 0;
  const moradores = [...h.members].sort((a, b) => b.points - a.points);

  return (
    <>
      <CabecalhoPagina sobretitulo="Smart Home 2050" title={h.name} description={`${h.neighborhood} · ${h.city} · ${h.members.length} ${h.members.length === 1 ? 'morador' : 'moradores'}`}
        acoes={<Botao size="lg" iconeEsquerda={Plus} onClick={() => setAdicionando(true)}>Adicionar lixeira</Botao>} />

      <section aria-label="Números da casa" className="grid grid-cols-2 divide-line border-y border-line lg:grid-cols-4 lg:divide-x [&>*]:py-5 lg:[&>*:not(:first-child)]:pl-6">
        <CartaoIndicador variant="plain" label="Total reciclado" value={h.stats.totalKg} formato={(v) => formatarKg(v)} dica="desde a criação" />
        <CartaoIndicador variant="plain" label="Este mês" value={h.stats.monthKg} formato={(v) => formatarKg(v)} dica="soma dos moradores" />
        <CartaoIndicador variant="plain" label="Pontos da casa" value={h.stats.points} dica="ranking de residências" />
        <CartaoIndicador variant="plain" label="CO₂ evitado" value={h.stats.co2AvoidedKg} formato={(v) => formatarKg(v)} dica="emissões que não ocorreram" />
      </section>

      <section aria-labelledby="bins-h" className="mt-12">
        <TituloSecao id="bins-h" title="Lixeiras inteligentes"
          description={lixeiras.data?.length
            ? `${emAtencao ? `${emAtencao} ${emAtencao === 1 ? 'precisa' : 'precisam'} de atenção. ` : 'Tudo em ordem. '}Ao passar da marca de limite, a coleta é pedida automaticamente. Atualiza a cada 20 s.`
            : 'Sensores de nível e bateria em cada lixeira da casa.'}
          acao={lixeiras.isFetching && !lixeiras.isPending ? <span className="inline-flex items-center gap-1.5 text-xs text-subtle"><Radio className="size-3.5 animate-pulse" aria-hidden />atualizando</span> : undefined} />
        {lixeiras.isPending ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((i) => <EsqueletoCartao key={i} linhas={4} />)}</div>
        ) : lixeiras.error ? <EstadoErro erro={lixeiras.error} aoTentarDeNovo={lixeiras.refetch} /> : lixeiras.data.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line-strong">
            <EstadoVazio icon={Cpu} title="Nenhuma lixeira conectada" description="Cadastre uma lixeira para receber o ID e a chave do dispositivo. O sensor envia o nível de enchimento e a bateria."
              acao={<Botao variant="secondary" iconeEsquerda={Plus} onClick={() => setAdicionando(true)}>Adicionar lixeira</Botao>} />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {lixeiras.data.map((b) => (
              <PainelLixeira key={b.id} lixeira={b} acoes={<BotaoIcone icon={Trash2} label={`Remover ${b.name}`} size="sm" variant="ghost" onClick={() => setRemovendo(b)} />} />
            ))}
          </div>
        )}
      </section>

      <div className="mt-14 grid grid-cols-1 gap-12 lg:grid-cols-[1.3fr_1fr]">
        <section aria-labelledby="mem-h">
          <TituloSecao id="mem-h" title="Moradores" description="Pontos acumulados por pessoa." />
          <ul className="divide-y divide-line border-y border-line">
            {moradores.map((m) => (
              <li key={m.id} className="flex items-center gap-3 py-3">
                <Avatar nome={m.name} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 text-sm text-fg">
                    <span className="truncate">{m.name}</span>
                    {m.id === usuario.id && <span className="text-xs text-subtle">(você)</span>}
                    {m.isOwner && <Crown className="size-3.5 text-subtle" aria-label="responsável" />}
                  </span>
                </span>
                <span className="font-mono text-sm text-fg-soft tabular">{formatarNumero(m.points)} pts</span>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="inv-h">
          <TituloSecao id="inv-h" title="Convidar moradores" description="Quem entrar com este código passa a somar pontos para a casa." />
          <div className="flex items-center gap-3 rounded-xl border border-line bg-bg-deep/50 p-3">
            <code className="flex-1 pl-1 font-mono text-xl font-medium tracking-[0.18em] text-fg select-all">{h.inviteCode}</code>
            <BotaoCopiar value={h.inviteCode} label="Copiar código" size="md" />
          </div>
          <button type="button" onClick={() => setSaindo(true)}
            className="mt-10 inline-flex items-center gap-2 text-sm text-muted underline decoration-line-strong underline-offset-4 transition-colors hover:text-danger">
            <LogOut className="size-4" aria-hidden />Sair da residência
          </button>
        </section>
      </div>

      <ModalAdicionarLixeira open={adicionando} onClose={() => setAdicionando(false)} aoCriar={(c) => { setAdicionando(false); setCriada(c); }} />
      <ModalCredenciais criada={criada} onClose={() => setCriada(null)} />

      <DialogoConfirmacao open={!!removendo} onClose={() => setRemovendo(null)} tone="danger" carregando={excluir.isPending}
        title={`Remover ${removendo?.name ?? 'lixeira'}?`}
        description="O dispositivo deixa de enviar leituras e o histórico desta lixeira é apagado. Para reconectar, será preciso cadastrá-la de novo."
        rotuloConfirmar="Remover lixeira"
        aoConfirmar={() => removendo && excluir.mutate(removendo.id, {
          onSuccess: () => { toast.success('Lixeira removida'); setRemovendo(null); },
          onError: (e) => toast.error(mensagemDeErro(e)),
        })} />

      <DialogoConfirmacao open={saindo} onClose={() => setSaindo(false)} tone="danger" carregando={sair.isPending}
        title="Sair da residência?"
        description={ehResponsavel && h.members.length > 1
          ? 'Você é o responsável. Ao sair, outro morador assume a residência. Seus pontos pessoais continuam com você.'
          : ehResponsavel ? 'Você é o único morador: a residência e as lixeiras serão encerradas. Seus pontos pessoais continuam com você.'
            : 'Seus pontos pessoais continuam com você, mas deixam de contar para esta casa.'}
        rotuloConfirmar="Sair"
        aoConfirmar={() => sair.mutate(undefined, {
          onSuccess: () => { toast.success('Você saiu da residência'); setSaindo(false); },
          onError: (e) => toast.error(mensagemDeErro(e)),
        })} />
    </>
  );
}

const esquemaLixeira = z.object({
  name: z.string().trim().min(2, 'Mínimo de 2 caracteres').max(60, 'Máximo de 60 caracteres'),
  categoryId: z.string().min(1, 'Escolha o material'),
  capacityLiters: z.number({ invalid_type_error: 'Informe a capacidade', required_error: 'Informe a capacidade' }).int('Use um número inteiro').min(5, 'Mínimo de 5 L').max(1000, 'Máximo de 1000 L'),
  autoRequestThreshold: z.number({ invalid_type_error: 'Informe o limite', required_error: 'Informe o limite' }).int('Use um número inteiro').min(50, 'Mínimo de 50%').max(100, 'Máximo de 100%'),
});
type ValoresLixeira = z.infer<typeof esquemaLixeira>;

function ModalAdicionarLixeira({ open, onClose, aoCriar }: { open: boolean; onClose: () => void; aoCriar: (c: SmartBinCreated) => void }) {
  const categorias = useCategorias();
  const criar = useCriarLixeira();
  const formulario = useForm<ValoresLixeira>({ resolver: zodResolver(esquemaLixeira), defaultValues: { name: '', categoryId: '', capacityLiters: 50, autoRequestThreshold: 80 } });
  const { register, control, handleSubmit, setError, reset, watch, formState: { errors, isSubmitting } } = formulario;
  const limite = watch('autoRequestThreshold');

  const aoEnviar = handleSubmit(async (v) => {
    try {
      const c = await criar.mutateAsync(v);
      reset();
      aoCriar(c);
    } catch (e) { aplicarErrosDoServidor(e, setError, { knownFields: ['name', 'categoryId', 'capacityLiters', 'autoRequestThreshold'] }); }
  });

  return (
    <Modal open={open} onClose={onClose} title="Adicionar lixeira inteligente" description="Depois de salvar, você recebe o ID e a chave para configurar o sensor."
      rodape={<><Botao variant="ghost" onClick={onClose}>Cancelar</Botao><Botao type="submit" form="bin-form" carregando={isSubmitting}>Cadastrar lixeira</Botao></>}>
      <form id="bin-form" onSubmit={aoEnviar} noValidate className="space-y-5">
        <ErroFormulario erro={errors.root?.server} />
        <Campo label="Nome" required erro={errors.name} dica="Ex.: Recicláveis da cozinha">
          <CampoTexto {...register('name')} autoComplete="off" />
        </Campo>
        <Campo label="Material" required erro={errors.categoryId}>
          <Selecao {...register('categoryId')} disabled={categorias.isPending}>
            <option value="">Selecione…</option>
            {categorias.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Selecao>
        </Campo>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Campo label="Capacidade" required erro={errors.capacityLiters} dica="De 5 a 1000 litros">
            {(a11y) => <Controller control={control} name="capacityLiters" render={({ field }) => (
              <CampoNumero {...field} {...a11y} casasDecimais={0} min={5} max={1000} step={5} unidade="L" invalido={!!errors.capacityLiters} />
            )} />}
          </Campo>
          <Campo label="Pedir coleta em" required erro={errors.autoRequestThreshold} dica="Entre 50% e 100% cheia">
            {(a11y) => <Controller control={control} name="autoRequestThreshold" render={({ field }) => (
              <CampoNumero {...field} {...a11y} casasDecimais={0} min={50} max={100} step={5} unidade="%" invalido={!!errors.autoRequestThreshold} />
            )} />}
          </Campo>
        </div>
        <p className="text-xs leading-relaxed text-subtle">
          Ao atingir {limite ?? 80}% a plataforma cria uma solicitação de coleta para o endereço da casa, sem você precisar fazer nada.
        </p>
      </form>
    </Modal>
  );
}

function ModalCredenciais({ criada, onClose }: { criada: SmartBinCreated | null; onClose: () => void }) {
  const enviar = useEnviarLeituraLixeira();
  const [enviada, setEnviada] = useState<number | null>(null);
  const fechar = () => { setEnviada(null); onClose(); };
  const testar = () => {
    if (!criada) return;
    const nivelTeste = enviada == null ? 35 : Math.min(100, enviada + 30);
    enviar.mutate({ device: { deviceId: criada.deviceId, deviceKey: criada.deviceKey }, reading: { fillLevel: nivelTeste, batteryLevel: 96 } }, {
      onSuccess: () => { setEnviada(nivelTeste); toast.success(`Leitura de ${nivelTeste}% recebida`); },
      onError: (e) => toast.error(mensagemDeErro(e)),
    });
  };
  return (
    <Modal open={!!criada} onClose={fechar} fecharAoClicarFora={false} title={`${criada?.bin.name ?? 'Lixeira'} cadastrada`}
      description="Configure o sensor com as credenciais abaixo."
      rodape={<Botao onClick={fechar}>Já guardei a chave</Botao>}>
      {criada && (
        <div className="space-y-5">
          <div role="alert" className="flex gap-3 rounded-xl border border-warning/30 bg-warning/[0.06] p-3.5 text-sm">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
            <p className="text-fg-soft"><span className="font-medium text-warning">A chave aparece só desta vez.</span> Por segurança ela é guardada com hash e não pode ser exibida de novo.</p>
          </div>
          <Credencial label="ID do dispositivo (X-Device-Id)" value={criada.deviceId} />
          <Credencial label="Chave do dispositivo (X-Device-Key)" value={criada.deviceKey} />
          <div className="border-t border-line pt-4">
            <p className="text-sm text-fg-soft">Testar a conexão</p>
            <p className="mt-0.5 text-xs text-subtle">Envia uma leitura simulada como se fosse o sensor (POST /api/iot/readings).</p>
            <Botao className="mt-3" size="sm" variant="secondary" iconeEsquerda={Radio} carregando={enviar.isPending} onClick={testar}>
              {enviada == null ? 'Enviar leitura de teste' : `Enviar outra (${Math.min(100, enviada + 30)}%)`}
            </Botao>
          </div>
        </div>
      )}
    </Modal>
  );
}

function Credencial({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="label-mono mb-1.5">{label}</p>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-lg border border-line bg-bg-deep px-3 py-2 font-mono text-[13px] text-fg select-all">{value}</code>
        <BotaoCopiar value={value} />
      </div>
    </div>
  );
}
