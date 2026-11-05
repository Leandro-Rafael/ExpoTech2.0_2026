// Ranking por pessoa, residência, bairro ou organização, filtrado por período.
import { useState } from 'react';
import { Building2, Crown, Home, MapPinned, Trophy, Users } from 'lucide-react';
import { useRanking } from '@/api/queries';
import type { RankingEntry, RankingPeriod, RankingScope } from '@/api/types';
import { Avatar, EmptyState, ErrorState, PageHeader, Skeleton, SkeletonText, Tabs } from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatKg, formatNumber } from '@/lib/format';
import { rankingPeriod } from '@/lib/labels';

const SCOPES: { value: RankingScope; label: string; icon: typeof Users }[] = [
  { value: 'USER', label: 'Pessoas', icon: Users },
  { value: 'HOUSEHOLD', label: 'Residências', icon: Home },
  { value: 'NEIGHBORHOOD', label: 'Bairros', icon: MapPinned },
  { value: 'ORGANIZATION', label: 'Organizações', icon: Building2 },
];
const PERIODS: RankingPeriod[] = ['WEEK', 'MONTH', 'YEAR', 'ALL'];
const PERIOD_TEXT: Record<RankingPeriod, string> = { WEEK: 'nesta semana', MONTH: 'neste mês', YEAR: 'neste ano', ALL: 'desde o início' };
const ME_TEXT: Record<RankingScope, string> = { USER: 'Você', HOUSEHOLD: 'Sua casa', NEIGHBORHOOD: 'Seu bairro', ORGANIZATION: 'Sua organização' };

export default function RankingPage() {
  const [scope, setScope] = useState<RankingScope>('USER');
  const [period, setPeriod] = useState<RankingPeriod>('MONTH');
  const q = useRanking(scope, period);

  // 1. O servidor devolve a lista e, à parte, a posição de quem está logado ("me").
  // Só o top 10; quem está fora dele vê a própria posição logo abaixo da lista.
  const entries = (q.data?.entries ?? []).slice(0, 10);
  // 2. Os 3 primeiros vão para o pódio; do 4º ao 10º, para a tabela.
  const podium = entries.slice(0, 3);
  const rest = entries.slice(3);
  const me = q.data?.me ?? null;
  // 3. Se a pessoa não está no top 10, aparece uma linha extra "Você" no fim, com a posição real.
  const meOutside = !!me && !entries.some((e) => e.isMe);
  const ScopeIcon = SCOPES.find((s) => s.value === scope)!.icon;

  return (
    <>
      <PageHeader eyebrow="Comunidade" title="Ranking"
        description={`Quem mais reciclou ${PERIOD_TEXT[period]}. Pontos de descartes aprovados; o peso em kg aparece ao lado para comparação.`} />

      <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <Tabs idBase="rk-scope" aria-label="Agrupar por" value={scope} onChange={setScope}
          items={SCOPES.map((s) => ({ value: s.value, label: s.label }))} />
        <Tabs idBase="rk-period" aria-label="Período" variant="underline" value={period} onChange={setPeriod}
          items={PERIODS.map((p) => ({ value: p, label: rankingPeriod[p].label }))} />
      </div>

      {q.isPending ? (
        <div className="space-y-6"><Skeleton className="h-56 rounded-2xl" /><SkeletonText lines={6} /></div>
      ) : q.error ? <ErrorState error={q.error} onRetry={q.refetch} /> : entries.length === 0 ? (
        <EmptyState icon={Trophy} title="Ninguém pontuou neste período ainda" description="Seja o primeiro: registre um descarte e ele entra no ranking assim que for aprovado." />
      ) : (
        <div className={cn('transition-opacity', q.isPlaceholderData && 'opacity-60')}>
          <Podium entries={podium} scope={scope} />

          {rest.length > 0 && (
            <>
              <div className="mt-10 mb-2 grid grid-cols-[40px_1fr_auto] gap-4 px-3 font-mono text-[11px] tracking-wider text-subtle uppercase sm:grid-cols-[48px_1fr_110px_110px]">
                <span>#</span><span>Nome</span><span className="hidden text-right sm:block">Reciclado</span><span className="text-right">Pontos</span>
              </div>
              <ol className="divide-y divide-line border-y border-line">
                {rest.map((e) => (
                  <li key={String(e.id)}><Row e={e} scope={scope} icon={ScopeIcon} /></li>
                ))}
              </ol>
            </>
          )}

          {meOutside && (
            <section aria-label="Sua posição" className="mt-4">
              <p aria-hidden className="py-1 text-center font-mono text-xs text-subtle">···</p>
              <div className="surface-raised rounded-xl"><Row e={me} scope={scope} icon={ScopeIcon} sticky /></div>
            </section>
          )}
          {!me && (
            <p className="mt-6 text-sm text-muted">
              {scope === 'HOUSEHOLD' ? 'Você ainda não faz parte de uma residência — crie ou entre em uma em “Minha casa”.' :
                scope === 'ORGANIZATION' ? 'Associe-se a uma turma, escola ou empresa no seu perfil para aparecer aqui.' :
                  'Você ainda não pontuou neste período.'}
            </p>
          )}
        </div>
      )}
    </>
  );
}

