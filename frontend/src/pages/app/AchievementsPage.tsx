import { useState } from 'react';
import { Check, Flame, Lock, Medal, ReceiptText, ScanLine, Target } from 'lucide-react';
import { useResumoGamificacao, useExtratoPontos } from '@/api/queries';
import type { Badge, GamificationSummary } from '@/api/types';
import { iconePorNome } from '@/components/icons';
import { LinkBotao, EstadoVazio, EstadoErro, CabecalhoPagina, EsqueletoPagina, Paginacao, BarraProgresso, EsqueletoTexto } from '@/components/ui';
import { LinhaDesafio, TituloSecao } from '@/features/resident/shared';
import { cn } from '@/lib/cn';
import { hexComAlfa } from '@/lib/category';
import { formatarDataCurta, formatarDataHora, formatarNumero, formatarRelativo } from '@/lib/format';
import { nivelMedalha, tipoTransacaoPontos } from '@/lib/labels';

const ORDEM_FAIXA = { DIAMANTE: 0, OURO: 1, PRATA: 2, BRONZE: 3 } as const;

/** Meu progresso: nível e medalhas no topo, desafios logo abaixo e o extrato de pontos no fim. */
export default function PaginaConquistas() {
  const q = useResumoGamificacao();
  if (q.isPending) return <EsqueletoPagina />;
  if (q.error) return (<><CabecalhoPagina sobretitulo="Meu progresso" title="Níveis, medalhas e desafios" /><EstadoErro erro={q.error} aoTentarDeNovo={q.refetch} /></>);
  const s = q.data;
  const conquistadas = s.badges.filter((b) => b.earned).length;
  const ativos = s.challenges.filter((c) => c.active && !c.completed);
  const concluidos = s.challenges.filter((c) => c.completed);
  // Medalhas conquistadas primeiro; dentro de cada grupo, da mais rara (diamante) para a mais comum.
  const medalhas = [...s.badges].sort((a, b) => Number(b.earned) - Number(a.earned) || ORDEM_FAIXA[a.tier] - ORDEM_FAIXA[b.tier]);

  return (
    <>
      <CabecalhoPagina sobretitulo="Meu progresso" title="Níveis, medalhas e desafios"
        description="Seu nível sobe com o total de pontos já ganhos — resgatar recompensas não faz você cair de nível." />

      {/* 1. Nível: calculado pelo total de pontos já ganhos (totalEarned), não pelo saldo atual. */}
      <section aria-labelledby="lv-h" className="surface rounded-2xl p-6 sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="label-mono">Nível atual</p>
            <h2 id="lv-h" className="mt-2 text-[clamp(1.75rem,1.4rem+1vw,2.25rem)] leading-tight text-fg">{s.level.name}</h2>
            <p className="mt-1 text-sm text-muted">
              <span className="font-mono text-fg-soft tabular">{formatarNumero(s.totalEarned)}</span> pts acumulados
              {s.level.nextMinPoints != null && <> · faltam <span className="font-mono text-fg-soft tabular">{formatarNumero(s.level.nextMinPoints - s.totalEarned)}</span> para {s.level.nextName}</>}
            </p>
          </div>
          <div className="flex gap-8">
            <Estatistica icon={Flame} label="Sequência" value={`${s.streakDays}`} unidade={s.streakDays === 1 ? 'dia' : 'dias'} />
            <Estatistica icon={Medal} label="Medalhas" value={`${conquistadas}`} unidade={`de ${s.badges.length}`} />
          </div>
        </div>
        <EscadaNiveis s={s} />
      </section>

      {/* 2. Medalhas */}
      <section aria-labelledby="bd-h" className="mt-12">
        <TituloSecao id="bd-h" title="Medalhas" description={`${conquistadas} de ${s.badges.length} conquistadas · bronze, prata, ouro e diamante.`} />
        {s.badges.length === 0 ? <EstadoVazio compacto icon={Medal} title="Nenhuma medalha disponível" /> : (
          <ul className="grid grid-cols-1 gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
            {medalhas.map((b) => <LinhaMedalha key={b.code} b={b} />)}
          </ul>
        )}
      </section>

      {/* 3. Desafios: primeiro os em andamento, depois os concluídos. */}
      <section aria-labelledby="ch-h" className="mt-12">
          <TituloSecao id="ch-h" title="Desafios"
            description={s.challenges.length ? `${concluidos.length} de ${s.challenges.length} concluídos · cada desafio com prazo rende pontos bônus.` : 'Metas com prazo que rendem pontos bônus ao serem concluídas.'} />
          {ativos.length === 0 && concluidos.length === 0 ? (
            <EstadoVazio compacto icon={Target} title="Sem desafios no momento" description="Novos desafios são publicados pela coordenação do programa." />
          ) : (
            <>
              {ativos.length > 0 && (
                <div className="divide-y divide-line border-y border-line">
                  {ativos.map((c) => <LinhaDesafio key={c.id} c={c} />)}
                </div>
              )}
              {concluidos.length > 0 && (
                <>
                  <p className="label-mono mt-8 mb-2">Concluídos</p>
                  <div className="divide-y divide-line border-y border-line opacity-80">
                    {concluidos.map((c) => <LinhaDesafio key={c.id} c={c} denso />)}
                  </div>
                </>
              )}
            </>
          )}
      </section>

      {/* 4. Extrato de pontos (paginado, carregado à parte). */}
      <section aria-labelledby="lg-h" className="mt-12">
        <TituloSecao id="lg-h" title="Extrato de pontos" description="De onde vieram seus pontos e onde foram usados." />
        <Extrato />
      </section>
    </>
  );
}

