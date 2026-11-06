import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CalendarDays, Cpu, Crosshair, LocateFixed, Truck, X } from 'lucide-react';
import { aplicarErrosDoServidor, mensagemDeErro } from '@/api';
import { useCancelarSolicitacaoColeta, useCategorias, useCriarSolicitacaoColeta, useMinhasSolicitacoesColeta } from '@/api/queries';
import type { CategoryCode, CollectionRequest } from '@/api/types';
import { LocationPicker } from '@/components/map';
import {
  Botao, DialogoConfirmacao, EstadoVazio, EstadoErro, Campo, ErroFormulario, CampoTexto, CampoNumero, EsqueletoTexto, PilulaStatus, AreaTexto, toast,
} from '@/components/ui';
import { useGeolocalizacao } from '@/hooks/useGeolocation';
import { cn } from '@/lib/cn';
import { corDaCategoria, hexComAlfa } from '@/lib/category';
import { formatarData, formatarKg, formatarNumero, formatarRelativo, dataHojeISO } from '@/lib/format';
import { categoriaPadrao, CODIGOS_CATEGORIA, statusSolicitacaoColeta, origemColeta } from '@/lib/labels';

function somarDias(iso: string, n: number) {
  const [y, m, d] = iso.split('-').map(Number);
  const data = new Date(y, m - 1, d + n);
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`;
}

const esquema = z.object({
  address: z.string().trim().min(5, 'Informe o endereço (mín. 5 caracteres)').max(200, 'Máximo de 200 caracteres'),
  latitude: z.number({ invalid_type_error: 'Marque o local no mapa', required_error: 'Marque o local no mapa' }).min(-90).max(90),
  longitude: z.number({ invalid_type_error: 'Marque o local no mapa', required_error: 'Marque o local no mapa' }).min(-180).max(180),
  categoryCodes: z.array(z.string()).min(1, 'Escolha ao menos um material'),
  estimatedKg: z.number({ invalid_type_error: 'Informe o peso estimado', required_error: 'Informe o peso estimado' }).min(0.5, 'Mínimo de 0,5 kg').max(2000, 'Máximo de 2.000 kg'),
  preferredDate: z.string().optional(),
  notes: z.string().max(500, 'Máximo de 500 caracteres').optional(),
}).refine((v) => !v.preferredDate || (v.preferredDate >= dataHojeISO() && v.preferredDate <= somarDias(dataHojeISO(), 60)), {
  path: ['preferredDate'], message: 'Escolha uma data entre hoje e os próximos 60 dias',
});
type Valores = z.infer<typeof esquema>;

// Pedido de coleta em casa (volumes grandes). Esses pedidos entram no planejamento de rotas do admin.
export function FormularioSolicitacao({ aoCriar }: { aoCriar: () => void }) {
  const categorias = useCategorias();
  const criar = useCriarSolicitacaoColeta();
  const geo = useGeolocalizacao();
  const formulario = useForm<Valores>({
    resolver: zodResolver(esquema),
    defaultValues: { address: '', latitude: undefined, longitude: undefined, categoryCodes: [], estimatedKg: undefined, preferredDate: '', notes: '' },
  });
  const { register, control, handleSubmit, setValue, setError, watch, reset, formState: { errors, isSubmitting } } = formulario;
  const lat = watch('latitude');
  const lon = watch('longitude');
  const codigos = watch('categoryCodes');

  useEffect(() => {
    if (geo.status === 'success' && geo.latitude != null && geo.longitude != null) {
      setValue('latitude', Math.round(geo.latitude * 1e6) / 1e6, { shouldValidate: true });
      setValue('longitude', Math.round(geo.longitude * 1e6) / 1e6, { shouldValidate: true });
    }
  }, [geo.status, geo.latitude, geo.longitude, setValue]);

  const alternar = (c: CategoryCode) => setValue('categoryCodes', codigos.includes(c) ? codigos.filter((x) => x !== c) : [...codigos, c], { shouldValidate: true });

  const aoEnviar = handleSubmit(async (v) => {
    try {
      await criar.mutateAsync({
        address: v.address, latitude: v.latitude, longitude: v.longitude, categoryCodes: v.categoryCodes as CategoryCode[],
        estimatedKg: Number(v.estimatedKg.toFixed(2)), preferredDate: v.preferredDate || null, notes: v.notes?.trim() || null,
      });
      toast.success('Coleta solicitada! Acompanhe o status em “Minhas solicitações”.');
      reset();
      aoCriar();
    } catch (e) { aplicarErrosDoServidor(e, setError, { knownFields: ['address', 'latitude', 'longitude', 'categoryCodes', 'estimatedKg', 'preferredDate', 'notes'] }); }
  });

  return (
    <form onSubmit={aoEnviar} noValidate className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-12">
      <div className="space-y-5">
        <p className="text-sm leading-relaxed text-muted">Para volumes grandes ou materiais que não cabem na coleta comum (móveis, eletrônicos, entulho reciclável). A coleta entra na rota otimizada do coletor mais próximo.</p>
        <ErroFormulario erro={errors.root?.server} />
        <Campo label="Endereço da coleta" required erro={errors.address}>
          <CampoTexto {...register('address')} autoComplete="street-address" placeholder="Rua, número, complemento" />
        </Campo>
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-fg-soft">Materiais <span className="text-danger">*</span></legend>
          <div className="flex flex-wrap gap-1.5" role="group" aria-invalid={errors.categoryCodes ? true : undefined}>
            {CODIGOS_CATEGORIA.map((code) => {
              const c = categorias.data?.find((x) => x.code === code);
              const ativo = codigos.includes(code);
              const cor = corDaCategoria(code, c?.color);
              return (
                <button key={code} type="button" aria-pressed={ativo} onClick={() => alternar(code)}
                  className={cn('inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm transition-colors', ativo ? 'border-transparent text-fg' : 'border-line text-muted hover:border-line-strong hover:text-fg')}
                  style={ativo ? { backgroundColor: hexComAlfa(cor, 0.12), boxShadow: `inset 0 0 0 1px ${hexComAlfa(cor, 0.5)}` } : undefined}>
                  <span aria-hidden className="size-2 rounded-full" style={{ backgroundColor: cor }} />{c?.name ?? categoriaPadrao[code].name}
                </button>
              );
            })}
          </div>
          {errors.categoryCodes && <p role="alert" className="mt-2 text-sm text-danger">{errors.categoryCodes.message}</p>}
        </fieldset>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Campo label="Peso estimado" required erro={errors.estimatedKg} dica="De 0,5 a 2.000 kg">
            {(a11y) => <Controller control={control} name="estimatedKg" render={({ field }) => (
              <CampoNumero {...field} {...a11y} value={field.value} unidade="kg" casasDecimais={1} min={0.5} max={2000} step={1} invalido={!!errors.estimatedKg} />
            )} />}
          </Campo>
          <Campo label="Data preferida" opcional erro={errors.preferredDate} dica="Até 60 dias">
            <CampoTexto type="date" iconeEsquerda={CalendarDays} min={dataHojeISO()} max={somarDias(dataHojeISO(), 60)} {...register('preferredDate')} />
          </Campo>
        </div>
        <Campo label="Observações" opcional erro={errors.notes}>
          <AreaTexto rows={3} maxLength={500} placeholder="Ex.: portão azul, interfone 12" {...register('notes')} />
        </Campo>
        <Botao type="submit" size="lg" iconeEsquerda={Truck} carregando={isSubmitting}>Solicitar coleta</Botao>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium text-fg-soft">Local exato <span className="text-danger">*</span></p>
          <Botao size="sm" variant="ghost" iconeEsquerda={geo.status === 'loading' ? Crosshair : LocateFixed} carregando={geo.status === 'loading'} onClick={geo.request}>Usar minha localização</Botao>
        </div>
        <LocationPicker className="h-[340px] lg:h-[460px]" invalido={!!errors.latitude}
          value={lat != null && lon != null ? { latitude: lat, longitude: lon } : null}
          onChange={(p) => { setValue('latitude', p.latitude, { shouldValidate: true }); setValue('longitude', p.longitude, { shouldValidate: true }); }} />
        <p className={cn('text-xs', errors.latitude ? 'text-danger' : 'text-subtle')} aria-live="polite">
          {errors.latitude?.message ?? (lat != null && lon != null ? <span className="font-mono tabular">{formatarNumero(lat, 5)}, {formatarNumero(lon!, 5)}</span> : 'Toque no mapa ou arraste o pino para marcar o portão.')}
        </p>
        {geo.status === 'error' && <p className="text-xs text-warning">{geo.erro}</p>}
      </div>
    </form>
  );
}

export function MinhasSolicitacoes({ aoPedirNova }: { aoPedirNova: () => void }) {
  const q = useMinhasSolicitacoesColeta();
  const cancelar = useCancelarSolicitacaoColeta();
  const [alvo, setAlvo] = useState<CollectionRequest | null>(null);
  if (q.isPending) return <EsqueletoTexto linhas={6} />;
  if (q.error) return <EstadoErro erro={q.error} aoTentarDeNovo={q.refetch} />;
  if (q.data.length === 0) {
    return <EstadoVazio icon={Truck} title="Nenhuma coleta solicitada" description="Peça uma coleta em casa para volumes grandes. Lixeiras inteligentes também pedem coletas sozinhas e aparecem aqui."
      acao={<Botao variant="secondary" onClick={aoPedirNova}>Solicitar coleta</Botao>} />;
  }
  const lista = [...q.data].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return (
    <>
      <ul className="divide-y divide-line border-y border-line">
        {lista.map((r) => {
          const cancelavel = r.status === 'REQUESTED' || r.status === 'SCHEDULED';
          return (
            <li key={r.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-medium text-fg">{r.address}</p>
                  {r.source === 'SMART_BIN' && <span className="inline-flex items-center gap-1 text-xs text-subtle"><Cpu className="size-3.5" aria-hidden />{origemColeta.SMART_BIN.label}{r.smartBin ? ` · ${r.smartBin.name}` : ''}</span>}
                </div>
                <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-subtle">
                  <span className="inline-flex items-center gap-1">{r.categoryCodes.map((c) => <span key={c} aria-hidden className="size-2 rounded-full" style={{ backgroundColor: corDaCategoria(c) }} />)}
                    <span className="ml-1">{r.categoryCodes.map((c) => categoriaPadrao[c].name).join(', ')}</span></span>
                  <span className="font-mono tabular">{formatarKg(r.estimatedKg)}</span>
                  <span>{r.scheduledFor ? `agendada para ${formatarData(r.scheduledFor)}` : r.preferredDate ? `preferência ${formatarData(r.preferredDate)}` : `pedida ${formatarRelativo(r.createdAt)}`}</span>
                </p>
              </div>
              <div className="flex items-center gap-2 sm:justify-end">
                <PilulaStatus mapa={statusSolicitacaoColeta} value={r.status} pulsar={r.status === 'IN_ROUTE'} />
                {cancelavel && <Botao size="sm" variant="ghost" iconeEsquerda={X} onClick={() => setAlvo(r)}>Cancelar</Botao>}
              </div>
            </li>
          );
        })}
      </ul>
      <DialogoConfirmacao open={!!alvo} onClose={() => setAlvo(null)} tone="danger" carregando={cancelar.isPending}
        title="Cancelar esta coleta?" description="A solicitação sai da fila do coletor. Você pode pedir de novo quando quiser."
        rotuloConfirmar="Cancelar coleta" rotuloCancelar="Manter"
        aoConfirmar={() => alvo && cancelar.mutate(alvo.id, {
          onSuccess: () => { toast.success('Coleta cancelada'); setAlvo(null); },
          onError: (e) => { toast.error(mensagemDeErro(e)); setAlvo(null); },
        })} />
    </>
  );
}