function Row({ e, scope, icon: Icon, sticky }: { e: RankingEntry; scope: RankingScope; icon: typeof Users; sticky?: boolean }) {
  return (
    <div className={cn('grid grid-cols-[40px_1fr_auto] items-center gap-4 px-3 py-3 sm:grid-cols-[48px_1fr_110px_110px]',
      e.isMe && !sticky && 'bg-white/[0.035]')}>
      <span className="font-mono text-sm text-muted tabular">{e.position}</span>
      <span className="flex min-w-0 items-center gap-3">
        {scope === 'USER' ? <Avatar name={e.name} size="sm" /> : (
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-line text-subtle"><Icon className="size-4" aria-hidden /></span>
        )}
        <span className="min-w-0">
          <span className="flex items-center gap-2 text-sm font-medium text-fg">
            <span className="truncate">{e.name}</span>
            {e.isMe && <span className="shrink-0 rounded-md bg-accent px-1.5 py-px text-[11px] font-semibold text-accent-ink">{ME_TEXT[scope]}</span>}
          </span>
          {(e.subtitle || sticky) && <span className="block truncate text-xs text-subtle">{sticky ? 'Sua posição' : e.subtitle}</span>}
        </span>
      </span>
      <span className="hidden text-right font-mono text-sm text-muted tabular sm:block">{formatKg(e.kg)}</span>
      <span className="text-right font-mono text-sm text-fg tabular">{formatNumber(e.points)}</span>
    </div>
  );
}

/** Pódio sóbrio: 2º · 1º · 3º, alturas proporcionais aos pontos, só o 1º com a cor de dado. */
function Podium({ entries, scope }: { entries: RankingEntry[]; scope: RankingScope }) {
  const order = [entries[1], entries[0], entries[2]].filter(Boolean) as RankingEntry[];
  const max = Math.max(...entries.map((e) => e.points), 1);
  return (
    <ol className="grid grid-cols-3 items-end gap-3 sm:gap-6" aria-label="Três primeiros colocados">
      {order.map((e) => {
        const first = e.position === 1;
        const h = 56 + (e.points / max) * (first ? 104 : 80);
        return (
          <li key={String(e.id)} className={cn('flex min-w-0 flex-col items-center text-center', first ? 'order-2' : e.position === 2 ? 'order-1' : 'order-3')}>
            {first && <Crown className="mb-2 size-5 text-fg-soft" strokeWidth={1.5} aria-hidden />}
            {scope === 'USER' ? <Avatar name={e.name} size={first ? 'lg' : 'md'} /> : null}
            <p className="mt-3 w-full truncate text-sm font-medium text-fg">{e.name}</p>
            {e.isMe && <span className="mt-1 rounded-md bg-accent px-1.5 py-px text-[11px] font-semibold text-accent-ink">{ME_TEXT[scope]}</span>}
            <p className="mt-0.5 w-full truncate text-xs text-subtle">{e.subtitle ?? formatKg(e.kg)}</p>
            <div className={cn('mt-4 flex w-full flex-col items-center justify-start rounded-t-xl border-x border-t pt-4', first ? 'border-brand-500/40 bg-brand-500/[0.07]' : 'border-line bg-surface')} style={{ height: h }}>
              <span className={cn('font-mono text-3xl leading-none font-medium tracking-[-0.04em] sm:text-4xl', first ? 'text-fg' : 'text-fg-soft')}>{e.position}</span>
              <span className="mt-2 font-mono text-xs text-muted tabular">{formatNumber(e.points)} pts</span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
