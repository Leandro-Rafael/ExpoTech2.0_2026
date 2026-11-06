import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CalendarCheck } from 'lucide-react';
import { aplicarErrosDoServidor } from '@/api/forms';
import { useColetoresAdmin, useCriarRotas } from '@/api/queries';
import type { GeoPoint, Route } from '@/api/types';
import { Botao, Campo, ErroFormulario, CampoTexto, Selecao, toast } from '@/components/ui';
import { formatarData, dataHojeISO } from '@/lib/format';

const esquema = z.object({
  name: z.string().trim().min(3, 'Mínimo de 3 caracteres').max(80, 'Máximo de 80 caracteres'),
  plannedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Escolha a data').refine((d) => d >= dataHojeISO(), 'A data não pode estar no passado'),
  collectorId: z.string(),
});
type Valores = z.infer<typeof esquema>;

interface Props {
  requestIds: string[];
  depot: GeoPoint;
  capacidadeKg: number;
  viagens: number;
  disabled?: boolean;
  aoCriar: (routes: Route[]) => void;
}

/** Transforma a otimização em rotas reais (uma por viagem), atribuídas a um coletor. */
export function FormCriarRotas({ requestIds, depot, capacidadeKg, viagens, disabled, aoCriar }: Props) {
  const coletores = useColetoresAdmin();
  const criar = useCriarRotas();
  const formulario = useForm<Valores>({
    resolver: zodResolver(esquema),
    defaultValues: { name: `Coleta ${formatarData(dataHojeISO()).replace(/ de /g, ' ')}`, plannedDate: dataHojeISO(), collectorId: '' },
  });
  const { errors: erros, isSubmitting: enviando } = formulario.formState;

  return (
    <form noValidate className="surface rounded-2xl p-5 sm:p-6"
      onSubmit={formulario.handleSubmit(async (v) => {
        try {
          const rotas = await criar.mutateAsync({
            name: v.name.trim(), plannedDate: v.plannedDate, collectorId: v.collectorId || null, requestIds, depot, vehicleCapacityKg: capacidadeKg,
          });
          toast.success(rotas.length > 1 ? `${rotas.length} rotas criadas e agendadas.` : 'Rota criada e agendada.');
          aoCriar(rotas);
        } catch (e) { aplicarErrosDoServidor(e, formulario.setError, { knownFields: ['name', 'plannedDate', 'collectorId'] }); }
      })}>
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-[15px] font-semibold text-fg">Criar {viagens > 1 ? `${viagens} rotas` : 'rota'}</h3>
          <p className="mt-0.5 text-[13px] text-muted">As solicitações passam para “Agendada” e aparecem para o coletor.{viagens > 1 && ' Cada viagem vira uma rota numerada.'}</p>
        </div>
      </div>
      <ErroFormulario erro={erros.root?.server} className="mb-4" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo label="Nome" required erro={erros.name} className="sm:col-span-2">
          <CampoTexto {...formulario.register('name')} maxLength={80} />
        </Campo>
        <Campo label="Data" required erro={erros.plannedDate}>
          <CampoTexto type="date" min={dataHojeISO()} {...formulario.register('plannedDate')} className="[color-scheme:dark]" />
        </Campo>
        <Campo label="Coletor" opcional erro={erros.collectorId} dica={coletores.isError ? 'Não foi possível carregar os coletores' : undefined}>
          <Selecao {...formulario.register('collectorId')} placeholder="Sem atribuição"
            opcoes={(coletores.data ?? []).map((c) => ({ value: c.id, label: c.name }))} />
        </Campo>
      </div>
      <div className="mt-5 flex justify-end">
        <Botao type="submit" iconeEsquerda={CalendarCheck} carregando={enviando} disabled={disabled}>
          Criar {viagens > 1 ? `${viagens} rotas` : 'rota'}
        </Botao>
      </div>
    </form>
  );
}
