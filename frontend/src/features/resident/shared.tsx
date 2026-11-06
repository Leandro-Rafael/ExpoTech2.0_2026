/** Peças compartilhadas pelas páginas do morador (sem bibliotecas pesadas). */
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { Battery, BatteryLow, BatteryWarning, Check, ChevronRight, Copy, WifiOff } from 'lucide-react';
import type { Challenge, Disposal, SmartBin, SmartBinStatus } from '@/api/types';
import { IconeCategoria } from '@/components/CategoryIcon';
import { BarraProgresso, PilulaStatus, toast } from '@/components/ui';
import { Minigrafico } from '@/components/charts/Sparkline';
import { cn } from '@/lib/cn';
import { corDaCategoria } from '@/lib/category';
import { formatarData, formatarKg, formatarNumero, formatarPontos, formatarRelativo } from '@/lib/format';
import { statusDescarte, statusLixeira } from '@/lib/labels';

// ------------------------------------------------------------------ copiar

export function BotaoCopiar({ value, label = 'Copiar', rotuloCopiado = 'Copiado', className, size = 'sm' }: {
  value: string; label?: string; rotuloCopiado?: string; className?: string; size?: 'sm' | 'md';
}) {
  const [copiado, setCopiado] = useState(false);
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 1600);
    } catch {
      toast.error('Não foi possível copiar. Selecione o texto e copie manualmente.');
    }
  };
  return (
    <button
      type="button"
      onClick={copiar}
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-line-strong font-medium text-fg-soft transition-colors hover:bg-white/[0.04] hover:text-fg',
        size === 'sm' ? 'h-8 px-2.5 text-xs' : 'h-10 px-3.5 text-sm',
        className,
      )}
      aria-live="polite"
    >
      {copiado ? <Check className="size-3.5 text-success" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
      {copiado ? rotuloCopiado : label}
    </button>
  );
}

// ------------------------------------------------------------------ seção

