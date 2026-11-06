// Ranking por pessoa, residência, bairro ou organização, filtrado por período.
import { useState } from 'react';
import { Building2, Crown, Home, MapPinned, Trophy, Users } from 'lucide-react';
import { useRanking } from '@/api/queries';
import type { RankingEntry, RankingPeriod, RankingScope } from '@/api/types';
import { Avatar, EstadoVazio, EstadoErro, CabecalhoPagina, Esqueleto, EsqueletoTexto, Abas } from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatarKg, formatarNumero } from '@/lib/format';
import { periodoRanking } from '@/lib/labels';

const ESCOPOS: { value: RankingScope; label: string; icon: typeof Users }[] = [
  { value: 'USER', label: 'Pessoas', icon: Users },
  { value: 'HOUSEHOLD', label: 'Residências', icon: Home },
  { value: 'NEIGHBORHOOD', label: 'Bairros', icon: MapPinned },
  { value: 'ORGANIZATION', label: 'Organizações', icon: Building2 },
];
const PERIODOS: RankingPeriod[] = ['WEEK', 'MONTH', 'YEAR', 'ALL'];
const TEXTO_PERIODO: Record<RankingPeriod, string> = { WEEK: 'nesta semana', MONTH: 'neste mês', YEAR: 'neste ano', ALL: 'desde o início' };
const TEXTO_EU: Record<RankingScope, string> = { USER: 'Você', HOUSEHOLD: 'Sua casa', NEIGHBORHOOD: 'Seu bairro', ORGANIZATION: 'Sua organização' };

export default function PaginaRanking() {
  const [escopo, setEscopo] = useState<RankingScope>('USER');
  const [periodo, setPeriodo] = useState<RankingPeriod>('MONTH');
  const q = useRanking(escopo, periodo);

  // 1. O servidor devolve a lista e, à parte, a posição de quem está logado ("me").
  // Só o top 10; quem está fora dele vê a própria posição logo abaixo da lista.
  const posicoes = (q.data?.entries ?? []).slice(0, 10);
  // 2. Os 3 primeiros vão para o pódio; do 4º ao 10º, para a tabela.
  const podio = posicoes.slice(0, 3);
  const demais = posicoes.slice(3);
  const eu = q.data?.me ?? null;
  // 3. Se a pessoa não está no top 10, aparece uma linha extra "Você" no fim, com a posição real.
  const euForaDoTopo = !!eu && !posicoes.some((e) => e.isMe);
  const IconeEscopo = ESCOPOS.find((s) => s.value === escopo)!.icon;

  return (
    <>
      <CabecalhoPagina sobretitulo="Comunidade" title="Ranking"
        description={`Quem mais reciclou ${TEXTO_PERIODO[periodo]}. Pontos de descartes aprovados; o peso em kg aparece ao lado para comparação.`} />

      <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <Abas idBase="rk-scope" aria-label="Agrupar por" value={escopo} onChange={setEscopo}
          itens={ESCOPOS.map((s) => ({ value: s.value, label: s.label }))} />
        <Abas idBase="rk-period" aria-label="Período" variant="underline" value={periodo} onChange={setPeriodo}
          itens={PERIODOS.map((p) => ({ value: p, label: periodoRanking[p].label }))} />
      </div>

      {q.isPending ? (
        <div className="space-y-6"><Esqueleto className="h-56 rounded-2xl" /><EsqueletoTexto linhas={6} /></div>
      ) : q.error ? <EstadoErro erro={q.error} aoTentarDeNovo={q.refetch} /> : posicoes.length === 0 ? (
        <EstadoVazio icon={Trophy} title="Ninguém pontuou neste período ainda" description="Seja o primeiro: registre um descarte e ele entra no ranking assim que for aprovado." />
      ) : (
        <div className={cn('transition-opacity', q.isPlaceholderData && 'opacity-60')}>
          <Podio posicoes={podio} escopo={escopo} />

          {demais.length > 0 && (
            <>
              <div className="mt-10 mb-2 grid grid-cols-[40px_1fr_auto] gap-4 px-3 font-mono text-[11px] tracking-wider text-subtle uppercase sm:grid-cols-[48px_1fr_110px_110px]">
                <span>#</span><span>Nome</span><span className="hidden text-right sm:block">Reciclado</span><span className="text-right">Pontos</span>
              </div>
              <ol className="divide-y divide-line border-y border-line">
                {demais.map((e) => (
                  <li key={String(e.id)}><Linha e={e} escopo={escopo} icon={IconeEscopo} /></li>
                ))}
              </ol>
            </>
          )}

          {euForaDoTopo && (
            <section aria-label="Sua posição" className="mt-4">
              <p aria-hidden className="py-1 text-center font-mono text-xs text-subtle">···</p>
              <div className="surface-raised rounded-xl"><Linha e={eu} escopo={escopo} icon={IconeEscopo} fixo /></div>
            </section>
          )}
          {!eu && (
            <p className="mt-6 text-sm text-muted">
              {escopo === 'HOUSEHOLD' ? 'Você ainda não faz parte de uma residência — crie ou entre em uma em “Minha casa”.' :
                escopo === 'ORGANIZATION' ? 'Associe-se a uma turma, escola ou empresa no seu perfil para aparecer aqui.' :
                  'Você ainda não pontuou neste período.'}
            </p>
          )}
        </div>
      )}
    </>
  );
}

