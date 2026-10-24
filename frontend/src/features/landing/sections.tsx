/**
 * Seções da landing. Sistema editorial:
 *  - rótulo mono "01 / Seção" + hairline (sem pílulas)
 *  - h1/h2 em Fraunces; textos em Geist; números em Geist Mono
 *  - acento lima só no CTA primário e na única ênfase do hero
 *  - divisórias em vez de caixas; um visual por seção
 */
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { ArrowRight, ArrowUpRight, BatteryMedium } from 'lucide-react';
import type { PublicStats } from '@/api/types';
import { usePublicStats } from '@/api/queries';
import { ButtonLink } from '@/components/ui';
import { Logo } from '@/components/layout/Logo';
import { useCountUpText } from '@/hooks/useCountUp';
import { useInView } from '@/hooks/useInView';
import { prefersReducedMotion } from '@/hooks/useReducedMotion';
import { formatCompact, formatNumber } from '@/lib/format';
import { cn } from '@/lib/cn';
import { StoryCard } from './StepVisuals';
import { gsap, ScrollTrigger } from './gsap';
import { scrollToY } from './useSmoothScroll';
import { LINKS } from './hero';

// ------------------------------------------------------------------ primitivas

/** "01 / Como funciona" + hairline. */
export function SectionLabel({ index, children }: { index: string; children: ReactNode }) {
  return (
    <div className="mb-10 flex items-center gap-4 lg:mb-14" data-reveal>
      <p className="label-mono shrink-0"><span className="text-fg-soft">{index}</span> / {children}</p>
      <span aria-hidden className="h-px flex-1 bg-line" />
    </div>
  );
}

function Section({ id, className, children, ...rest }: { id?: string; className?: string; children: ReactNode } & Record<`data-${string}`, string | boolean>) {
  return (
    <section id={id} className={cn('relative py-20 lg:py-24', className)} {...rest}>
      <div className="container-app">{children}</div>
    </section>
  );
}

const H2 = ({ children, className }: { children: ReactNode; className?: string }) => (
  <h2 data-reveal className={cn('text-headline max-w-[20ch] text-fg', className)}>{children}</h2>
);
const Lead = ({ children, className }: { children: ReactNode; className?: string }) => (
  <p data-reveal className={cn('mt-6 max-w-[54ch] text-[17px] leading-[1.6] text-muted', className)}>{children}</p>
);

// ------------------------------------------------------------------ 01 como funciona

export const STEPS: { title: string; text: string }[] = [
  { title: 'Registre', text: 'Foto, quantidade e local. Leva menos de 20 segundos.' },
  { title: 'A IA identifica', text: 'Ela sugere a categoria e explica o descarte correto. Você pode corrigir.' },
  { title: 'Validação', text: 'O antifraude barra fotos repetidas e exageros antes da aprovação.' },
  { title: 'Pontos', text: 'Cada descarte aprovado pontua uma única vez. Troque por recompensas.' },
  { title: 'Coleta otimizada', text: 'Os pedidos viram rotas mais curtas para os coletores.' },
];

/**
 * Pin linear por trechos: os passos 01–04 ocupam 1 unidade cada; o 05 (caminhão) ocupa
 * STEP5_SHARE unidades — um pouco mais de rolagem para a sequência traseira → portas → rota.
 */
const STEP5_SHARE = 1.6;
const PIN_UNITS = 4 + STEP5_SHARE;
const unitsToP = (u: number) => (u < 4 ? u : 4 + (u - 4) / STEP5_SHARE);
const pToUnits = (p: number) => (p < 4 ? p : 4 + (p - 4) * STEP5_SHARE);
/** Onde cada passo fica "inteiro" ao navegar pelo clique (05 = início da sequência do caminhão). */
const STEP_TARGET_P = [0.55, 1.6, 2.92, 3.6, 4.22];