function Estatistica({ icon: Icone, label, value, unidade }: { icon: typeof Flame; label: string; value: string; unidade: string }) {
  return (
    <div>
      <p className="label-mono flex items-center gap-1.5"><Icone className="size-3.5" aria-hidden />{label}</p>
      <p className="mt-2 flex items-baseline gap-1.5"><span className="font-mono text-[28px] leading-none font-medium tracking-[-0.03em] text-fg">{value}</span><span className="text-sm text-muted">{unidade}</span></p>
    </div>
  );
}

function EscadaNiveis({ s }: { s: GamificationSummary }) {
  const niveis = [...s.levels].sort((a, b) => a.minPoints - b.minPoints);
  return (
    <ol className="mt-8 grid gap-0 border-t border-line pt-6 sm:grid-cols-[repeat(var(--n),minmax(0,1fr))]" style={{ ['--n' as string]: niveis.length }} aria-label="Escada de níveis">
      {niveis.map((l, i) => {
        const alcancado = s.totalEarned >= l.minPoints;
        const atual = l.index === s.level.index;
        const proximo = niveis[i + 1];
        const segmento = atual && proximo ? s.level.progress : alcancado ? 1 : 0;
        return (
          <li key={l.index} className="relative flex gap-3 pb-5 sm:block sm:pb-0" aria-current={atual ? 'step' : undefined}>
            {/* trilho */}
            <div className="relative hidden h-2.5 items-center sm:flex">
              <span className={cn('relative z-10 size-2.5 shrink-0 rounded-full', alcancado ? 'bg-brand-500' : 'border border-line-strong bg-bg')}>
                {atual && <span className="absolute -inset-1.5 rounded-full border border-fg/40" aria-hidden />}
              </span>
              {proximo && (
                <span className="mx-1.5 h-0.5 flex-1 overflow-hidden rounded-full bg-white/8">
                  <span className="block h-full rounded-full bg-brand-500" style={{ width: `${segmento * 100}%` }} />
                </span>
              )}
            </div>
            <span className={cn('mt-1 size-2.5 shrink-0 rounded-full sm:hidden', alcancado ? 'bg-brand-500' : 'border border-line-strong')} aria-hidden />
            <div className="sm:mt-3 sm:pr-3">
              <p className={cn('flex items-center gap-1.5 text-sm', atual ? 'font-semibold text-fg' : alcancado ? 'text-fg-soft' : 'text-subtle')}>
                {l.name}{alcancado && !atual && <Check className="size-3.5 text-success" aria-label="alcançado" />}
              </p>
              <p className="font-mono text-[11px] text-subtle tabular">{formatarNumero(l.minPoints)} pts</p>
              {atual && proximo && <BarraProgresso className="mt-2 sm:hidden" value={s.level.progress} size="xs" rotuloValor={null} />}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function LinhaMedalha({ b }: { b: Badge }) {
  const Icone = iconePorNome(b.icon, Medal);
  const faixa = nivelMedalha[b.tier];
  return (
    <li className={cn('flex items-start gap-3.5 border-b border-line py-4', !b.earned && 'opacity-55')}>
      <span className="relative flex size-11 shrink-0 items-center justify-center rounded-full"
        style={b.earned ? { backgroundColor: hexComAlfa(faixa.color, 0.12), boxShadow: `inset 0 0 0 1px ${hexComAlfa(faixa.color, 0.45)}`, color: faixa.color } : { boxShadow: 'inset 0 0 0 1px rgb(236 239 234 / 0.12)', color: '#7d8680' }}>
        {b.earned ? <Icone className="size-5" strokeWidth={1.6} aria-hidden /> : <Lock className="size-4" aria-hidden />}
      </span>
      <div className="min-w-0">
        <p className="flex flex-wrap items-baseline gap-x-2 text-sm font-medium text-fg">
          {b.name}
          <span className="font-mono text-[10px] font-normal tracking-wider text-subtle uppercase">{faixa.label}</span>
        </p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted">{b.description}</p>
        <p className="mt-1 font-mono text-[11px] text-subtle tabular">{b.earned ? `Conquistada em ${formatarDataCurta(b.awardedAt)}/${(b.awardedAt ?? '').slice(2, 4)}` : 'Bloqueada'}</p>
      </div>
    </li>
  );
}

// Extrato: cada ganho ou gasto de pontos, com o saldo logo depois da movimentação, 15 por página.
function Extrato() {
  const [pagina, setPagina] = useState(0);
  const q = useExtratoPontos({ page: pagina, size: 15 });
  if (q.isPending) return <EsqueletoTexto linhas={8} />;
  if (q.error) return <EstadoErro erro={q.error} aoTentarDeNovo={q.refetch} />;
  if (q.data.content.length === 0) {
    return <EstadoVazio icon={ReceiptText} title="Sem movimentações" description="Pontos ganhos com descartes aprovados, bônus de desafios e resgates aparecem aqui."
      acao={<LinkBotao to="/app/descartar" variant="secondary" iconeEsquerda={ScanLine}>Registrar descarte</LinkBotao>} />;
  }
  return (
    <>
      <div className="mb-2 hidden grid-cols-[1fr_120px_120px] gap-4 px-0.5 font-mono text-[11px] tracking-wider text-subtle uppercase sm:grid">
        <span>Movimentação</span><span className="text-right">Pontos</span><span className="text-right">Saldo após</span>
      </div>
      <ul className={cn('divide-y divide-line border-y border-line', q.isPlaceholderData && 'opacity-60')}>
        {q.data.content.map((t) => (
          <li key={t.id} className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-0.5 py-3.5 sm:grid-cols-[1fr_120px_120px] sm:items-center">
            <div className="min-w-0">
              <p className="truncate text-sm text-fg">{t.description}</p>
              <p className="text-xs text-subtle"><span title={formatarDataHora(t.createdAt)}>{formatarRelativo(t.createdAt)}</span> · {tipoTransacaoPontos[t.type].label}</p>
            </div>
            <p className={cn('text-right font-mono text-sm tabular', t.amount >= 0 ? 'text-success' : 'text-fg-soft')}>{t.amount >= 0 ? '+' : '−'}{formatarNumero(Math.abs(t.amount))}</p>
            <p className="col-start-2 text-right font-mono text-xs text-subtle tabular sm:col-start-auto sm:text-sm sm:text-muted">
              <span className="sm:hidden">saldo </span>{formatarNumero(t.balanceAfter)}
            </p>
          </li>
        ))}
      </ul>
      <Paginacao className="mt-6" pagina={q.data.page} totalPaginas={q.data.totalPages} totalItens={q.data.totalElements} size={q.data.size} onChange={setPagina} />
    </>
  );
}