function Linha({ e, escopo, icon: Icone, fixo }: { e: RankingEntry; escopo: RankingScope; icon: typeof Users; fixo?: boolean }) {
  return (
    <div className={cn('grid grid-cols-[40px_1fr_auto] items-center gap-4 px-3 py-3 sm:grid-cols-[48px_1fr_110px_110px]',
      e.isMe && !fixo && 'bg-white/[0.035]')}>
      <span className="font-mono text-sm text-muted tabular">{e.position}</span>
      <span className="flex min-w-0 items-center gap-3">
        {escopo === 'USER' ? <Avatar nome={e.name} size="sm" /> : (
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-line text-subtle"><Icone className="size-4" aria-hidden /></span>
        )}
        <span className="min-w-0">
          <span className="flex items-center gap-2 text-sm font-medium text-fg">
            <span className="truncate">{e.name}</span>
            {e.isMe && <span className="shrink-0 rounded-md bg-accent px-1.5 py-px text-[11px] font-semibold text-accent-ink">{TEXTO_EU[escopo]}</span>}
          </span>
          {(e.subtitle || fixo) && <span className="block truncate text-xs text-subtle">{fixo ? 'Sua posição' : e.subtitle}</span>}
        </span>
      </span>
      <span className="hidden text-right font-mono text-sm text-muted tabular sm:block">{formatarKg(e.kg)}</span>
      <span className="text-right font-mono text-sm text-fg tabular">{formatarNumero(e.points)}</span>
    </div>
  );
}

/** Pódio sóbrio: 2º · 1º · 3º, alturas proporcionais aos pontos, só o 1º com a cor de dado. */
function Podio({ posicoes, escopo }: { posicoes: RankingEntry[]; escopo: RankingScope }) {
  const ordem = [posicoes[1], posicoes[0], posicoes[2]].filter(Boolean) as RankingEntry[];
  const maximo = Math.max(...posicoes.map((e) => e.points), 1);
  return (
    <ol className="grid grid-cols-3 items-end gap-3 sm:gap-6" aria-label="Três primeiros colocados">
      {ordem.map((e) => {
        const primeiro = e.position === 1;
        const altura = 56 + (e.points / maximo) * (primeiro ? 104 : 80);
        return (
          <li key={String(e.id)} className={cn('flex min-w-0 flex-col items-center text-center', primeiro ? 'order-2' : e.position === 2 ? 'order-1' : 'order-3')}>
            {primeiro && <Crown className="mb-2 size-5 text-fg-soft" strokeWidth={1.5} aria-hidden />}
            {escopo === 'USER' ? <Avatar nome={e.name} size={primeiro ? 'lg' : 'md'} /> : null}
            <p className="mt-3 w-full truncate text-sm font-medium text-fg">{e.name}</p>
            {e.isMe && <span className="mt-1 rounded-md bg-accent px-1.5 py-px text-[11px] font-semibold text-accent-ink">{TEXTO_EU[escopo]}</span>}
            <p className="mt-0.5 w-full truncate text-xs text-subtle">{e.subtitle ?? formatarKg(e.kg)}</p>
            <div className={cn('mt-4 flex w-full flex-col items-center justify-start rounded-t-xl border-x border-t pt-4', primeiro ? 'border-brand-500/40 bg-brand-500/[0.07]' : 'border-line bg-surface')} style={{ height: altura }}>
              <span className={cn('font-mono text-3xl leading-none font-medium tracking-[-0.04em] sm:text-4xl', primeiro ? 'text-fg' : 'text-fg-soft')}>{e.position}</span>
              <span className="mt-2 font-mono text-xs text-muted tabular">{formatarNumero(e.points)} pts</span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