export function HowItWorks() {
  // Passo ativo (lista à esquerda) muda 5 vezes; o cartão recebe o progresso contínuo
  // direto no DOM via `progress.current(p)` — sem re-render por quadro.
  const [active, setActive] = useState(0);
  const [pinned] = useState(() => !prefersReducedMotion());
  const progress = useRef<((p: number) => void) | null>(null);
  const trigger = useRef<ScrollTrigger | null>(null);

  useLayoutEffect(() => {
    if (!pinned) return;
    const mm = gsap.matchMedia();
    mm.add('(min-width: 1024px)', () => {
      let last = -1;
      trigger.current = ScrollTrigger.create({
        trigger: '[data-pin="how"]',
        start: 'top top',
        end: () => `+=${window.innerHeight * (PIN_UNITS - 0.4)}`,
        pin: true,
        anticipatePin: 1,
        onUpdate: (self) => {
          const p = unitsToP(self.progress * PIN_UNITS);
          progress.current?.(p);
          const idx = Math.min(STEPS.length - 1, Math.floor(p));
          if (idx !== last) { last = idx; setActive(idx); }
        },
      });
      return () => { trigger.current = null; };
    });
    return () => mm.revert();
  }, [pinned]);

  /** Clique num passo: rola até o ponto do pin em que o cartão daquele passo está completo. */
  const goTo = (i: number) => {
    const st = trigger.current;
    if (st) {
      const y = st.start + ((st.end - st.start) * pToUnits(STEP_TARGET_P[i])) / PIN_UNITS;
      scrollToY(Math.round(y));
      return;
    }
    const el = document.getElementById(`how-step-${i}`);
    if (el) scrollToY(Math.max(0, el.getBoundingClientRect().top + window.scrollY - 88));
  };

  const stepButton = (s: (typeof STEPS)[number], i: number, compact = false) => {
    // Só a lista do pin acompanha o scroll; o índice compacto (celular) é navegação simples.
    const on = !compact && pinned && i === active;
    return (
    <button
      type="button"
      onClick={() => goTo(i)}
      aria-current={on ? 'step' : undefined}
      aria-controls={pinned ? 'how-card' : `how-step-${i}`}
      className={cn(
        'group/step relative grid w-full cursor-pointer text-left outline-offset-4',
        compact ? 'grid-cols-[2rem_1fr] items-baseline py-3' : 'grid-cols-[3rem_1fr] py-3.5',
      )}
    >
      {/* indicador fino à esquerda: cresce no hover/foco (só transform) */}
      <span aria-hidden className="absolute top-3 bottom-3 -left-4 w-px origin-center scale-y-0 bg-fg-soft transition-transform duration-200 ease-[var(--ease-out-expo)] group-hover/step:scale-y-100 group-focus-visible/step:scale-y-100" />
      <span className={cn('font-mono text-[13px] tabular transition-colors duration-200', on ? 'text-accent' : 'text-subtle group-hover/step:text-fg-soft')}>{String(i + 1).padStart(2, '0')}</span>
      <span className="block">
        <span className={cn('block font-medium transition-colors duration-200', compact ? 'text-[15px]' : 'text-[17px]', on ? 'text-fg' : 'text-muted group-hover/step:text-fg')}>{s.title}</span>
        {!compact && <span className={cn('mt-0.5 block text-[14px] leading-relaxed transition-colors duration-200', on ? 'text-fg-soft' : 'text-subtle group-hover/step:text-muted')}>{s.text}</span>}
      </span>
    </button>
    );
  };

  return (
    <section id="como-funciona" data-pin="how" className={cn('relative py-24', pinned && 'lg:flex lg:min-h-[100svh] lg:items-center lg:py-0')}>
      <div className={cn('container-app w-full', pinned && 'lg:pt-16')}>
        <SectionLabel index="01">Como funciona</SectionLabel>
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-8">
          <div className={cn(pinned ? 'lg:col-span-5' : 'lg:col-span-12')}>
            <h2 className="text-headline text-fg" data-reveal>Do descarte aos pontos, em cinco passos.</h2>
            {pinned && (
              /* Desktop: lista navegável; o passo ativo segue o scroll */
              <nav aria-label="Passos" className="mt-10 hidden lg:block">
                <ol className="border-t border-line">
                  {STEPS.map((s, i) => <li key={s.title} className="border-b border-line">{stepButton(s, i)}</li>)}
                </ol>
              </nav>
            )}
            {/* Celular/tablet (e movimento reduzido): índice compacto que leva ao cartão empilhado */}
            <nav aria-label="Passos" className={cn('mt-8', pinned && 'lg:hidden')} data-reveal>
              <ol className="grid grid-cols-1 border-t border-line sm:grid-cols-2 sm:gap-x-8">
                {STEPS.map((s, i) => <li key={s.title} className="border-b border-line pl-4">{stepButton(s, i, true)}</li>)}
              </ol>
            </nav>
          </div>
          {pinned && (
            <div id="how-card" className="hidden items-center lg:col-span-6 lg:col-start-7 lg:flex">
              {/* um só cartão contínuo: a mesma garrafa atravessa os 5 passos */}
              <StoryCard mode="scroll" progressRef={progress} />
            </div>
          )}

          {/* Celular/tablet e movimento reduzido: passos empilhados, cada um no estado final */}
          <ol className={cn('grid gap-14 md:grid-cols-2 lg:col-span-12', pinned && 'lg:hidden')}>
            {STEPS.map((s, i) => (
              <li key={s.title} id={`how-step-${i}`} data-reveal className="scroll-mt-24">
                <p className="font-mono text-[13px] text-subtle">{String(i + 1).padStart(2, '0')}</p>
                <h3 className="mt-2 text-[19px] font-medium text-fg">{s.title}</h3>
                <p className="mt-1 mb-6 text-[15px] leading-relaxed text-muted">{s.text}</p>
                <StoryCard mode="static" step={i} />
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

// ------------------------------------------------------------------ 02 casa conectada

const THRESHOLD = 85; // limite de coleta automática configurado pela família
// Cores das categorias dessaturadas (~60–70%) para conviver com a base neutra.
const BINS = [
  { name: 'Plástico', color: '#c06a62', fill: 72, battery: 88 },
  { name: 'Papel', color: '#6587bd', fill: 38, battery: 64 },
  { name: 'Orgânico', color: '#8c9b58', fill: 91, battery: 52 },
];

export function SmartHome() {
  const [ref, inView] = useInView<HTMLDivElement>({ threshold: 0.3 });
  return (
    <Section id="casa" className="contain-section">
      <SectionLabel index="02">Casa conectada</SectionLabel>
      <div className="grid items-start gap-16 lg:grid-cols-12 lg:gap-8">
        <div className="lg:sticky lg:top-28 lg:col-span-5">
          <H2>Sua casa avisa quando a lixeira enche.</H2>
          <Lead>Sensores medem o nível de cada lixeira. Quando chega ao limite que você definiu, o pedido de coleta é criado sozinho.</Lead>
          <dl className="mt-10 border-t border-line" data-reveal>
            {[
              ['Sensores', 'Nível e bateria enviados em tempo real'],
              ['Coleta', 'Pedido automático no limite escolhido'],
              ['Família', 'Todos somam pontos na mesma residência'],
            ].map(([k, v]) => (
              <div key={k} className="grid grid-cols-[7rem_1fr] gap-4 border-b border-line py-4 text-[15px]">
                <dt className="label-mono pt-0.5">{k}</dt>
                <dd className="text-fg-soft">{v}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div ref={ref} data-reveal className="surface rounded-2xl lg:col-span-6 lg:col-start-7">
          <div className="flex items-center justify-between border-b border-line px-5 py-4 sm:px-6">
            <div>
              <p className="text-[15px] font-medium text-fg">Casa Oliveira</p>
              <p className="text-[13px] text-muted">Vila Mariana · 3 lixeiras</p>
            </div>
            <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-brand-300 uppercase"><span className="size-1.5 rounded-full bg-brand-300" />online</span>
          </div>
          <p className="label-mono border-b border-line px-5 py-2.5 text-[10.5px] sm:px-6">Limite de coleta automática · {THRESHOLD}%</p>
          <div className="grid grid-cols-3 divide-x divide-line">
            {BINS.map((b, i) => (
              <div key={b.name} className="px-4 py-6 sm:px-6">
                <div className="flex justify-center">
                  {/* medidor: trilho escuro; preenchimento dessaturado, mais escuro na base; realce no topo; marca do limite */}
                  <div className="relative">
                    <div className="relative h-32 w-7 overflow-hidden rounded-[5px] bg-[#0c110e] shadow-[inset_0_0_0_1px_rgb(236_239_234/0.08)] sm:h-44 sm:w-11">
                      <div className="absolute inset-x-0 bottom-0 origin-bottom transition-transform duration-[1200ms] ease-[var(--ease-out-expo)]"
                        style={{ height: `${b.fill}%`, transform: `scaleY(${inView ? 1 : 0.04})`, transitionDelay: `${i * 120}ms`, background: `linear-gradient(180deg, ${b.color}e6 0%, ${b.color}a6 55%, ${b.color}59 100%)` }}>
                        <div className="absolute inset-x-0 top-0 h-px bg-white/40" />
                      </div>
                    </div>
                    {/* marca do limite: atravessa o medidor e sai 4px para cada lado */}
                    <div aria-hidden className="absolute -inset-x-1 h-[1.5px] rounded-full bg-fg/85" style={{ bottom: `${THRESHOLD}%` }} />
                  </div>
                </div>
                <p className="mt-4 text-center text-[14px] text-fg">{b.name}</p>
                <p className={cn('text-center font-mono text-[15px] tabular', b.fill >= THRESHOLD ? 'text-warning' : 'text-fg')}>{b.fill}%</p>
                <p className="mt-0.5 inline-flex w-full items-center justify-center gap-1 font-mono text-[11px] text-subtle"><BatteryMedium className="size-3" aria-hidden />{b.battery}%</p>
              </div>
            ))}
          </div>
          <p className="border-t border-line px-5 py-4 text-[14px] text-muted sm:px-6">
            Coleta de orgânicos agendada para <span className="text-fg">amanhã, 08:30</span>.
          </p>
        </div>
      </div>
    </Section>
  );
}

// ------------------------------------------------------------------ 03 impacto (dados reais)

const FALLBACK_STATS: PublicStats = {
  totalKg: 48210, recycledKg: 39870, co2AvoidedKg: 61240, treesEquivalent: 2780,
  users: 1260, households: 412, disposals: 9840, collectionPoints: 38,
};

function BigNumber({ value, unit, label, start, compact }: { value: number; unit?: string; label: string; start: boolean; compact?: boolean }) {
  const fmt = (n: number) => (compact && value >= 10000 ? formatCompact(n) : formatNumber(n));
  const numRef = useCountUpText<HTMLSpanElement>(value, fmt, { start, duration: 1800 });
  return (
    <div className="py-8 lg:px-8 lg:py-2 lg:first:pl-0">
      <p className="font-mono text-[40px] leading-none font-medium tracking-[-0.04em] text-fg tabular sm:text-[48px] xl:text-[52px]">
        <span ref={numRef} />{unit && <span className="ml-1.5 text-[0.4em] font-normal tracking-normal text-subtle">{unit}</span>}
      </p>
      <p className="mt-3 max-w-[22ch] text-[14px] text-muted">{label}</p>
    </div>
  );
}

export function ImpactStats() {
  const { data, isError, isPending } = usePublicStats();
  const [ref, inView] = useInView<HTMLDivElement>({ threshold: 0.25 });
  const stats = data ?? FALLBACK_STATS;
  const demo = !data && (isError || !isPending);
  return (
    <Section id="impacto" className="contain-section">
      <SectionLabel index="03">Impacto</SectionLabel>
      <H2>Resultados medidos a cada descarte aprovado.</H2>
      <div ref={ref} data-reveal className="mt-12 grid divide-y divide-line border-y border-line sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x lg:py-10">
        <BigNumber start={inView} value={stats.recycledKg} unit="kg" label="encaminhados para reciclagem" />
        <BigNumber start={inView} value={stats.co2AvoidedKg} unit="kg" label="de CO₂ que deixaram de ser emitidos" />
        <BigNumber start={inView} value={stats.treesEquivalent} label="árvores equivalentes" />
        <BigNumber start={inView} value={stats.disposals} label="descartes registrados" />
      </div>
      <div className="mt-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center" data-reveal>
        <p className="text-[14px] text-muted">
          <span className="font-mono text-fg tabular">{formatNumber(stats.users)}</span> pessoas ·{' '}
          <span className="font-mono text-fg tabular">{formatNumber(stats.households)}</span> residências ·{' '}
          <span className="font-mono text-fg tabular">{formatNumber(stats.collectionPoints)}</span> ecopontos
        </p>
        <p className="label-mono text-[11px]">{demo ? 'Valores ilustrativos · servidor offline' : 'Dados ao vivo da comunidade'}</p>
      </div>
    </Section>
  );
}

// ------------------------------------------------------------------ 04 recursos (linhas editoriais)

const FEATURES = [
  { title: 'Identificação por foto', text: 'IA no servidor e no próprio navegador sugere a categoria com nível de confiança.', tag: 'IA' },
  { title: 'Antifraude', text: 'Fotos repetidas, limites por categoria e pontuação única por descarte.', tag: 'Segurança' },
  { title: 'Rotas otimizadas', text: 'Vizinho mais próximo com 2-opt, mostrando os quilômetros economizados.', tag: 'Logística' },
  { title: 'Ranking', text: 'Por pessoa, residência, bairro, turma ou empresa, na semana, no mês ou no ano.', tag: 'Comunidade' },
  { title: 'Simulador 2050', text: 'Ajuste metas de reciclagem e veja aterro, CO₂ e empregos verdes até 2050.', tag: 'Impacto' },
  { title: 'Painel administrativo', text: 'Moderação, ecopontos, catálogo, lixeiras, auditoria e relatórios em CSV.', tag: 'Gestão' },
];

export function Features() {
  return (
    <Section id="recursos" className="contain-section">
      <SectionLabel index="04">Recursos</SectionLabel>
      <div className="grid items-start gap-12 lg:grid-cols-12 lg:gap-8">
        <div className="lg:sticky lg:top-28 lg:col-span-4">
          <H2>O que a plataforma faz por você.</H2>
          <p data-reveal className="mt-6 max-w-[34ch] text-[15px] leading-relaxed text-muted">Seis módulos integrados, do celular do morador ao painel da prefeitura.</p>
        </div>
        <ol className="border-t border-line lg:col-span-8">
          {FEATURES.map((f, i) => (
            <li key={f.title} data-reveal className="group grid grid-cols-[2.5rem_1fr] gap-x-4 border-b border-line py-6 sm:grid-cols-[3rem_1fr_auto] sm:items-baseline">
              <span className="font-mono text-[13px] text-subtle tabular">{String(i + 1).padStart(2, '0')}</span>
              <div>
                <h3 className="text-[19px] font-medium text-fg transition-transform duration-300 ease-[var(--ease-out-expo)] group-hover:translate-x-1">{f.title}</h3>
                <p className="mt-1 max-w-[56ch] text-[15px] leading-relaxed text-muted">{f.text}</p>
              </div>
              <span className="label-mono col-start-2 mt-3 text-[11px] sm:col-start-auto sm:mt-0">{f.tag}</span>
            </li>
          ))}
        </ol>
      </div>
    </Section>
  );
}

// ------------------------------------------------------------------ 05 rumo a 2050

const TIMELINE = [
  { year: '2026', title: 'Piloto', text: 'Moradores, turmas e coletores na ExpoTech · UniFECAF.' },
  { year: '2030', title: '40% reciclado', text: 'Bairros participantes desviam 40% dos resíduos do aterro.' },
  { year: '2035', title: 'Casas conectadas', text: 'Uma em cada três casas com lixeira inteligente.' },
  { year: '2040', title: 'Frota inteligente', text: 'Todas as rotas otimizadas, com veículos elétricos.' },
  { year: '2050', title: 'Lixo zero', text: '90% dos resíduos voltam como matéria-prima.' },
];

export function Timeline() {
  return (
    <Section id="2050" className="contain-section" data-timeline>
      <SectionLabel index="05">Rumo a 2050</SectionLabel>
      <H2>Metas claras, ano a ano.</H2>
      <ol className="relative mt-14 grid gap-10 lg:grid-cols-5 lg:gap-8">
        <span aria-hidden className="absolute top-0 bottom-0 left-0 w-px bg-line lg:right-0 lg:bottom-auto lg:h-px lg:w-full" />
        <span aria-hidden data-timeline-line className="absolute top-0 bottom-0 left-0 w-px origin-top bg-brand-300 lg:right-0 lg:bottom-auto lg:h-px lg:w-full lg:origin-left" />
        {TIMELINE.map((t, i) => (
          <li key={t.year} data-reveal className="relative pl-8 lg:pt-8 lg:pl-0">
            <span aria-hidden className={cn('absolute top-1.5 -left-[4px] size-[9px] rounded-full border-2 border-bg lg:-top-[4px] lg:left-0', i === TIMELINE.length - 1 ? 'bg-fg' : 'bg-brand-300')} />
            <p className={cn('font-mono text-[28px] tracking-[-0.03em] tabular', i === TIMELINE.length - 1 ? 'text-fg' : 'text-fg-soft')}>{t.year}</p>
            <p className="mt-3 text-[16px] font-medium text-fg">{t.title}</p>
            <p className="mt-1 text-[14px] leading-relaxed text-muted">{t.text}</p>
          </li>
        ))}
      </ol>
    </Section>
  );
}

// ------------------------------------------------------------------ CTA + rodapé

export function FinalCta() {
  return (
    <Section className="pb-28 lg:pb-32">
      <div className="border-t border-line pt-16 lg:pt-20">
        <div className="grid gap-10 lg:grid-cols-12 lg:items-end lg:gap-8">
          <div className="lg:col-span-7">
            <h2 data-reveal className="text-headline max-w-[16ch] text-fg">Comece pelo próximo descarte.</h2>
            <p data-reveal className="mt-6 max-w-[44ch] text-[17px] text-muted">Crie sua conta em menos de um minuto e acompanhe o impacto da sua casa e do seu bairro.</p>
          </div>
          <div data-reveal className="flex flex-col gap-3 sm:flex-row lg:col-span-5 lg:justify-end">
            <ButtonLink to="/cadastro" size="lg" rightIcon={ArrowRight}>Criar conta grátis</ButtonLink>
            <ButtonLink to="/entrar" size="lg" variant="secondary">Já tenho conta</ButtonLink>
          </div>
        </div>
      </div>
    </Section>
  );
}

export function Footer() {
  return (
    <footer className="cv-auto relative border-t border-line bg-bg py-14">
      <div className="container-app grid gap-10 md:grid-cols-12">
        <div className="md:col-span-6">
          <Logo variant="full" size={34} />
          <p className="mt-6 max-w-[44ch] text-[14px] text-muted">
            Plataforma de gestão de resíduos criada pela equipe EcoTech Zero para a ExpoTech 2026, tema Smart Home 2050.
          </p>
        </div>
        <div className="md:col-span-3">
          <p className="label-mono mb-4">Plataforma</p>
          <ul className="space-y-2.5 text-[14px]">
            {LINKS.slice(0, 4).map((l) => <li key={l.href}><a href={l.href} className="text-fg-soft hover:text-fg">{l.label}</a></li>)}
          </ul>
        </div>
        <div className="md:col-span-3">
          <p className="label-mono mb-4">Acesso</p>
          <ul className="space-y-2.5 text-[14px]">
            <li><Link to="/entrar" className="inline-flex items-center gap-1 text-fg-soft hover:text-fg">Entrar <ArrowUpRight className="size-3.5" /></Link></li>
            <li><Link to="/cadastro" className="inline-flex items-center gap-1 text-fg-soft hover:text-fg">Criar conta <ArrowUpRight className="size-3.5" /></Link></li>
          </ul>
        </div>
      </div>
      <div className="container-app mt-12">
        <div className="flex flex-col justify-between gap-2 border-t border-line pt-6 font-mono text-[12px] text-subtle sm:flex-row">
          <p>© 2026 EcoTech Zero</p>
          <p>ExpoTech 2026 · UniFECAF</p>
        </div>
      </div>
    </footer>
  );
}
