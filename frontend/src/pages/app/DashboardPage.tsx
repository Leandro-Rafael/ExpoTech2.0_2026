import { useMemo } from 'react';
import { Link } from 'react-router';
import { ArrowRight, Flame, Gift, Home, MapPinned, Medal, Recycle, ScanLine, Trophy } from 'lucide-react';
import { useDescartes, useResumoGamificacao, useResidencia, useLixeirasResidencia, useResumoImpacto } from '@/api/queries';
import { useUsuario } from '@/auth/AuthProvider';
import { LinkBotao, EstadoVazio, EstadoErro, CabecalhoPagina, BarraProgresso, Esqueleto, EsqueletoTexto } from '@/components/ui';
import { MedidorLixeira, LinhaDesafio, LinhaDescarte, TituloSecao, LinkTexto } from '@/features/resident/shared';
import { useContagemTexto } from '@/hooks/useCountUp';
import { cn } from '@/lib/cn';
import { formatarKg, formatarNumero, formatarPercentual } from '@/lib/format';

function saudacao(d = new Date()) {
  const h = d.getHours();
  return h < 5 ? 'Boa noite' : h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
}
const rotuloHoje = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());

function chaveMes(deslocamento = 0) {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + deslocamento);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function Variacao({ atual, anterior, unidade }: { atual: number; anterior: number; unidade: string }) {
  if (!anterior && !atual) return <span className="text-subtle">sem registros no mês passado</span>;
  if (!anterior) return <span className="text-subtle">primeiro mês com registros</span>;
  const d = (atual - anterior) / anterior;
  return (
    <span>
      <span className={cn('font-mono tabular', d >= 0 ? 'text-success' : 'text-warning')}>{d >= 0 ? '+' : ''}{formatarPercentual(d, 0)}</span>
      <span className="text-subtle"> vs. mês passado ({unidade})</span>
    </span>
  );
}

