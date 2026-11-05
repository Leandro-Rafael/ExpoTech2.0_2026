/** Peças compartilhadas pelas páginas do morador (sem bibliotecas pesadas). */
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { Battery, BatteryLow, BatteryWarning, Check, ChevronRight, Copy, WifiOff } from 'lucide-react';
import type { Challenge, Disposal, SmartBin, SmartBinStatus } from '@/api/types';
import { CategoryIcon } from '@/components/CategoryIcon';
import { ProgressBar, StatusPill, toast } from '@/components/ui';
import { Sparkline } from '@/components/charts/Sparkline';
import { cn } from '@/lib/cn';
import { categoryColor } from '@/lib/category';
import { formatDate, formatKg, formatNumber, formatPoints, formatRelative } from '@/lib/format';
import { disposalStatus, smartBinStatus } from '@/lib/labels';

// ------------------------------------------------------------------ copiar

export function CopyButton({ value, label = 'Copiar', copiedLabel = 'Copiado', className, size = 'sm' }: {
  value: string; label?: string; copiedLabel?: string; className?: string; size?: 'sm' | 'md';
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error('Não foi possível copiar. Selecione o texto e copie manualmente.');
    }
  };
  return (
    <button
      type="button"
      onClick={copy}
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-line-strong font-medium text-fg-soft transition-colors hover:bg-white/[0.04] hover:text-fg',
        size === 'sm' ? 'h-8 px-2.5 text-xs' : 'h-10 px-3.5 text-sm',
        className,
      )}
      aria-live="polite"
    >
      {copied ? <Check className="size-3.5 text-success" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
      {copied ? copiedLabel : label}
    </button>
  );
}

// ------------------------------------------------------------------ seção

