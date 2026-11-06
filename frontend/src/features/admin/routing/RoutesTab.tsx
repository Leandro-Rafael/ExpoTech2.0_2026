import { useMemo, useState } from 'react';
import { Check, Route as RouteIcon } from 'lucide-react';
import { useRotasAdmin } from '@/api/queries';
import type { Route, RouteStatus } from '@/api/types';
import { Gaveta, EstadoVazio, PilulaStatus } from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatarData, formatarDistanciaKm, formatarKg, formatarMinutos, formatarNumero } from '@/lib/format';
import { statusRota } from '@/lib/labels';
import { TabelaAdmin, Detalhe, Medidor, CampoBusca, Segmentado, type ColunaAdmin } from '../ui';
import { MapaRota } from './RouteMap';

type Filtro = RouteStatus | 'ALL';

// Aba "Rotas": todas as rotas já criadas, com filtro por status e o mapa de cada uma.
export function AbaRotas({ destaque }: { destaque?: Set<string> }) {
  const rotas = useRotasAdmin();
  const [filtro, setFiltro] = useState<Filtro>('ALL');
  const [busca, setBusca] = useState('');
  const [aberta, setAberta] = useState<Route | null>(null);

  const contagens = useMemo(() => {
    const c: Record<string, number> = { ALL: 0, PLANNED: 0, IN_PROGRESS: 0, DONE: 0 };
    rotas.data?.forEach((r) => { c.ALL++; c[r.status]++; });
    return c;
  }, [rotas.data]);

  const linhas = useMemo(() => {
    const s = busca.trim().toLocaleLowerCase('pt-BR');
    return rotas.data?.filter((r) => (filtro === 'ALL' || r.status === filtro)
      && (!s || r.name.toLocaleLowerCase('pt-BR').includes(s) || r.collector?.name.toLocaleLowerCase('pt-BR').includes(s)));
  }, [rotas.data, filtro, busca]);

  const colunas: ColunaAdmin<Route>[] = [
    {
      key: 'name', cabecalho: 'Rota', celular: 'title', ordenar: (r) => r.name,
      celula: (r) => (
        <span className="min-w-0">
          <span className="flex items-center gap-2 font-medium text-fg">{r.name}{destaque?.has(r.id) && <span className="text-[11px] font-normal text-success">nova</span>}</span>
          <span className="block text-xs text-muted">{r.collector?.name ?? 'Sem coletor'}</span>
        </span>
      ),
    },
    { key: 'status', cabecalho: 'Status', celular: 'aside', ordenar: (r) => r.status, celula: (r) => <PilulaStatus mapa={statusRota} value={r.status} pulsar={r.status === 'IN_PROGRESS'} /> },
    { key: 'date', cabecalho: 'Data', ordenar: (r) => r.plannedDate, celula: (r) => <span className="font-mono text-[12.5px] tabular">{formatarData(r.plannedDate)}</span> },
    {
      key: 'progress', cabecalho: 'Paradas', ordenar: (r) => r.stops.filter((s) => s.status === 'DONE').length / Math.max(1, r.stops.length),
      celula: (r) => {
        const concluidas = r.stops.filter((s) => s.status === 'DONE').length;
        return (
          <span className="flex min-w-28 items-center gap-2.5">
            <Medidor value={concluidas / Math.max(1, r.stops.length)} label={`${concluidas} de ${r.stops.length} paradas`} />
            <span className="shrink-0 font-mono text-[12px] text-muted tabular">{concluidas}/{r.stops.length}</span>
          </span>
        );
      },
    },
    {
      key: 'km', cabecalho: 'Distância', alinhamento: 'right', ordenar: (r) => r.totalDistanceKm,
      celula: (r) => {
        const economia = r.naiveDistanceKm > 0 ? 1 - r.totalDistanceKm / r.naiveDistanceKm : 0;
        return (
          <span className="font-mono tabular">
            <span className="text-fg">{formatarDistanciaKm(r.totalDistanceKm)}</span>
            {economia > 0.001 && <span className="block text-[11px] text-success">−{formatarNumero(economia * 100)}% vs. ingênua</span>}
          </span>
        );
      },
    },
    { key: 'time', cabecalho: 'Tempo', alinhamento: 'right', celular: 'hidden', className: 'max-lg:hidden', ordenar: (r) => r.estimatedMinutes, celula: (r) => <span className="font-mono tabular">{formatarMinutos(r.estimatedMinutes)}</span> },
    { key: 'load', cabecalho: 'Carga', alinhamento: 'right', ordenar: (r) => r.loadKg, celula: (r) => <span className="font-mono tabular">{formatarKg(r.loadKg)}</span> },
  ];

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Segmentado<Filtro> label="Status da rota" value={filtro} onChange={setFiltro}
          opcoes={[
            { value: 'ALL', label: 'Todas', contagem: contagens.ALL },
            { value: 'PLANNED', label: 'Planejadas', contagem: contagens.PLANNED },
            { value: 'IN_PROGRESS', label: 'Em andamento', contagem: contagens.IN_PROGRESS },
            { value: 'DONE', label: 'Concluídas', contagem: contagens.DONE },
          ]} />
        <CampoBusca value={busca} onChange={setBusca} placeholder="Buscar rota ou coletor" className="w-full sm:w-72" />
      </div>
      <TabelaAdmin
        legenda="Rotas de coleta"
        colunas={colunas}
        linhas={linhas}
        chaveLinha={(r) => r.id}
        carregando={rotas.isPending}
        erro={rotas.error}
        aoTentarDeNovo={rotas.refetch}
        aoClicarLinha={setAberta}
        ordemPadrao={{ key: 'date', direcao: 'desc' }}
        classeLinha={(r) => cn(destaque?.has(r.id) && 'bg-brand-500/[0.05]')}
        vazio={<EstadoVazio compacto icon={RouteIcon} title="Nenhuma rota" description="Selecione solicitações no planejamento e crie rotas otimizadas." />}
      />

      <Gaveta open={!!aberta} onClose={() => setAberta(null)} title={aberta?.name} description={aberta ? `${formatarData(aberta.plannedDate)} · ${aberta.collector?.name ?? 'Sem coletor'}` : undefined} className="w-[min(560px,96vw)]">
        {aberta && (
          <div className="space-y-5">
            <MapaRota rota={aberta} className="h-72 rounded-xl border border-line" />
            <dl className="grid grid-cols-3 gap-4">
              <Detalhe label="Distância" mono>{formatarDistanciaKm(aberta.totalDistanceKm)}</Detalhe>
              <Detalhe label="Ingênua" mono>{formatarDistanciaKm(aberta.naiveDistanceKm)}</Detalhe>
              <Detalhe label="Tempo" mono>{formatarMinutos(aberta.estimatedMinutes)}</Detalhe>
              <Detalhe label="Carga" mono>{formatarKg(aberta.loadKg)}</Detalhe>
              <Detalhe label="Status"><PilulaStatus mapa={statusRota} value={aberta.status} /></Detalhe>
            </dl>
            <ol className="divide-y divide-line border-y border-line">
              {[...aberta.stops].sort((a, b) => a.sequence - b.sequence).map((s) => (
                <li key={s.id} className="flex items-center gap-3 py-2.5 text-[13px]">
                  <span className={cn('inline-flex size-6 shrink-0 items-center justify-center rounded-full border font-mono text-[11px] tabular',
                    s.status === 'DONE' ? 'border-line text-subtle' : 'border-brand-300/60 text-brand-300')}>
                    {s.status === 'DONE' ? <Check className="size-3" aria-label="Concluída" /> : s.sequence}
                  </span>
                  <span className={cn('min-w-0 flex-1 truncate', s.status === 'DONE' ? 'text-muted line-through decoration-line-strong' : 'text-fg-soft')}>{s.address}</span>
                  <span className="shrink-0 font-mono text-muted tabular">{formatarKg(s.estimatedKg)}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </Gaveta>
    </>
  );
}