// Início do morador: saldo, nível, sequência de dias, impacto e últimos descartes.
export default function PaginaPainel() {
  const usuario = useUsuario();
  const primeiroNome = usuario.name.split(' ')[0];
  const resumo = useResumoGamificacao();
  const descartes = useDescartes({ size: 5 });
  const impacto = useResumoImpacto('ME', 12);
  const residencia = useResidencia();
  const lixeiras = useLixeirasResidencia(!!usuario.household);

  const refPontos = useContagemTexto<HTMLSpanElement>(usuario.points, (v) => formatarNumero(v), { duration: 1200 });
  const nivel = resumo.data?.level ?? usuario.level;
  const faltaProximo = nivel.nextMinPoints != null ? Math.max(0, nivel.nextMinPoints - usuario.totalEarned) : null;

  const mes = useMemo(() => {
    const linhas = impacto.data?.byMonth ?? [];
    const atual = linhas.find((r) => r.month === chaveMes(0));
    const anterior = linhas.find((r) => r.month === chaveMes(-1));
    return { kg: atual?.kg ?? 0, co2: atual?.co2AvoidedKg ?? 0, prevKg: anterior?.kg ?? 0, prevCo2: anterior?.co2AvoidedKg ?? 0 };
  }, [impacto.data]);

  const desafiosAtivos = (resumo.data?.challenges ?? []).filter((c) => c.active && !c.completed)
    .sort((a, b) => b.progress / b.target - a.progress / a.target).slice(0, 3);
  const pendentes = descartes.data?.content.filter((d) => d.status === 'PENDING').length ?? 0;

  return (
    <>
      <CabecalhoPagina
        sobretitulo={rotuloHoje}
        title={`${saudacao()}, ${primeiroNome}.`}
        description={pendentes > 0
          ? `Você tem ${pendentes === 1 ? '1 descarte' : `${pendentes} descartes`} aguardando análise. Os pontos entram assim que forem aprovados.`
          : 'Cada descarte correto vira pontos, sobe seu nível e entra na conta do impacto da sua cidade.'}
      />

      {/* Faixa principal: saldo + nível | mês | sequência */}
      <section aria-label="Resumo" className="surface grid grid-cols-1 overflow-hidden rounded-2xl lg:grid-cols-[1.35fr_1fr_1fr]">
        <div className="p-6 sm:p-7">
          <p className="label-mono">Saldo de pontos</p>
          <p className="mt-3 flex items-baseline gap-2">
            <span ref={refPontos} className="font-mono text-[44px] leading-none font-medium tracking-[-0.04em] text-fg sm:text-[52px]" />
            <span className="text-sm text-muted">pts</span>
          </p>
          <p className="mt-2 text-sm text-muted">Disponíveis para trocar em <Link to="/app/recompensas" className="text-fg-soft underline decoration-line-strong underline-offset-4 hover:text-fg">recompensas</Link>.</p>
          <div className="mt-6">
            <div className="mb-2 flex items-baseline justify-between gap-3 text-sm">
              <span className="text-fg">Nível {nivel.index + 1} · <span className="font-medium">{nivel.name}</span></span>
              {nivel.nextName && <span className="text-xs text-subtle">próximo: {nivel.nextName}</span>}
            </div>
            <BarraProgresso value={nivel.progress} rotuloValor={null} size="sm" />
            <p className="mt-2 font-mono text-xs text-subtle tabular">
              {faltaProximo != null ? `faltam ${formatarNumero(faltaProximo)} pts acumulados` : 'nível máximo alcançado'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 border-t border-line lg:grid-cols-1 lg:border-t-0 lg:border-l">
          <div className="p-6">
            <p className="label-mono">Este mês</p>
            {impacto.isPending ? <Esqueleto className="mt-3 h-8 w-24" /> : (
              <p className="mt-3 font-mono text-[26px] leading-none font-medium tracking-[-0.03em] text-fg">{formatarKg(mes.kg)}</p>
            )}
            <p className="mt-2 text-xs leading-relaxed">{!impacto.isPending && <Variacao atual={mes.kg} anterior={mes.prevKg} unidade="kg" />}</p>
          </div>
          <div className="border-l border-line p-6 lg:border-t lg:border-l-0">
            <p className="label-mono">CO₂ evitado</p>
            {impacto.isPending ? <Esqueleto className="mt-3 h-8 w-24" /> : (
              <p className="mt-3 font-mono text-[26px] leading-none font-medium tracking-[-0.03em] text-fg">{formatarKg(mes.co2)}</p>
            )}
            <p className="mt-2 text-xs leading-relaxed text-subtle">emissões que deixaram de ir para a atmosfera neste mês</p>
          </div>
        </div>

        <div className="flex flex-col justify-between border-t border-line p-6 lg:border-t-0 lg:border-l">
          <div>
            <p className="label-mono flex items-center gap-2"><Flame className="size-3.5" aria-hidden /> Sequência</p>
            {resumo.isPending ? <Esqueleto className="mt-3 h-8 w-20" /> : (
              <p className="mt-3 flex items-baseline gap-2">
                <span className="font-mono text-[26px] leading-none font-medium tracking-[-0.03em] text-fg">{resumo.data?.streakDays ?? 0}</span>
                <span className="text-sm text-muted">{resumo.data?.streakDays === 1 ? 'dia' : 'dias'}</span>
              </p>
            )}
            <p className="mt-2 text-xs leading-relaxed text-subtle">dias seguidos com descarte aprovado. Registre hoje para não perder.</p>
          </div>
          <PontosSequencia dias={resumo.data?.streakDays ?? 0} />
        </div>
      </section>

      <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-[1.4fr_1fr] lg:gap-12">
        {/* Descartes recentes */}
        <section aria-labelledby="recent-h">
          <TituloSecao id="recent-h" title="Descartes recentes" description="Status de análise e pontos de cada registro." acao={<LinkTexto to="/app/descartes">Ver histórico</LinkTexto>} />
          {descartes.isPending ? <EsqueletoTexto linhas={5} /> : descartes.error ? (
            <EstadoErro compacto erro={descartes.error} aoTentarDeNovo={descartes.refetch} />
          ) : descartes.data.content.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-line-strong">
              <EstadoVazio compacto icon={Recycle} title="Seu primeiro descarte começa aqui"
                description="Tire uma foto do resíduo: a IA sugere a categoria e você ganha pontos quando o registro é aprovado."
                acao={<LinkBotao to="/app/descartar" variant="secondary" iconeEsquerda={ScanLine}>Registrar agora</LinkBotao>} />
            </div>
          ) : (
            <div className="divide-y divide-line border-y border-line">
              {descartes.data.content.map((d) => <LinhaDescarte key={d.id} d={d} />)}
            </div>
          )}
        </section>

        {/* Desafios */}
        <section aria-labelledby="ch-h">
          <TituloSecao id="ch-h" title="Desafios ativos" description="Bônus extra ao completar." acao={<LinkTexto to="/app/recompensas?aba=progresso">Conquistas</LinkTexto>} />
          {resumo.isPending ? <EsqueletoTexto linhas={4} /> : resumo.error ? (
            <EstadoErro compacto erro={resumo.error} aoTentarDeNovo={resumo.refetch} />
          ) : desafiosAtivos.length === 0 ? (
            <p className="border-y border-line py-6 text-sm text-muted">Nenhum desafio ativo agora. Novos desafios aparecem aqui toda semana.</p>
          ) : (
            <div className="divide-y divide-line border-y border-line">
              {desafiosAtivos.map((c) => <LinhaDesafio key={c.id} c={c} denso />)}
            </div>
          )}
        </section>
      </div>

      <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-[1.4fr_1fr] lg:gap-12">
        {/* Smart home */}
        <section aria-labelledby="home-h">
          {usuario.household ? (
            <>
              <TituloSecao id="home-h" title={residencia.data?.name ?? usuario.household.name}
                description="Lixeiras inteligentes da sua casa, atualizadas a cada 20 s." acao={<LinkTexto to="/app/casa">Abrir casa</LinkTexto>} />
              {lixeiras.isPending ? <EsqueletoTexto linhas={3} /> : lixeiras.error ? <EstadoErro compacto erro={lixeiras.error} aoTentarDeNovo={lixeiras.refetch} /> :
                lixeiras.data.length === 0 ? (
                  <p className="border-y border-line py-6 text-sm text-muted">Nenhuma lixeira conectada. <Link to="/app/casa" className="text-fg underline decoration-line-strong underline-offset-4">Adicione a primeira</Link> para acompanhar o nível em tempo real.</p>
                ) : (
                  <div className="divide-y divide-line border-y border-line">
                    {lixeiras.data.slice(0, 4).map((b) => <MedidorLixeira key={b.id} lixeira={b} />)}
                  </div>
                )}
              {residencia.data && (
                <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-2 text-sm">
                  <div><dt className="text-xs text-subtle">Casa no mês</dt><dd className="font-mono text-fg tabular">{formatarKg(residencia.data.stats.monthKg)}</dd></div>
                  <div><dt className="text-xs text-subtle">Pontos da casa</dt><dd className="font-mono text-fg tabular">{formatarNumero(residencia.data.stats.points)}</dd></div>
                  <div><dt className="text-xs text-subtle">Moradores</dt><dd className="font-mono text-fg tabular">{residencia.data.members.length}</dd></div>
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
              <LinkBotao to="/app/casa" variant="secondary" iconeDireita={ArrowRight}>Configurar</LinkBotao>
            </div>
          )}
        </section>

        {/* Atalhos */}
        <nav aria-labelledby="qa-h">
          <TituloSecao id="qa-h" title="Atalhos" />
          <ul className="divide-y divide-line border-y border-line">
            {[
              { to: '/app/mapa', icon: MapPinned, label: 'Ecoponto mais perto', hint: 'Mapa com horários e materiais aceitos' },
              { to: '/app/recompensas', icon: Gift, label: 'Trocar pontos', hint: `${formatarNumero(usuario.points)} pts disponíveis` },
              { to: '/app/recompensas?aba=ranking', icon: Trophy, label: 'Ranking do mês', hint: 'Pessoas, residências e bairros' },
              { to: '/app/recompensas?aba=progresso', icon: Medal, label: 'Medalhas e níveis', hint: `${resumo.data?.badges.filter((b) => b.earned).length ?? '—'} medalhas conquistadas` },
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
function PontosSequencia({ dias }: { dias: number }) {
  return (
    <div className="mt-5 flex items-center gap-1.5" aria-hidden>
      {Array.from({ length: 7 }, (_, i) => {
        const ativo = i >= 7 - Math.min(7, dias);
        return <span key={i} className={cn('h-1.5 flex-1 rounded-full', ativo ? 'bg-brand-500' : 'bg-white/8')} />;
      })}
    </div>
  );
}