/** Cabeçalho de seção interno: título Geist + ação discreta à direita. */
export function TituloSecao({ title, description, acao, className, id }: {
  title: ReactNode; description?: ReactNode; acao?: ReactNode; className?: string; id?: string;
}) {
  return (
    <div className={cn('mb-4 flex items-end justify-between gap-4', className)}>
      <div className="min-w-0">
        <h3 id={id} className="text-[15px] font-semibold text-fg">{title}</h3>
        {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
      </div>
      {acao && <div className="shrink-0">{acao}</div>}
    </div>
  );
}

export function LinkTexto({ to, children, className }: { to: string; children: ReactNode; className?: string }) {
  return (
    <Link to={to} className={cn('group inline-flex items-center gap-1 text-sm text-muted transition-colors hover:text-fg', className)}>
      {children}
      <ChevronRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
    </Link>
  );
}

// ------------------------------------------------------------------ descarte

export function LinhaDescarte({ d, onClick, compacto }: { d: Disposal; onClick?: () => void; compacto?: boolean }) {
  const pontos = d.status === 'APPROVED' ? d.pointsAwarded : d.estimatedPoints;
  const conteudo = (
    <>
      <IconeCategoria icon={d.category.icon} codigo={d.category.code} cor={d.category.color} size={compacto ? 'sm' : 'md'} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-fg">
          {d.category.name} <span className="font-mono font-normal text-muted tabular">· {formatarKg(d.quantityKg)}</span>
        </p>
        <p className="mt-0.5 truncate text-xs text-subtle">
          {formatarRelativo(d.createdAt)}{d.collectionPoint ? ` · ${d.collectionPoint.name}` : ''}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <PilulaStatus mapa={statusDescarte} value={d.status} />
        <span className={cn('font-mono text-xs tabular', d.status === 'APPROVED' ? 'text-success' : d.status === 'REJECTED' ? 'text-subtle line-through' : 'text-muted')}>
          {d.status === 'PENDING' ? '≈ ' : d.status === 'APPROVED' ? '+' : ''}{formatarPontos(pontos)}
        </span>
      </div>
    </>
  );
  const classes = cn('flex w-full items-center gap-3 text-left', compacto ? 'py-3' : 'py-3.5');
  return onClick ? (
    <button type="button" onClick={onClick} className={cn(classes, 'rounded-lg transition-colors hover:bg-white/[0.02] focus-visible:bg-white/[0.03]')}>{conteudo}</button>
  ) : <div className={classes}>{conteudo}</div>;
}

// ------------------------------------------------------------------ desafio

function diasRestantesDesafio(c: Challenge): number {
  const [y, m, d] = c.endsAt.split('-').map(Number);
  const fim = new Date(y, m - 1, d, 23, 59, 59).getTime();
  return Math.max(0, Math.ceil((fim - Date.now()) / 86_400_000));
}

export function LinhaDesafio({ c, denso }: { c: Challenge; denso?: boolean }) {
  const proporcao = c.target ? Math.min(1, c.progress / c.target) : 0;
  const formatar = (v: number) => (c.metric === 'KG' ? formatarKg(v) : formatarNumero(v));
  const dias = diasRestantesDesafio(c);
  const cor = c.categoryCode ? corDaCategoria(c.categoryCode) : undefined;
  return (
    <div className={cn(denso ? 'py-3' : 'py-4')}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-medium text-fg">
            {c.categoryCode && <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ backgroundColor: cor }} />}
            <span className="truncate">{c.title}</span>
          </p>
          {!denso && <p className="mt-1 text-sm text-muted">{c.description}</p>}
        </div>
        <span className="shrink-0 font-mono text-xs text-fg-soft tabular">+{formatarNumero(c.bonusPoints)} pts</span>
      </div>
      <BarraProgresso value={proporcao} size="xs" className="mt-3" rotuloValor={null} label={undefined} />
      <div className="mt-1.5 flex items-center justify-between gap-2 font-mono text-[11px] text-subtle tabular">
        <span>
          {c.completed ? <span className="text-success">Concluído</span> : <>{formatar(c.progress)} de {formatar(c.target)}</>}
        </span>
        <span>{c.completed ? `até ${formatarData(c.endsAt)}` : dias === 0 ? 'termina hoje' : `${dias} ${dias === 1 ? 'dia' : 'dias'} restantes`}</span>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ lixeira inteligente

const corPorStatus: Record<SmartBinStatus, string> = {
  OK: '#10b981',
  ATTENTION: '#f5b544',
  FULL: '#f28b82',
  OFFLINE: '#4b544e',
};

function IndicadorBateria({ nivel, className }: { nivel: number; className?: string }) {
  const Icone = nivel <= 15 ? BatteryWarning : nivel <= 35 ? BatteryLow : Battery;
  return (
    <span className={cn('inline-flex items-center gap-1 font-mono text-xs tabular', nivel <= 15 ? 'text-danger' : nivel <= 35 ? 'text-warning' : 'text-muted', className)}>
      <Icone className="size-3.5" aria-hidden />
      <span><span className="sr-only">Bateria </span>{Math.round(nivel)}%</span>
    </span>
  );
}

/** Medidor horizontal compacto (painel). */
export function MedidorLixeira({ lixeira }: { lixeira: SmartBin }) {
  const cor = corPorStatus[lixeira.status];
  return (
    <div className="py-3">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="flex min-w-0 items-center gap-2">
          <IconeCategoria icon={lixeira.category.icon} codigo={lixeira.category.code} cor={lixeira.category.color} variant="plain" size="sm" />
          <span className="truncate text-fg-soft">{lixeira.name}</span>
        </span>
        <span className="flex shrink-0 items-center gap-3">
          {lixeira.status !== 'OK' && <PilulaStatus mapa={statusLixeira} value={lixeira.status} />}
          <span className="font-mono text-fg tabular">{lixeira.status === 'OFFLINE' ? '—' : `${Math.round(lixeira.fillLevel)}%`}</span>
        </span>
      </div>
      <div className="relative mt-2 h-1.5 rounded-full bg-white/6" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(lixeira.fillLevel)} aria-label={`${lixeira.name}: ${Math.round(lixeira.fillLevel)}% cheia`}>
        <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${lixeira.fillLevel}%`, backgroundColor: cor }} />
        <span aria-hidden className="absolute -top-1 h-3.5 w-px bg-fg-soft/60" style={{ left: `${lixeira.autoRequestThreshold}%` }} />
      </div>
    </div>
  );
}

/** Medidor completo da lixeira: tanque vertical com marca do limite, leitura, bateria e histórico. */
export function PainelLixeira({ lixeira, acoes }: { lixeira: SmartBin; acoes?: ReactNode }) {
  const cor = corPorStatus[lixeira.status];
  const semConexao = lixeira.status === 'OFFLINE';
  const historico = lixeira.history.map((h) => h.fillLevel);
  const preenchimento = Math.max(0, Math.min(100, lixeira.fillLevel));
  const litrosEstimados = (lixeira.capacityLiters * preenchimento) / 100;
  return (
    <article className="surface flex flex-col rounded-2xl p-5" aria-label={`Lixeira ${lixeira.name}`}>
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <IconeCategoria icon={lixeira.category.icon} codigo={lixeira.category.code} cor={lixeira.category.color} size="sm" />
          <div className="min-w-0">
            <h4 className="truncate text-sm font-semibold text-fg">{lixeira.name}</h4>
            <p className="text-xs text-subtle">{lixeira.category.name} · {formatarNumero(lixeira.capacityLiters)} L</p>
          </div>
        </div>
        <PilulaStatus mapa={statusLixeira} value={lixeira.status} pulsar={lixeira.status === 'FULL'} />
      </header>

      <div className="mt-5 flex items-end gap-5">
        {/* Tanque */}
        <div className="relative h-28 w-14 shrink-0 overflow-hidden rounded-xl border border-line-strong bg-bg-deep" role="meter"
          aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(preenchimento)} aria-label={`Nível de enchimento: ${Math.round(preenchimento)}%`}>
          <div className="absolute inset-x-0 bottom-0 transition-[height] duration-1000 ease-[var(--ease-out-expo)]"
            style={{ height: semConexao ? '0%' : `${preenchimento}%`, background: `linear-gradient(180deg, ${cor}, ${cor}cc)`, opacity: semConexao ? 0.3 : 0.9 }} />
          {/* Limite de coleta automática */}
          <div aria-hidden className="absolute inset-x-0 flex items-center" style={{ bottom: `${lixeira.autoRequestThreshold}%` }}>
            <span className="h-px w-full bg-fg/70" />
          </div>
          {semConexao && <WifiOff className="absolute inset-0 m-auto size-5 text-subtle" aria-hidden />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[34px] leading-none font-medium tracking-[-0.03em] text-fg">
            {semConexao ? '—' : Math.round(preenchimento)}<span className="ml-0.5 text-lg text-muted">%</span>
          </p>
          <p className="mt-1.5 text-xs text-muted">
            {semConexao ? 'Sem leituras recentes' : <>≈ {formatarNumero(litrosEstimados, 0)} L de {formatarNumero(lixeira.capacityLiters)} L</>}
          </p>
          <p className="mt-0.5 text-xs text-subtle">Coleta automática em {lixeira.autoRequestThreshold}%</p>
        </div>
      </div>

      <div className="mt-5">
        <Minigrafico valores={historico} width={260} height={36} cor={semConexao ? '#4b544e' : cor} dominio={[0, 100]} limite={lixeira.autoRequestThreshold}
          className="w-full" ariaLabel={`Histórico das últimas ${historico.length} leituras`} />
      </div>

      <footer className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-3">
        <span className="text-xs text-subtle">{lixeira.lastReadingAt ? `Leitura ${formatarRelativo(lixeira.lastReadingAt)}` : 'Aguardando primeira leitura'}</span>
        <span className="flex items-center gap-2">
          <IndicadorBateria nivel={lixeira.batteryLevel} />
          {acoes}
        </span>
      </footer>
    </article>
  );
}

