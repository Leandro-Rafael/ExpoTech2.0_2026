import { Check, Flame, Lock, Medal, Target } from 'lucide-react';
import { useGamificationSummary } from '@/api/queries';
import type { Badge, GamificationSummary } from '@/api/types';
import { iconByName } from '@/components/icons';
import { EmptyState, ErrorState, PageHeader, PageSkeleton, ProgressBar } from '@/components/ui';
import { ChallengeRow, SectionHeading } from '@/features/resident/shared';
import { cn } from '@/lib/cn';
import { hexAlpha } from '@/lib/category';
import { formatDate, formatNumber } from '@/lib/format';
import { badgeTier } from '@/lib/labels';

const TIER_ORDER = { DIAMANTE: 0, OURO: 1, PRATA: 2, BRONZE: 3 } as const;

export default function AchievementsPage() {
  const q = useGamificationSummary();
  if (q.isPending) return <PageSkeleton />;
  if (q.error) return (<><PageHeader eyebrow="Conquistas" title="Níveis, medalhas e desafios" /><ErrorState error={q.error} onRetry={q.refetch} /></>);
  const s = q.data;
  const earned = s.badges.filter((b) => b.earned).length;
  const active = s.challenges.filter((c) => c.active && !c.completed);
  const done = s.challenges.filter((c) => c.completed);
  const badges = [...s.badges].sort((a, b) => Number(b.earned) - Number(a.earned) || TIER_ORDER[a.tier] - TIER_ORDER[b.tier]);

  return (
    <>
      <PageHeader eyebrow="Conquistas" title="Níveis, medalhas e desafios"
        description="Seu nível sobe com o total de pontos já ganhos — resgatar recompensas não faz você cair de nível." />

      <section aria-labelledby="lv-h" className="surface rounded-2xl p-6 sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="label-mono">Nível atual</p>
            <h2 id="lv-h" className="mt-2 text-[clamp(1.75rem,1.4rem+1vw,2.25rem)] leading-tight text-fg">{s.level.name}</h2>
            <p className="mt-1 text-sm text-muted">
              <span className="font-mono text-fg-soft tabular">{formatNumber(s.totalEarned)}</span> pts acumulados
              {s.level.nextMinPoints != null && <> · faltam <span className="font-mono text-fg-soft tabular">{formatNumber(s.level.nextMinPoints - s.totalEarned)}</span> para {s.level.nextName}</>}
            </p>
          </div>
          <div className="flex gap-8">
            <Stat icon={Flame} label="Sequência" value={`${s.streakDays}`} unit={s.streakDays === 1 ? 'dia' : 'dias'} />
            <Stat icon={Medal} label="Medalhas" value={`${earned}`} unit={`de ${s.badges.length}`} />
          </div>
        </div>
        <LevelLadder s={s} />
      </section>

      <div className="mt-12 grid grid-cols-1 gap-12 lg:grid-cols-[1fr_1.15fr]">
        <section aria-labelledby="ch-h">
          <SectionHeading id="ch-h" title="Desafios" description="Metas com prazo que rendem pontos bônus ao serem concluídas." />
          {active.length === 0 && done.length === 0 ? (
            <EmptyState compact icon={Target} title="Sem desafios no momento" description="Novos desafios são publicados pela coordenação do programa." />
          ) : (
            <>
              {active.length > 0 && (
                <div className="divide-y divide-line border-y border-line">
                  {active.map((c) => <ChallengeRow key={c.id} c={c} />)}
                </div>
              )}
              {done.length > 0 && (
                <>
                  <p className="label-mono mt-8 mb-2">Concluídos</p>
                  <div className="divide-y divide-line border-y border-line opacity-80">
                    {done.map((c) => <ChallengeRow key={c.id} c={c} dense />)}
                  </div>
                </>
              )}
            </>
          )}
        </section>

        <section aria-labelledby="bd-h">
          <SectionHeading id="bd-h" title="Medalhas" description={`${earned} de ${s.badges.length} conquistadas · bronze, prata, ouro e diamante.`} />
          {s.badges.length === 0 ? <EmptyState compact icon={Medal} title="Nenhuma medalha disponível" /> : (
            <ul className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
              {badges.map((b) => <BadgeRow key={b.code} b={b} />)}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}

function Stat({ icon: Icon, label, value, unit }: { icon: typeof Flame; label: string; value: string; unit: string }) {
  return (
    <div>
      <p className="label-mono flex items-center gap-1.5"><Icon className="size-3.5" aria-hidden />{label}</p>
      <p className="mt-2 flex items-baseline gap-1.5"><span className="font-mono text-[28px] leading-none font-medium tracking-[-0.03em] text-fg">{value}</span><span className="text-sm text-muted">{unit}</span></p>
    </div>
  );
}

function LevelLadder({ s }: { s: GamificationSummary }) {
  const levels = [...s.levels].sort((a, b) => a.minPoints - b.minPoints);
  return (
    <ol className="mt-8 grid gap-0 border-t border-line pt-6 sm:grid-cols-[repeat(var(--n),minmax(0,1fr))]" style={{ ['--n' as string]: levels.length }} aria-label="Escada de níveis">
      {levels.map((l, i) => {
        const reached = s.totalEarned >= l.minPoints;
        const current = l.index === s.level.index;
        const next = levels[i + 1];
        const segment = current && next ? s.level.progress : reached ? 1 : 0;
        return (
          <li key={l.index} className="relative flex gap-3 pb-5 sm:block sm:pb-0" aria-current={current ? 'step' : undefined}>
            {/* trilho */}
            <div className="relative hidden h-2.5 items-center sm:flex">
              <span className={cn('relative z-10 size-2.5 shrink-0 rounded-full', reached ? 'bg-brand-500' : 'border border-line-strong bg-bg')}>
                {current && <span className="absolute -inset-1.5 rounded-full border border-fg/40" aria-hidden />}
              </span>
              {next && (
                <span className="mx-1.5 h-0.5 flex-1 overflow-hidden rounded-full bg-white/8">
                  <span className="block h-full rounded-full bg-brand-500" style={{ width: `${segment * 100}%` }} />
                </span>
              )}
            </div>
            <span className={cn('mt-1 size-2.5 shrink-0 rounded-full sm:hidden', reached ? 'bg-brand-500' : 'border border-line-strong')} aria-hidden />
            <div className="sm:mt-3 sm:pr-3">
              <p className={cn('flex items-center gap-1.5 text-sm', current ? 'font-semibold text-fg' : reached ? 'text-fg-soft' : 'text-subtle')}>
                {l.name}{reached && !current && <Check className="size-3.5 text-success" aria-label="alcançado" />}
              </p>
              <p className="font-mono text-[11px] text-subtle tabular">{formatNumber(l.minPoints)} pts</p>
              {current && next && <ProgressBar className="mt-2 sm:hidden" value={s.level.progress} size="xs" valueLabel={null} />}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function BadgeRow({ b }: { b: Badge }) {
  const Icon = iconByName(b.icon, Medal);
  const tier = badgeTier[b.tier];
  return (
    <li className={cn('flex items-start gap-3.5 border-b border-line py-4', !b.earned && 'opacity-55')}>
      <span className="relative flex size-11 shrink-0 items-center justify-center rounded-full"
        style={b.earned ? { backgroundColor: hexAlpha(tier.color, 0.12), boxShadow: `inset 0 0 0 1px ${hexAlpha(tier.color, 0.45)}`, color: tier.color } : { boxShadow: 'inset 0 0 0 1px rgb(236 239 234 / 0.12)', color: '#7d8680' }}>
        {b.earned ? <Icon className="size-5" strokeWidth={1.6} aria-hidden /> : <Lock className="size-4" aria-hidden />}
      </span>
      <div className="min-w-0">
        <p className="flex flex-wrap items-baseline gap-x-2 text-sm font-medium text-fg">
          {b.name}
          <span className="font-mono text-[10px] font-normal tracking-wider text-subtle uppercase">{tier.label}</span>
        </p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted">{b.description}</p>
        <p className="mt-1 font-mono text-[11px] text-subtle tabular">{b.earned ? `Conquistada em ${formatDate(b.awardedAt)}` : 'Bloqueada'}</p>
      </div>
    </li>
  );
}