/** Cabeçalho de seção interno: título Geist + ação discreta à direita. */
export function SectionHeading({ title, description, action, className, id }: {
  title: ReactNode; description?: ReactNode; action?: ReactNode; className?: string; id?: string;
}) {
  return (
    <div className={cn('mb-4 flex items-end justify-between gap-4', className)}>
      <div className="min-w-0">
        <h3 id={id} className="text-[15px] font-semibold text-fg">{title}</h3>
        {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function TextLink({ to, children, className }: { to: string; children: ReactNode; className?: string }) {
  return (
    <Link to={to} className={cn('group inline-flex items-center gap-1 text-sm text-muted transition-colors hover:text-fg', className)}>
      {children}
      <ChevronRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
    </Link>
  );
}

// ------------------------------------------------------------------ descarte

export function DisposalRow({ d, onClick, compact }: { d: Disposal; onClick?: () => void; compact?: boolean }) {
  const points = d.status === 'APPROVED' ? d.pointsAwarded : d.estimatedPoints;
  const content = (
    <>
      <CategoryIcon icon={d.category.icon} code={d.category.code} color={d.category.color} size={compact ? 'sm' : 'md'} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-fg">
          {d.category.name} <span className="font-mono font-normal text-muted tabular">· {formatKg(d.quantityKg)}</span>
        </p>
        <p className="mt-0.5 truncate text-xs text-subtle">
          {formatRelative(d.createdAt)}{d.collectionPoint ? ` · ${d.collectionPoint.name}` : ''}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <StatusPill map={disposalStatus} value={d.status} />
        <span className={cn('font-mono text-xs tabular', d.status === 'APPROVED' ? 'text-success' : d.status === 'REJECTED' ? 'text-subtle line-through' : 'text-muted')}>
          {d.status === 'PENDING' ? '≈ ' : d.status === 'APPROVED' ? '+' : ''}{formatPoints(points)}
        </span>
      </div>
    </>
  );
  const cls = cn('flex w-full items-center gap-3 text-left', compact ? 'py-3' : 'py-3.5');
  return onClick ? (
    <button type="button" onClick={onClick} className={cn(cls, 'rounded-lg transition-colors hover:bg-white/[0.02] focus-visible:bg-white/[0.03]')}>{content}</button>
  ) : <div className={cls}>{content}</div>;
}

// ------------------------------------------------------------------ desafio

function challengeDaysLeft(c: Challenge): number {
  const [y, m, d] = c.endsAt.split('-').map(Number);
  const end = new Date(y, m - 1, d, 23, 59, 59).getTime();
  return Math.max(0, Math.ceil((end - Date.now()) / 86_400_000));
}

export function ChallengeRow({ c, dense }: { c: Challenge; dense?: boolean }) {
  const ratio = c.target ? Math.min(1, c.progress / c.target) : 0;
  const fmt = (v: number) => (c.metric === 'KG' ? formatKg(v) : formatNumber(v));
  const days = challengeDaysLeft(c);
  const color = c.categoryCode ? categoryColor(c.categoryCode) : undefined;
  return (
    <div className={cn(dense ? 'py-3' : 'py-4')}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-medium text-fg">
            {c.categoryCode && <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />}
            <span className="truncate">{c.title}</span>
          </p>
          {!dense && <p className="mt-1 text-sm text-muted">{c.description}</p>}
        </div>
        <span className="shrink-0 font-mono text-xs text-fg-soft tabular">+{formatNumber(c.bonusPoints)} pts</span>
      </div>
      <ProgressBar value={ratio} size="xs" className="mt-3" valueLabel={null} label={undefined} />
      <div className="mt-1.5 flex items-center justify-between gap-2 font-mono text-[11px] text-subtle tabular">
        <span>
          {c.completed ? <span className="text-success">Concluído</span> : <>{fmt(c.progress)} de {fmt(c.target)}</>}
        </span>
        <span>{c.completed ? `até ${formatDate(c.endsAt)}` : days === 0 ? 'termina hoje' : `${days} ${days === 1 ? 'dia' : 'dias'} restantes`}</span>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ lixeira inteligente

const binTone: Record<SmartBinStatus, string> = {
  OK: '#10b981',
  ATTENTION: '#f5b544',
  FULL: '#f28b82',
  OFFLINE: '#4b544e',
};

function BatteryIndicator({ level, className }: { level: number; className?: string }) {
  const Icon = level <= 15 ? BatteryWarning : level <= 35 ? BatteryLow : Battery;
  return (
    <span className={cn('inline-flex items-center gap-1 font-mono text-xs tabular', level <= 15 ? 'text-danger' : level <= 35 ? 'text-warning' : 'text-muted', className)}>
      <Icon className="size-3.5" aria-hidden />
      <span><span className="sr-only">Bateria </span>{Math.round(level)}%</span>
    </span>
  );
}

/** Medidor horizontal compacto (painel). */
export function BinMeter({ bin }: { bin: SmartBin }) {
  const color = binTone[bin.status];
  return (
    <div className="py-3">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="flex min-w-0 items-center gap-2">
          <CategoryIcon icon={bin.category.icon} code={bin.category.code} color={bin.category.color} variant="plain" size="sm" />
          <span className="truncate text-fg-soft">{bin.name}</span>
        </span>
        <span className="flex shrink-0 items-center gap-3">
          {bin.status !== 'OK' && <StatusPill map={smartBinStatus} value={bin.status} />}
          <span className="font-mono text-fg tabular">{bin.status === 'OFFLINE' ? '—' : `${Math.round(bin.fillLevel)}%`}</span>
        </span>
      </div>
      <div className="relative mt-2 h-1.5 rounded-full bg-white/6" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(bin.fillLevel)} aria-label={`${bin.name}: ${Math.round(bin.fillLevel)}% cheia`}>
        <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${bin.fillLevel}%`, backgroundColor: color }} />
        <span aria-hidden className="absolute -top-1 h-3.5 w-px bg-fg-soft/60" style={{ left: `${bin.autoRequestThreshold}%` }} />
      </div>
    </div>
  );
}

/** Medidor completo da lixeira: tanque vertical com marca do limite, leitura, bateria e histórico. */
export function BinGauge({ bin, actions }: { bin: SmartBin; actions?: ReactNode }) {
  const color = binTone[bin.status];
  const offline = bin.status === 'OFFLINE';
  const history = bin.history.map((h) => h.fillLevel);
  const fill = Math.max(0, Math.min(100, bin.fillLevel));
  const estimatedLiters = (bin.capacityLiters * fill) / 100;
  return (
    <article className="surface flex flex-col rounded-2xl p-5" aria-label={`Lixeira ${bin.name}`}>
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <CategoryIcon icon={bin.category.icon} code={bin.category.code} color={bin.category.color} size="sm" />
          <div className="min-w-0">
            <h4 className="truncate text-sm font-semibold text-fg">{bin.name}</h4>
            <p className="text-xs text-subtle">{bin.category.name} · {formatNumber(bin.capacityLiters)} L</p>
          </div>
        </div>
        <StatusPill map={smartBinStatus} value={bin.status} pulse={bin.status === 'FULL'} />
      </header>

      <div className="mt-5 flex items-end gap-5">
        {/* Tanque */}
        <div className="relative h-28 w-14 shrink-0 overflow-hidden rounded-xl border border-line-strong bg-bg-deep" role="meter"
          aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(fill)} aria-label={`Nível de enchimento: ${Math.round(fill)}%`}>
          <div className="absolute inset-x-0 bottom-0 transition-[height] duration-1000 ease-[var(--ease-out-expo)]"
            style={{ height: offline ? '0%' : `${fill}%`, background: `linear-gradient(180deg, ${color}, ${color}cc)`, opacity: offline ? 0.3 : 0.9 }} />
          {/* Limite de coleta automática */}
          <div aria-hidden className="absolute inset-x-0 flex items-center" style={{ bottom: `${bin.autoRequestThreshold}%` }}>
            <span className="h-px w-full bg-fg/70" />
          </div>
          {offline && <WifiOff className="absolute inset-0 m-auto size-5 text-subtle" aria-hidden />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[34px] leading-none font-medium tracking-[-0.03em] text-fg">
            {offline ? '—' : Math.round(fill)}<span className="ml-0.5 text-lg text-muted">%</span>
          </p>
          <p className="mt-1.5 text-xs text-muted">
            {offline ? 'Sem leituras recentes' : <>≈ {formatNumber(estimatedLiters, 0)} L de {formatNumber(bin.capacityLiters)} L</>}
          </p>
          <p className="mt-0.5 text-xs text-subtle">Coleta automática em {bin.autoRequestThreshold}%</p>
        </div>
      </div>

      <div className="mt-5">
        <Sparkline values={history} width={260} height={36} color={offline ? '#4b544e' : color} domain={[0, 100]} threshold={bin.autoRequestThreshold}
          className="w-full" ariaLabel={`Histórico das últimas ${history.length} leituras`} />
      </div>

      <footer className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-3">
        <span className="text-xs text-subtle">{bin.lastReadingAt ? `Leitura ${formatRelative(bin.lastReadingAt)}` : 'Aguardando primeira leitura'}</span>
        <span className="flex items-center gap-2">
          <BatteryIndicator level={bin.batteryLevel} />
          {actions}
        </span>
      </footer>
    </article>
  );
}

