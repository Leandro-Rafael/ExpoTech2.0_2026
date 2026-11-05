import { useMemo } from 'react';
import { Link } from 'react-router';
import { ArrowRight, Flame, Gift, Home, MapPinned, Medal, Recycle, ScanLine, Trophy } from 'lucide-react';
import { useDisposals, useGamificationSummary, useHousehold, useHouseholdBins, useImpactSummary } from '@/api/queries';
import { useUser } from '@/auth/AuthProvider';
import { ButtonLink, EmptyState, ErrorState, PageHeader, ProgressBar, Skeleton, SkeletonText } from '@/components/ui';
import { BinMeter, ChallengeRow, DisposalRow, SectionHeading, TextLink } from '@/features/resident/shared';
import { useCountUpText } from '@/hooks/useCountUp';
import { cn } from '@/lib/cn';
import { formatKg, formatNumber, formatPercent } from '@/lib/format';

function greeting(d = new Date()) {
  const h = d.getHours();
  return h < 5 ? 'Boa noite' : h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
}
const todayLabel = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());

function monthKey(offset = 0) {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function Delta({ now, prev, unit }: { now: number; prev: number; unit: string }) {
  if (!prev && !now) return <span className="text-subtle">sem registros no mês passado</span>;
  if (!prev) return <span className="text-subtle">primeiro mês com registros</span>;
  const d = (now - prev) / prev;
  return (
    <span>
      <span className={cn('font-mono tabular', d >= 0 ? 'text-success' : 'text-warning')}>{d >= 0 ? '+' : ''}{formatPercent(d, 0)}</span>
      <span className="text-subtle"> vs. mês passado ({unit})</span>
    </span>
  );
}

export default function DashboardPage() {
  const user = useUser();
  const first = user.name.split(' ')[0];
  const summary = useGamificationSummary();
  const disposals = useDisposals({ size: 5 });
  const impact = useImpactSummary('ME', 12);
  const household = useHousehold();
  const bins = useHouseholdBins(!!user.household);

  const pointsRef = useCountUpText<HTMLSpanElement>(user.points, (v) => formatNumber(v), { duration: 1200 });
  const level = summary.data?.level ?? user.level;
  const toNext = level.nextMinPoints != null ? Math.max(0, level.nextMinPoints - user.totalEarned) : null;

  const month = useMemo(() => {
    const rows = impact.data?.byMonth ?? [];
    const cur = rows.find((r) => r.month === monthKey(0));
    const prev = rows.find((r) => r.month === monthKey(-1));
    return { kg: cur?.kg ?? 0, co2: cur?.co2AvoidedKg ?? 0, prevKg: prev?.kg ?? 0, prevCo2: prev?.co2AvoidedKg ?? 0 };
  }, [impact.data]);

  const activeChallenges = (summary.data?.challenges ?? []).filter((c) => c.active && !c.completed)
    .sort((a, b) => b.progress / b.target - a.progress / a.target).slice(0, 3);
  const pending = disposals.data?.content.filter((d) => d.status === 'PENDING').length ?? 0;

  return (
    <>
      <PageHeader
        eyebrow={todayLabel}
        title={`${greeting()}, ${first}.`}
        description={pending > 0
          ? `Você tem ${pending === 1 ? '1 descarte' : `${pending} descartes`} aguardando análise. Os pontos entram assim que forem aprovados.`
          : 'Cada descarte correto vira pontos, sobe seu nível e entra na conta do impacto da sua cidade.'}
      />

      {/* Faixa principal: saldo + nível | mês | sequência */}
      <section aria-label="Resumo" className="surface grid grid-cols-1 overflow-hidden rounded-2xl lg:grid-cols-[1.35fr_1fr_1fr]">
        <div className="p-6 sm:p-7">
          <p className="label-mono">Saldo de pontos</p>
          <p className="mt-3 flex items-baseline gap-2">
            <span ref={pointsRef} className="font-mono text-[44px] leading-none font-medium tracking-[-0.04em] text-fg sm:text-[52px]" />
            <span className="text-sm text-muted">pts</span>
          </p>
          <p className="mt-2 text-sm text-muted">Disponíveis para trocar em <Link to="/app/recompensas" className="text-fg-soft underline decoration-line-strong underline-offset-4 hover:text-fg">recompensas</Link>.</p>
          <div className="mt-6">
            <div className="mb-2 flex items-baseline justify-between gap-3 text-sm">
              <span className="text-fg">Nível {level.index + 1} · <span className="font-medium">{level.name}</span></span>
              {level.nextName && <span className="text-xs text-subtle">próximo: {level.nextName}</span>}
            </div>
            <ProgressBar value={level.progress} valueLabel={null} size="sm" />
            <p className="mt-2 font-mono text-xs text-subtle tabular">
              {toNext != null ? `faltam ${formatNumber(toNext)} pts acumulados` : 'nível máximo alcançado'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 border-t border-line lg:grid-cols-1 lg:border-t-0 lg:border-l">
          <div className="p-6">
            <p className="label-mono">Este mês</p>
            {impact.isPending ? <Skeleton className="mt-3 h-8 w-24" /> : (
              <p className="mt-3 font-mono text-[26px] leading-none font-medium tracking-[-0.03em] text-fg">{formatKg(month.kg)}</p>
            )}
            <p className="mt-2 text-xs leading-relaxed">{!impact.isPending && <Delta now={month.kg} prev={month.prevKg} unit="kg" />}</p>
          </div>
          <div className="border-l border-line p-6 lg:border-t lg:border-l-0">
            <p className="label-mono">CO₂ evitado</p>
            {impact.isPending ? <Skeleton className="mt-3 h-8 w-24" /> : (
              <p className="mt-3 font-mono text-[26px] leading-none font-medium tracking-[-0.03em] text-fg">{formatKg(month.co2)}</p>
            )}
            <p className="mt-2 text-xs leading-relaxed text-subtle">emissões que deixaram de ir para a atmosfera neste mês</p>
          </div>
        </div>

        <div className="flex flex-col justify-between border-t border-line p-6 lg:border-t-0 lg:border-l">
          <div>
            <p className="label-mono flex items-center gap-2"><Flame className="size-3.5" aria-hidden /> Sequência</p>
            {summary.isPending ? <Skeleton className="mt-3 h-8 w-20" /> : (
              <p className="mt-3 flex items-baseline gap-2">
                <span className="font-mono text-[26px] leading-none font-medium tracking-[-0.03em] text-fg">{summary.data?.streakDays ?? 0}</span>
                <span className="text-sm text-muted">{summary.data?.streakDays === 1 ? 'dia' : 'dias'}</span>
              </p>
            )}
            <p className="mt-2 text-xs leading-relaxed text-subtle">dias seguidos com descarte aprovado. Registre hoje para não perder.</p>
          </div>
          <StreakDots days={summary.data?.streakDays ?? 0} />
        </div>
      </section>

      <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-[1.4fr_1fr] lg:gap-12">
        {/* Descartes recentes */}
        <section aria-labelledby="recent-h">
          <SectionHeading id="recent-h" title="Descartes recentes" description="Status de análise e pontos de cada registro." action={<TextLink to="/app/descartes">Ver histórico</TextLink>} />
          {disposals.isPending ? <SkeletonText lines={5} /> : disposals.error ? (
            <ErrorState compact error={disposals.error} onRetry={disposals.refetch} />
          ) : disposals.data.content.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-line-strong">
              <EmptyState compact icon={Recycle} title="Seu primeiro descarte começa aqui"
                description="Tire uma foto do resíduo: a IA sugere a categoria e você ganha pontos quando o registro é aprovado."
                action={<ButtonLink to="/app/descartar" variant="secondary" leftIcon={ScanLine}>Registrar agora</ButtonLink>} />
            </div>
          ) : (
            <div className="divide-y divide-line border-y border-line">
              {disposals.data.content.map((d) => <DisposalRow key={d.id} d={d} />)}
            </div>
          )}
        </section>

        {/* Desafios */}
        <section aria-labelledby="ch-h">
          <SectionHeading id="ch-h" title="Desafios ativos" description="Bônus extra ao completar." action={<TextLink to="/app/recompensas?aba=conquistas">Conquistas</TextLink>} />
          {summary.isPending ? <SkeletonText lines={4} /> : summary.error ? (
            <ErrorState compact error={summary.error} onRetry={summary.refetch} />
          ) : activeChallenges.length === 0 ? (
            <p className="border-y border-line py-6 text-sm text-muted">Nenhum desafio ativo agora. Novos desafios aparecem aqui toda semana.</p>
          ) : (
            <div className="divide-y divide-line border-y border-line">
              {activeChallenges.map((c) => <ChallengeRow key={c.id} c={c} dense />)}
            </div>
          )}
        </section>
      </div>

      <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-[1.4fr_1fr] lg:gap-12">
        {/* Smart home */}
        <section aria-labelledby="home-h">
          {user.household ? (
            <>
              <SectionHeading id="home-h" title={household.data?.name ?? user.household.name}
                description="Lixeiras inteligentes da sua casa, atualizadas a cada 20 s." action={<TextLink to="/app/casa">Abrir casa</TextLink>} />
              {bins.isPending ? <SkeletonText lines={3} /> : bins.error ? <ErrorState compact error={bins.error} onRetry={bins.refetch} /> :
                bins.data.length === 0 ? (
                  <p className="border-y border-line py-6 text-sm text-muted">Nenhuma lixeira conectada. <Link to="/app/casa" className="text-fg underline decoration-line-strong underline-offset-4">Adicione a primeira</Link> para acompanhar o nível em tempo real.</p>
                ) : (
                  <div className="divide-y divide-line border-y border-line">
                    {bins.data.slice(0, 4).map((b) => <BinMeter key={b.id} bin={b} />)}
                  </div>
                )}
              {household.data && (
                <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-2 text-sm">
                  <div><dt className="text-xs text-subtle">Casa no mês</dt><dd className="font-mono text-fg tabular">{formatKg(household.data.stats.monthKg)}</dd></div>
                  <div><dt className="text-xs text-subtle">Pontos da casa</dt><dd className="font-mono text-fg tabular">{formatNumber(household.data.stats.points)}</dd></div>
                  <div><dt className="text-xs text-subtle">Moradores</dt><dd className="font-mono text-fg tabular">{household.data.members.length}</dd></div>
                </dl>
              )}
            </>
          ) : (
            <div className="surface flex flex-col gap-5 rounded-2xl p-6 sm:flex-row sm:items-center">
              <Home className="size-6 shrink-0 text-fg-soft" aria-hidden strokeWidth={1.6} />
              <div className="min-w-0 flex-1">
                <h3 id="home-h" className="text-[15px] font-semibold text-fg">Conecte sua casa</h3>
                <p className="mt-1 text-sm text-muted">Crie uma residência ou entre com o código de convite. Lixeiras inteligentes pedem a coleta sozinhas quando enchem.</p>
              </div>
              <ButtonLink to="/app/casa" variant="secondary" rightIcon={ArrowRight}>Configurar</ButtonLink>
            </div>
          )}
        </section>

        {/* Atalhos */}
        <nav aria-labelledby="qa-h">
          <SectionHeading id="qa-h" title="Atalhos" />
          <ul className="divide-y divide-line border-y border-line">
            {[
              { to: '/app/mapa', icon: MapPinned, label: 'Ecoponto mais perto', hint: 'Mapa com horários e materiais aceitos' },
              { to: '/app/recompensas', icon: Gift, label: 'Trocar pontos', hint: `${formatNumber(user.points)} pts disponíveis` },
              { to: '/app/recompensas?aba=ranking', icon: Trophy, label: 'Ranking do mês', hint: 'Pessoas, residências e bairros' },
              { to: '/app/recompensas?aba=conquistas', icon: Medal, label: 'Medalhas e níveis', hint: `${summary.data?.badges.filter((b) => b.earned).length ?? '—'} medalhas conquistadas` },
            ].map((a) => (
              <li key={a.to}>
                <Link to={a.to} className="group flex items-center gap-4 py-3.5 transition-colors hover:bg-white/[0.015]">
                  <a.icon className="size-4.5 shrink-0 text-subtle transition-colors group-hover:text-fg" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-fg">{a.label}</span>
                    <span className="block truncate text-xs text-subtle">{a.hint}</span>
                  </span>
                  <ArrowRight className="size-4 shrink-0 text-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-fg" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </>
  );
}

/** Últimos 7 dias como pontos: preenchidos = dias da sequência atual. */
function StreakDots({ days }: { days: number }) {
  return (
    <div className="mt-5 flex items-center gap-1.5" aria-hidden>
      {Array.from({ length: 7 }, (_, i) => {
        const on = i >= 7 - Math.min(7, days);
        return <span key={i} className={cn('h-1.5 flex-1 rounded-full', on ? 'bg-brand-500' : 'bg-white/8')} />;
      })}
    </div>
  );
}
