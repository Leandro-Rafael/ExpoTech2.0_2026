import { useEffect, useMemo, useState } from 'react';
import { BatteryFull, BatteryLow, BatteryMedium, BatteryWarning, Pause, RefreshCw, Trash2, WifiOff } from 'lucide-react';
import { useAdminBins } from '@/api/queries';
import type { SmartBin, SmartBinStatus } from '@/api/types';
import { EmptyState, IconButton, PageHeader, StatusPill } from '@/components/ui';
import { CategoryIcon } from '@/components/CategoryIcon';
import { cn } from '@/lib/cn';
import { formatRelative } from '@/lib/format';
import { smartBinStatus } from '@/lib/labels';
import { AdminTable, Meter, SearchField, Segmented, type AdminColumn } from '@/features/admin/ui';

type Filter = SmartBinStatus | 'ALL' | 'NEEDS';
const REFRESH_MS = 20_000;
const ORDER: Record<SmartBinStatus, number> = { FULL: 0, OFFLINE: 1, ATTENTION: 2, OK: 3 };

/** Atualiza a cada 20 s só com a aba visível. */
function useLiveRefresh(refetch: () => unknown) {
  const [visible, setVisible] = useState(() => document.visibilityState === 'visible');
  useEffect(() => {
    const on = () => {
      const v = document.visibilityState === 'visible';
      setVisible(v);
      if (v) refetch();
    };
    document.addEventListener('visibilitychange', on);
    return () => document.removeEventListener('visibilitychange', on);
  }, [refetch]);
  useEffect(() => {
    if (!visible) return;
    const t = setInterval(() => refetch(), REFRESH_MS);
    return () => clearInterval(t);
  }, [visible, refetch]);
  return visible;
}

