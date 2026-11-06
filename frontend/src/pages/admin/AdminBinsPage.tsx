import { useEffect, useMemo, useState } from 'react';
import { BatteryFull, BatteryLow, BatteryMedium, BatteryWarning, Pause, RefreshCw, Trash2, WifiOff } from 'lucide-react';
import { useLixeirasAdmin } from '@/api/queries';
import type { SmartBin, SmartBinStatus } from '@/api/types';
import { EstadoVazio, BotaoIcone, CabecalhoPagina, PilulaStatus } from '@/components/ui';
import { IconeCategoria } from '@/components/CategoryIcon';
import { cn } from '@/lib/cn';
import { formatarRelativo } from '@/lib/format';
import { statusLixeira } from '@/lib/labels';
import { TabelaAdmin, Medidor, CampoBusca, Segmentado, type ColunaAdmin } from '@/features/admin/ui';

type Filtro = SmartBinStatus | 'ALL' | 'NEEDS';
const INTERVALO_ATUALIZACAO_MS = 20_000;
const ORDEM_STATUS: Record<SmartBinStatus, number> = { FULL: 0, OFFLINE: 1, ATTENTION: 2, OK: 3 };

/** Atualiza a cada 20 s só com a aba visível. */
function useAtualizacaoAoVivo(recarregar: () => unknown) {
  const [visivel, setVisivel] = useState(() => document.visibilityState === 'visible');
  useEffect(() => {
    const aoMudarVisibilidade = () => {
      const v = document.visibilityState === 'visible';
      setVisivel(v);
      if (v) recarregar();
    };
    document.addEventListener('visibilitychange', aoMudarVisibilidade);
    return () => document.removeEventListener('visibilitychange', aoMudarVisibilidade);
  }, [recarregar]);
  useEffect(() => {
    if (!visivel) return;
    const t = setInterval(() => recarregar(), INTERVALO_ATUALIZACAO_MS);
    return () => clearInterval(t);
  }, [visivel, recarregar]);
  return visivel;
}

function MiniGrafico({ dados, limite, cor }: { dados: { fillLevel: number }[]; limite: number; cor: string }) {
  if (dados.length < 2) return <span className="text-xs text-subtle">—</span>;
  const w = 88; const h = 26;
  const pontos = dados.map((d, i) => `${(i / (dados.length - 1)) * w},${h - (Math.min(100, d.fillLevel) / 100) * h}`).join(' ');
  const yLimite = h - (limite / 100) * h;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden className="overflow-visible">
      <line x1={0} x2={w} y1={yLimite} y2={yLimite} stroke="rgb(236 239 234 / 0.18)" strokeDasharray="2 3" />
      <polyline points={pontos} fill="none" stroke={cor} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function Bateria({ nivel, desconectada }: { nivel: number; desconectada: boolean }) {
  const Icon = nivel <= 15 ? BatteryWarning : nivel <= 35 ? BatteryLow : nivel <= 70 ? BatteryMedium : BatteryFull;
  return (
    <span className={cn('inline-flex items-center gap-1.5 font-mono text-[12.5px] tabular', nivel <= 15 ? 'text-danger' : nivel <= 35 ? 'text-warning' : 'text-fg-soft', desconectada && 'opacity-60')}>
      <Icon className="size-4" aria-hidden /> {nivel}%
    </span>
  );
}

export default function PaginaLixeiras() {
  const lixeiras = useLixeirasAdmin();
  const visivel = useAtualizacaoAoVivo(lixeiras.refetch);
  const [filtro, setFiltro] = useState<Filtro>('ALL');
  const [busca, setBusca] = useState('');

  const contagens = useMemo(() => {
    const c: Record<string, number> = { ALL: 0, FULL: 0, ATTENTION: 0, OFFLINE: 0, OK: 0, NEEDS: 0 };
    lixeiras.data?.forEach((b) => { c.ALL++; c[b.status]++; if (b.fillLevel >= b.autoRequestThreshold) c.NEEDS++; });
    return c;
  }, [lixeiras.data]);

  const linhas = useMemo(() => {
    const s = busca.trim().toLocaleLowerCase('pt-BR');
    return lixeiras.data?.filter((b) =>
      (filtro === 'ALL' || (filtro === 'NEEDS' ? b.fillLevel >= b.autoRequestThreshold : b.status === filtro))
      && (!s || [b.name, b.household?.name, b.household?.neighborhood, b.category.name].some((x) => x?.toLocaleLowerCase('pt-BR').includes(s))));
  }, [lixeiras.data, filtro, busca]);

  const colunas: ColunaAdmin<SmartBin>[] = [
    {
      key: 'name', cabecalho: 'Lixeira', celular: 'title', ordenar: (b) => b.name,
      celula: (b) => (
        <span className="flex items-center gap-3">
          <IconeCategoria icon={b.category.icon} cor={b.category.color} codigo={b.category.code} size="sm" />
          <span className="min-w-0">
            <span className="block font-medium text-fg">{b.name}</span>
            <span className="block text-xs text-muted">{b.category.name} · {b.capacityLiters} L</span>
          </span>
        </span>
      ),
    },
    { key: 'status', cabecalho: 'Status', celular: 'aside', ordenar: (b) => ORDEM_STATUS[b.status], celula: (b) => <PilulaStatus mapa={statusLixeira} value={b.status} pulsar={b.status === 'FULL'} /> },
    {
      key: 'fill', cabecalho: 'Nível', ordenar: (b) => b.fillLevel,
      celula: (b) => (
        <span className="flex min-w-36 items-center gap-2.5">
          <Medidor value={b.fillLevel / 100} marca={b.autoRequestThreshold / 100} altura="h-2"
            tone={b.status === 'OFFLINE' ? 'neutral' : b.fillLevel >= b.autoRequestThreshold ? 'danger' : b.fillLevel >= 60 ? 'warning' : 'brand'}
            label={`Nível ${b.fillLevel}%, coleta automática em ${b.autoRequestThreshold}%`} />
          <span className="w-9 shrink-0 text-right font-mono text-[12.5px] text-fg tabular">{b.fillLevel}%</span>
        </span>
      ),
    },
    {
      key: 'trend', cabecalho: 'Últimas leituras', celular: 'hidden', className: 'max-lg:hidden',
      celula: (b) => <MiniGrafico dados={b.history} limite={b.autoRequestThreshold} cor={b.fillLevel >= b.autoRequestThreshold ? '#f28b82' : '#34d399'} />,
    },
    { key: 'battery', cabecalho: 'Bateria', ordenar: (b) => b.batteryLevel, celula: (b) => <Bateria nivel={b.batteryLevel} desconectada={b.status === 'OFFLINE'} /> },
    {
      key: 'reading', cabecalho: 'Última leitura', ordenar: (b) => (b.lastReadingAt ? Date.parse(b.lastReadingAt) : 0),
      celula: (b) => (
        <span className={cn('inline-flex items-center gap-1.5', b.status === 'OFFLINE' && 'text-warning')}>
          {b.status === 'OFFLINE' && <WifiOff className="size-3.5" aria-hidden />}
          {b.lastReadingAt ? formatarRelativo(b.lastReadingAt) : 'Nunca'}
        </span>
      ),
    },
    {
      key: 'home', cabecalho: 'Residência', ordenar: (b) => b.household?.neighborhood,
      celula: (b) => b.household ? <span className="min-w-0"><span className="block truncate text-fg-soft">{b.household.name}</span><span className="block text-xs text-muted">{b.household.neighborhood}</span></span> : <span className="text-subtle">—</span>,
    },
  ];

  return (
    <>
      <CabecalhoPagina
        sobretitulo="Administração"
        title="Lixeiras inteligentes"
        description="Sensores IoT das residências: nível de enchimento, bateria e conectividade. Ao passar do limite, a lixeira pede coleta sozinha."
        acoes={
          <div className="flex items-center gap-2 text-xs text-muted" aria-live="polite">
            {visivel ? (
              <span className="inline-flex items-center gap-2"><span className="relative flex size-2"><span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60" /><span className="relative size-2 rounded-full bg-success" /></span>Ao vivo · a cada 20 s</span>
            ) : <span className="inline-flex items-center gap-1.5"><Pause className="size-3.5" aria-hidden />Pausado (aba oculta)</span>}
            <BotaoIcone icon={RefreshCw} size="sm" label="Atualizar agora" onClick={() => lixeiras.refetch()} carregando={lixeiras.isFetching} />
          </div>
        }
      />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Segmentado<Filtro> label="Status" value={filtro} onChange={setFiltro}
          opcoes={[
            { value: 'ALL', label: 'Todas', contagem: contagens.ALL },
            { value: 'NEEDS', label: 'Precisam de coleta', contagem: contagens.NEEDS, tom: 'danger' },
            { value: 'FULL', label: 'Cheias', contagem: contagens.FULL, tom: 'danger' },
            { value: 'ATTENTION', label: 'Atenção', contagem: contagens.ATTENTION, tom: 'warning' },
            { value: 'OFFLINE', label: 'Offline', contagem: contagens.OFFLINE, tom: 'warning' },
            { value: 'OK', label: 'Normais', contagem: contagens.OK },
          ]} />
        <CampoBusca value={busca} onChange={setBusca} placeholder="Lixeira, residência ou bairro" className="w-full lg:w-72" />
      </div>

      <TabelaAdmin
        legenda="Lixeiras inteligentes"
        colunas={colunas}
        linhas={linhas}
        chaveLinha={(b) => b.id}
        carregando={lixeiras.isPending}
        erro={lixeiras.error}
        aoTentarDeNovo={lixeiras.refetch}
        ordemPadrao={{ key: 'status', direcao: 'asc' }}
        classeLinha={(b) => cn(b.status === 'FULL' && 'shadow-[inset_2px_0_0_var(--color-danger)]', b.status === 'OFFLINE' && 'shadow-[inset_2px_0_0_var(--color-warning)] [&_td]:text-muted')}
        vazio={<EstadoVazio compacto icon={Trash2} title="Nenhuma lixeira" description={filtro === 'ALL' && !busca ? 'Nenhuma residência conectou lixeiras ainda.' : 'Nada com esses filtros.'} />}
      />
      <p className="mt-3 text-xs text-subtle">O tique na barra marca o limite de coleta automática de cada lixeira; a linha tracejada no gráfico também.</p>
    </>
  );
}