function Sparkline({ data, threshold, color }: { data: { fillLevel: number }[]; threshold: number; color: string }) {
  if (data.length < 2) return <span className="text-xs text-subtle">—</span>;
  const w = 88; const h = 26;
  const pts = data.map((d, i) => `${(i / (data.length - 1)) * w},${h - (Math.min(100, d.fillLevel) / 100) * h}`).join(' ');
  const ty = h - (threshold / 100) * h;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden className="overflow-visible">
      <line x1={0} x2={w} y1={ty} y2={ty} stroke="rgb(236 239 234 / 0.18)" strokeDasharray="2 3" />
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function Battery({ level, offline }: { level: number; offline: boolean }) {
  const Icon = level <= 15 ? BatteryWarning : level <= 35 ? BatteryLow : level <= 70 ? BatteryMedium : BatteryFull;
  return (
    <span className={cn('inline-flex items-center gap-1.5 font-mono text-[12.5px] tabular', level <= 15 ? 'text-danger' : level <= 35 ? 'text-warning' : 'text-fg-soft', offline && 'opacity-60')}>
      <Icon className="size-4" aria-hidden /> {level}%
    </span>
  );
}

export default function AdminBinsPage() {
  const bins = useAdminBins();
  const visible = useLiveRefresh(bins.refetch);
  const [filter, setFilter] = useState<Filter>('ALL');
  const [search, setSearch] = useState('');

  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: 0, FULL: 0, ATTENTION: 0, OFFLINE: 0, OK: 0, NEEDS: 0 };
    bins.data?.forEach((b) => { c.ALL++; c[b.status]++; if (b.fillLevel >= b.autoRequestThreshold) c.NEEDS++; });
    return c;
  }, [bins.data]);

  const rows = useMemo(() => {
    const s = search.trim().toLocaleLowerCase('pt-BR');
    return bins.data?.filter((b) =>
      (filter === 'ALL' || (filter === 'NEEDS' ? b.fillLevel >= b.autoRequestThreshold : b.status === filter))
      && (!s || [b.name, b.household?.name, b.household?.neighborhood, b.category.name].some((x) => x?.toLocaleLowerCase('pt-BR').includes(s))));
  }, [bins.data, filter, search]);

  const columns: AdminColumn<SmartBin>[] = [
    {
      key: 'name', header: 'Lixeira', mobile: 'title', sort: (b) => b.name,
      cell: (b) => (
        <span className="flex items-center gap-3">
          <CategoryIcon icon={b.category.icon} color={b.category.color} code={b.category.code} size="sm" />
          <span className="min-w-0">
            <span className="block font-medium text-fg">{b.name}</span>
            <span className="block text-xs text-muted">{b.category.name} · {b.capacityLiters} L</span>
          </span>
        </span>
      ),
    },
    { key: 'status', header: 'Status', mobile: 'aside', sort: (b) => ORDER[b.status], cell: (b) => <StatusPill map={smartBinStatus} value={b.status} pulse={b.status === 'FULL'} /> },
    {
      key: 'fill', header: 'Nível', sort: (b) => b.fillLevel,
      cell: (b) => (
        <span className="flex min-w-36 items-center gap-2.5">
          <Meter value={b.fillLevel / 100} mark={b.autoRequestThreshold / 100} height="h-2"
            tone={b.status === 'OFFLINE' ? 'neutral' : b.fillLevel >= b.autoRequestThreshold ? 'danger' : b.fillLevel >= 60 ? 'warning' : 'brand'}
            label={`Nível ${b.fillLevel}%, coleta automática em ${b.autoRequestThreshold}%`} />
          <span className="w-9 shrink-0 text-right font-mono text-[12.5px] text-fg tabular">{b.fillLevel}%</span>
        </span>
      ),
    },
    {
      key: 'trend', header: 'Últimas leituras', mobile: 'hidden', className: 'max-lg:hidden',
      cell: (b) => <Sparkline data={b.history} threshold={b.autoRequestThreshold} color={b.fillLevel >= b.autoRequestThreshold ? '#f28b82' : '#34d399'} />,
    },
    { key: 'battery', header: 'Bateria', sort: (b) => b.batteryLevel, cell: (b) => <Battery level={b.batteryLevel} offline={b.status === 'OFFLINE'} /> },
    {
      key: 'reading', header: 'Última leitura', sort: (b) => (b.lastReadingAt ? Date.parse(b.lastReadingAt) : 0),
      cell: (b) => (
        <span className={cn('inline-flex items-center gap-1.5', b.status === 'OFFLINE' && 'text-warning')}>
          {b.status === 'OFFLINE' && <WifiOff className="size-3.5" aria-hidden />}
          {b.lastReadingAt ? formatRelative(b.lastReadingAt) : 'Nunca'}
        </span>
      ),
    },
    {
      key: 'home', header: 'Residência', sort: (b) => b.household?.neighborhood,
      cell: (b) => b.household ? <span className="min-w-0"><span className="block truncate text-fg-soft">{b.household.name}</span><span className="block text-xs text-muted">{b.household.neighborhood}</span></span> : <span className="text-subtle">—</span>,
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Administração"
        title="Lixeiras inteligentes"
        description="Sensores IoT das residências: nível de enchimento, bateria e conectividade. Ao passar do limite, a lixeira pede coleta sozinha."
        actions={
          <div className="flex items-center gap-2 text-xs text-muted" aria-live="polite">
            {visible ? (
              <span className="inline-flex items-center gap-2"><span className="relative flex size-2"><span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60" /><span className="relative size-2 rounded-full bg-success" /></span>Ao vivo · a cada 20 s</span>
            ) : <span className="inline-flex items-center gap-1.5"><Pause className="size-3.5" aria-hidden />Pausado (aba oculta)</span>}
            <IconButton icon={RefreshCw} size="sm" label="Atualizar agora" onClick={() => bins.refetch()} loading={bins.isFetching} />
          </div>
        }
      />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Segmented<Filter> label="Status" value={filter} onChange={setFilter}
          options={[
            { value: 'ALL', label: 'Todas', count: counts.ALL },
            { value: 'NEEDS', label: 'Precisam de coleta', count: counts.NEEDS, tone: 'danger' },
            { value: 'FULL', label: 'Cheias', count: counts.FULL, tone: 'danger' },
            { value: 'ATTENTION', label: 'Atenção', count: counts.ATTENTION, tone: 'warning' },
            { value: 'OFFLINE', label: 'Offline', count: counts.OFFLINE, tone: 'warning' },
            { value: 'OK', label: 'Normais', count: counts.OK },
          ]} />
        <SearchField value={search} onChange={setSearch} placeholder="Lixeira, residência ou bairro" className="w-full lg:w-72" />
      </div>

      <AdminTable
        caption="Lixeiras inteligentes"
        columns={columns}
        rows={rows}
        rowKey={(b) => b.id}
        loading={bins.isPending}
        error={bins.error}
        onRetry={bins.refetch}
        defaultSort={{ key: 'status', dir: 'asc' }}
        rowClassName={(b) => cn(b.status === 'FULL' && 'shadow-[inset_2px_0_0_var(--color-danger)]', b.status === 'OFFLINE' && 'shadow-[inset_2px_0_0_var(--color-warning)] [&_td]:text-muted')}
        empty={<EmptyState compact icon={Trash2} title="Nenhuma lixeira" description={filter === 'ALL' && !search ? 'Nenhuma residência conectou lixeiras ainda.' : 'Nada com esses filtros.'} />}
      />
      <p className="mt-3 text-xs text-subtle">O tique na barra marca o limite de coleta automática de cada lixeira; a linha tracejada no gráfico também.</p>
    </>
  );
}
