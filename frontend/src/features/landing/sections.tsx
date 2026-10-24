import { useEffect, useLayoutEffect, useState, type MouseEvent, type ReactNode } from 'react';
import { Link } from 'react-router';
import {
  ArrowRight, BarChart3, Battery, BrainCircuit, Building2, Camera, ChevronDown, Crown, Fingerprint, Gift, Home,
  Leaf, Menu, MapPinned, Recycle, Route, ShieldCheck, Sparkles, Trees, Truck, Users, Wifi, X, Zap, BadgeCheck,
  type LucideIcon,
} from 'lucide-react';
import type { PublicStats } from '@/api/types';
import { usePublicStats } from '@/api/queries';
import { useAuth } from '@/auth/AuthProvider';
import { ButtonLink, buttonClasses } from '@/components/ui';
import { Logo } from '@/components/layout/Logo';
import { useCountUpText } from '@/hooks/useCountUp';
import { useInView } from '@/hooks/useInView';
import { formatCompact, formatNumber } from '@/lib/format';
import { cn } from '@/lib/cn';
import { VisualAI, VisualApproval, VisualPoints, VisualRegister, VisualRoute } from './StepVisuals';
import { gsap, ScrollTrigger } from './useSmoothScroll';
import { prefersReducedMotion } from '@/hooks/useReducedMotion';

type ScrollTo = (target: string) => void;

export function SectionEyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-brand-400/25 bg-brand-500/10 px-3 py-1 text-xs font-semibold tracking-[0.14em] text-brand-300 uppercase">
      <span aria-hidden className="size-1.5 rounded-full bg-lime-300 shadow-[0_0_10px_#bef264]" />
      {children}
    </p>
  );
}

// ------------------------------------------------------------------ navegação

const LINKS = [
  { href: '#como-funciona', label: 'Como funciona' },
  { href: '#smart-home', label: 'Smart Home' },
  { href: '#impacto', label: 'Impacto' },
  { href: '#recursos', label: 'Recursos' },
  { href: '#2050', label: 'Rumo a 2050' },
];

export function LandingNav({ scrollTo }: { scrollTo: ScrollTo }) {
  const { status } = useAuth();
  const [open, setOpen] = useState(false);
  // Estado local: rolar a página não re-renderiza as demais seções.
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  const go = (href: string) => (e: MouseEvent) => { e.preventDefault(); setOpen(false); scrollTo(href); };
  return (
    <header className={cn('fixed inset-x-0 top-0 z-50 transition-[padding] duration-500 [will-change:transform]', scrolled ? 'py-2' : 'py-4')}>
      <div className={cn(
        'container-app flex h-14 items-center justify-between rounded-2xl transition-all duration-500',
        scrolled && 'glass-strong max-w-[1180px] px-4! sm:px-5!',
      )}>
        <a href="#topo" onClick={go('#topo')} aria-label="Lixo Zero 2050 — topo"><Logo size={34} /></a>
        <nav aria-label="Seções" className="hidden items-center gap-1 lg:flex">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} onClick={go(l.href)} className="rounded-lg px-3 py-2 text-sm text-fg-soft transition-colors hover:bg-white/5 hover:text-fg">{l.label}</a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          {status === 'authenticated' ? (
            <ButtonLink to="/app" size="md" rightIcon={ArrowRight}>Abrir painel</ButtonLink>
          ) : (
            <>
              <Link to="/entrar" className={buttonClasses({ variant: 'ghost', size: 'md', className: 'max-sm:hidden' })}>Entrar</Link>
              <ButtonLink to="/cadastro" size="md">Criar conta</ButtonLink>
            </>
          )}
          <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="menu-mobile" aria-label={open ? 'Fechar menu' : 'Abrir menu'}
            className="inline-flex size-10 items-center justify-center rounded-lg text-fg-soft hover:bg-white/5 lg:hidden">
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>
      {open && (
        <nav id="menu-mobile" aria-label="Seções" className="glass-strong container-app mx-4! mt-2 w-auto! rounded-2xl p-2! lg:hidden">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} onClick={go(l.href)} className="block rounded-xl px-4 py-3 text-[15px] text-fg-soft hover:bg-white/5">{l.label}</a>
          ))}
          {status !== 'authenticated' && <Link to="/entrar" className="block rounded-xl px-4 py-3 text-[15px] text-brand-300 hover:bg-white/5">Entrar</Link>}
        </nav>
      )}
    </header>
  );
}

// ------------------------------------------------------------------ hero

const HEADLINE: { w: string; grad?: boolean }[] = [
  { w: 'Lixo' }, { w: 'zero', grad: true }, { w: 'até' }, { w: '2050', grad: true }, { w: 'começa' }, { w: 'na' }, { w: 'sua' }, { w: 'casa.' },
];

export function Hero({ scrollTo }: { scrollTo: ScrollTo }) {
  return (
    <section id="topo" className="relative flex min-h-[100svh] items-center pt-28 pb-20 sm:pt-32">
      <div className="container-app relative">
        <div className="max-w-[720px] pt-[34vh] sm:pt-0 lg:max-w-[640px] xl:max-w-[700px]">
          <div data-hero="eyebrow"><SectionEyebrow>ExpoTech 2026 · Smart Home 2050</SectionEyebrow></div>
          <h1 className="font-display text-[44px] leading-[1.02] font-semibold tracking-[-0.035em] text-fg sm:text-6xl lg:text-7xl xl:text-[84px]">
            {HEADLINE.map((h, i) => (
              <span key={i} className="inline-block overflow-hidden pb-[0.08em] align-bottom">
                <span data-hero="word" className={cn('inline-block', h.grad && 'text-gradient')}>{h.w}</span>
                {i < HEADLINE.length - 1 && ' '}
              </span>
            ))}
          </h1>
          <p data-hero="sub" className="mt-6 max-w-xl text-[17px] leading-relaxed text-fg-soft sm:text-lg">
            Fotografe o resíduo, deixe a IA identificar o material, ganhe pontos por cada descarte aprovado e acompanhe
            coletas com rotas otimizadas — da sua cozinha ao seu bairro.
          </p>
          <div data-hero="cta" className="mt-9 flex flex-col gap-3 sm:flex-row">
            <ButtonLink to="/cadastro" size="xl" rightIcon={ArrowRight}>Começar agora — é grátis</ButtonLink>
            <a href="#como-funciona" onClick={(e) => { e.preventDefault(); scrollTo('#como-funciona'); }} className={buttonClasses({ variant: 'secondary', size: 'xl' })}>
              Ver como funciona
            </a>
          </div>
          <ul data-hero="chips" className="mt-10 flex flex-wrap gap-x-6 gap-y-3 text-sm text-muted">
            {[{ i: BrainCircuit, t: 'IA por foto' }, { i: ShieldCheck, t: 'Antifraude' }, { i: Route, t: 'Rotas otimizadas' }, { i: Home, t: 'Casa conectada' }].map((c) => (
              <li key={c.t} className="flex items-center gap-2"><c.i className="size-4 text-brand-300" aria-hidden />{c.t}</li>
            ))}
          </ul>
        </div>

        {/* Cartões flutuantes sobre a cena 3D (desktop) */}
        <div aria-hidden className="pointer-events-none absolute top-1/2 right-4 hidden h-[460px] w-[440px] -translate-y-1/2 xl:block">
          <div data-hero="float" className="glass-strong absolute top-6 left-0 w-56 rounded-2xl p-3.5 animate-float">
            <div className="flex items-center gap-3">
              <span className="inline-flex size-10 items-center justify-center rounded-xl bg-[#ef4444]/15 text-[#f87171]"><Recycle className="size-5" /></span>
              <div><p className="text-[11px] text-muted">IA identificou</p><p className="text-sm font-semibold">Plástico PET · 96%</p></div>
            </div>
          </div>
          <div data-hero="float" className="glass-strong absolute right-0 bottom-16 w-48 rounded-2xl p-3.5 animate-float [animation-delay:-3s]">
            <p className="text-[11px] text-muted">Descarte aprovado</p>
            <p className="font-display text-2xl font-bold text-gradient">+48 pts</p>
          </div>
          <div data-hero="float" className="glass-strong absolute bottom-0 left-10 flex items-center gap-2.5 rounded-full py-2 pr-4 pl-2 animate-float [animation-delay:-5s]">
            <span className="inline-flex size-7 items-center justify-center rounded-full bg-warning/15 text-warning"><Battery className="size-3.5" /></span>
            <span className="text-xs text-fg-soft">Lixeira orgânica 91% · coleta solicitada</span>
          </div>
        </div>
      </div>

      <a href="#como-funciona" onClick={(e) => { e.preventDefault(); scrollTo('#como-funciona'); }}
        className="absolute bottom-6 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-1 text-xs text-muted transition-colors hover:text-fg sm:flex">
        Role para explorar <ChevronDown className="size-4 motion-safe:animate-bounce" aria-hidden />
      </a>
    </section>
  );
}

// ------------------------------------------------------------------ como funciona

export const STEPS: { icon: LucideIcon; title: string; kicker: string; text: string; visual: () => ReactNode }[] = [
  { icon: Camera, kicker: '01', title: 'Registre', text: 'Tire uma foto do resíduo, informe a quantidade e o local. Leva menos de 20 segundos.', visual: VisualRegister },
  { icon: BrainCircuit, kicker: '02', title: 'IA identifica', text: 'A inteligência artificial sugere a categoria e mostra como descartar corretamente. Você pode corrigir.', visual: VisualAI },
  { icon: BadgeCheck, kicker: '03', title: 'Aprovação', text: 'A validação antifraude detecta fotos repetidas e exageros; a equipe aprova em poucos cliques.', visual: VisualApproval },
  { icon: Sparkles, kicker: '04', title: 'Pontos', text: 'Cada descarte aprovado gera pontos uma única vez. Suba de nível, conquiste medalhas e troque por recompensas.', visual: VisualPoints },
  { icon: Truck, kicker: '05', title: 'Coleta otimizada', text: 'As solicitações viram rotas otimizadas para os coletores — menos quilômetros, menos emissões.', visual: VisualRoute },
];

export function HowItWorks() {
  // O passo ativo vive aqui: a troca de passo re-renderiza só esta seção.
  const [active, setActive] = useState(0);
  useLayoutEffect(() => {
    if (prefersReducedMotion()) return;
    const mm = gsap.matchMedia();
    mm.add('(min-width: 1024px)', () => {
      let last = -1;
      ScrollTrigger.create({
        trigger: '[data-pin="how"]',
        start: 'top top',
        end: () => `+=${window.innerHeight * (STEPS.length - 0.4)}`,
        pin: true,
        anticipatePin: 1,
        onUpdate: (self) => {
          const idx = Math.min(STEPS.length - 1, Math.floor(self.progress * STEPS.length));
          if (idx !== last) { last = idx; setActive(idx); }
        },
      });
    });
    return () => mm.revert();
  }, []);
  return (
    <section id="como-funciona" data-pin="how" className="relative py-24 lg:flex lg:min-h-[100svh] lg:items-center lg:py-0">
      <div className="container-app">
        <div className="mb-12 max-w-2xl lg:mb-14" data-reveal>
          <SectionEyebrow>Como funciona</SectionEyebrow>
          <h2 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">Do lixo ao ciclo, em cinco passos.</h2>
        </div>

        {/* Desktop: lista + visual fixado */}
        <div className="hidden gap-16 lg:grid lg:grid-cols-[1fr_1.05fr]">
          <ol className="relative space-y-2">
            <span aria-hidden className="absolute top-3 bottom-3 left-[23px] w-px bg-line-strong" />
            <span aria-hidden className="absolute top-3 bottom-3 left-[23px] w-px origin-top bg-gradient-to-b from-brand-400 to-lime-300 transition-transform duration-500 ease-[var(--ease-out-expo)]" style={{ transform: `scaleY(${active / (STEPS.length - 1)})` }} />
            {STEPS.map((s, i) => (
              <li key={s.title} className={cn('relative flex gap-5 rounded-2xl p-3 transition-opacity duration-500', i === active ? 'opacity-100' : 'opacity-40')}>
                <span className={cn('relative z-10 inline-flex size-12 shrink-0 items-center justify-center rounded-2xl border transition-colors duration-500',
                  i <= active ? 'border-brand-300/50 bg-brand-500/20 text-brand-300 shadow-glow' : 'border-line-strong bg-surface text-subtle')}>
                  <s.icon className="size-5" aria-hidden />
                </span>
                <div className="pt-1">
                  <p className="text-xs font-semibold tracking-[0.08em] text-subtle tabular">{s.kicker}</p>
                  <h3 className="font-display text-2xl font-semibold">{s.title}</h3>
                  <p className={cn('mt-1 max-w-md text-[15px] leading-relaxed text-muted transition-opacity duration-500', i === active ? 'opacity-100' : 'opacity-0')}>{s.text}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="relative flex items-center">
            {STEPS.map((s, i) => (
              <div key={s.title} aria-hidden={i !== active}
                className={cn('absolute inset-x-0 transition-all duration-700 ease-[var(--ease-out-expo)]',
                  i === active ? 'translate-y-0 scale-100 opacity-100' : i < active ? '-translate-y-6 scale-[0.97] opacity-0' : 'translate-y-6 scale-[0.97] opacity-0')}>
                <s.visual />
              </div>
            ))}
            <div className="invisible w-full" aria-hidden><VisualRoute /></div>
          </div>
        </div>

        {/* Mobile/tablet: cartões empilhados */}
        <ol className="grid gap-6 md:grid-cols-2 lg:hidden">
          {STEPS.map((s) => (
            <li key={s.title} data-reveal className="space-y-4">
              <div className="flex items-start gap-4">
                <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-2xl border border-brand-300/40 bg-brand-500/15 text-brand-300"><s.icon className="size-5" aria-hidden /></span>
                <div>
                  <p className="text-xs font-semibold tracking-[0.08em] text-subtle">{s.kicker}</p>
                  <h3 className="font-display text-xl font-semibold">{s.title}</h3>
                  <p className="mt-1 text-[15px] text-muted">{s.text}</p>
                </div>
              </div>
              <s.visual />
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

// ------------------------------------------------------------------ smart home

const BINS = [
  { name: 'Plástico', color: '#ef4444', fill: 72, battery: 88, status: 'Normal' },
  { name: 'Papel', color: '#3b82f6', fill: 38, battery: 64, status: 'Normal' },
  { name: 'Orgânico', color: '#a3e635', fill: 91, battery: 52, status: 'Coleta solicitada' },
];

export function SmartHome() {
  const [ref, inView] = useInView<HTMLDivElement>({ threshold: 0.3 });
  return (
    <section id="smart-home" className="contain-section relative py-24 sm:py-32 lg:pt-16">
      <div className="container-app grid items-center gap-14 lg:grid-cols-2">
        <div data-reveal>
          <SectionEyebrow>Smart Home 2050</SectionEyebrow>
          <h2 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">A casa que <span className="text-gradient">cuida do próprio lixo</span>.</h2>
          <p className="mt-5 max-w-lg text-[17px] leading-relaxed text-fg-soft">
            Lixeiras inteligentes medem o nível de cada material e pedem a coleta sozinhas quando chegam ao limite.
            A família soma pontos em conjunto e acompanha o impacto da residência em tempo real.
          </p>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2">
            {[
              { i: Wifi, t: 'Sensores conectados', d: 'Nível e bateria enviados por IoT.' },
              { i: Zap, t: 'Coleta automática', d: 'Pedido gerado ao atingir o limite.' },
              { i: Users, t: 'Família conectada', d: 'Convite por código e ranking da casa.' },
              { i: Leaf, t: 'Impacto da residência', d: 'kg reciclados e CO₂ evitado.' },
            ].map((f) => (
              <li key={f.t} className="flex gap-3">
                <span className="glass inline-flex size-10 shrink-0 items-center justify-center rounded-xl text-brand-300"><f.i className="size-[18px]" aria-hidden /></span>
                <div><p className="font-medium">{f.t}</p><p className="text-sm text-muted">{f.d}</p></div>
              </li>
            ))}
          </ul>
        </div>

        <div ref={ref} data-reveal className="glass-strong ring-gradient relative rounded-[28px] p-5 sm:p-7">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted">Residência</p>
              <p className="font-display text-lg font-semibold">Casa Oliveira · Vila Mariana</p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-2.5 py-1 text-xs text-success">
              <span className="size-1.5 rounded-full bg-success motion-safe:animate-pulse" /> 3 dispositivos online
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3 sm:gap-4">
            {BINS.map((b, i) => (
              <div key={b.name} className="rounded-2xl border border-line bg-bg-deep/60 p-3 sm:p-4">
                <div className="relative mx-auto h-32 w-full max-w-[84px] overflow-hidden rounded-xl border border-line-strong bg-surface sm:h-40">
                  <div className="absolute inset-x-0 bottom-0 origin-bottom transition-transform duration-[1400ms] ease-[var(--ease-out-expo)]"
                    style={{ height: `${b.fill}%`, transform: `scaleY(${inView ? 1 : 0.05})`, transitionDelay: `${i * 150}ms`, background: `linear-gradient(180deg, ${b.color}cc, ${b.color}55)` }}>
                    <div className="absolute inset-x-0 top-0 h-1 bg-white/40" />
                  </div>
                  <span className="absolute inset-x-0 top-2 text-center font-display text-lg font-semibold tabular">{b.fill}%</span>
                </div>
                <p className="mt-3 text-center text-sm font-medium">{b.name}</p>
                <p className={cn('mt-0.5 text-center text-[11px]', b.fill > 85 ? 'text-warning' : 'text-muted')}>{b.status}</p>
                <p className="mt-1 flex items-center justify-center gap-1 text-[11px] text-subtle"><Battery className="size-3" aria-hidden />{b.battery}%</p>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-3 rounded-2xl border border-lime-300/20 bg-lime-300/[0.06] px-4 py-3 text-sm">
            <Truck className="size-4 shrink-0 text-lime-300" aria-hidden />
            <span className="text-fg-soft">Coleta de orgânicos agendada automaticamente para <b className="text-fg">amanhã, 08:30</b>.</span>
          </div>
        </div>
      </div>
    </section>
  );
}

// ------------------------------------------------------------------ impacto (dados reais)

const FALLBACK_STATS: PublicStats = {
  totalKg: 48210, recycledKg: 39870, co2AvoidedKg: 61240, treesEquivalent: 2780,
  users: 1260, households: 412, disposals: 9840, collectionPoints: 38,
};

function Counter({ value, label, icon: Icon, suffix, start, compact }: { value: number; label: string; icon: LucideIcon; suffix?: string; start: boolean; compact?: boolean }) {
  const fmt = (n: number) => (compact && value >= 10000 ? formatCompact(n) : formatNumber(n));
  const numRef = useCountUpText<HTMLSpanElement>(value, fmt, { start, duration: 2000 });
  return (
    <div className="glass group relative overflow-hidden rounded-3xl p-6">
      <div aria-hidden className="pointer-events-none absolute -right-16 -bottom-16 size-52 bg-[radial-gradient(closest-side,rgb(16_185_129/0.14),transparent)]" />
      <Icon className="size-5 text-brand-300" aria-hidden />
      <p className="mt-4 font-display text-4xl font-semibold tracking-tight tabular sm:text-5xl">
        <span ref={numRef} />
        {suffix && <span className="ml-1 text-xl text-muted sm:text-2xl">{suffix}</span>}
      </p>
      <p className="mt-1 text-sm text-muted">{label}</p>
    </div>
  );
}

export function ImpactStats() {
  const { data, isError, isPending } = usePublicStats();
  const [ref, inView] = useInView<HTMLDivElement>({ threshold: 0.25 });
  const stats = data ?? FALLBACK_STATS;
  const demo = !data && (isError || !isPending);
  return (
    <section id="impacto" className="contain-section relative py-24 sm:py-32">
      <div className="container-app">
        <div className="mb-12 flex flex-col justify-between gap-6 md:flex-row md:items-end" data-reveal>
          <div className="max-w-2xl">
            <SectionEyebrow>Impacto mensurável</SectionEyebrow>
            <h2 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">Resultados calculados a partir de cada descarte.</h2>
          </div>
          <p className="max-w-sm text-sm text-muted">
            {demo
              ? 'Valores ilustrativos — o servidor está offline no momento. Com a API ativa, estes números são atualizados em tempo real.'
              : 'Indicadores ao vivo da comunidade Lixo Zero 2050, calculados a partir dos descartes aprovados.'}
          </p>
        </div>
        <div ref={ref} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Counter start={inView} value={stats.recycledKg} label="kg encaminhados para reciclagem" icon={Recycle} suffix="kg" compact />
          <Counter start={inView} value={stats.co2AvoidedKg} label="kg de CO₂ evitados" icon={Leaf} suffix="kg" compact />
          <Counter start={inView} value={stats.treesEquivalent} label="árvores equivalentes" icon={Trees} />
          <Counter start={inView} value={stats.disposals} label="descartes registrados" icon={BarChart3} />
        </div>
        <div className="mt-4 grid grid-cols-3 gap-4">
          {[
            { v: stats.users, l: 'pessoas', i: Users },
            { v: stats.households, l: 'residências conectadas', i: Home },
            { v: stats.collectionPoints, l: 'ecopontos no mapa', i: MapPinned },
          ].map((s) => (
            <div key={s.l} className="flex flex-col items-start gap-1 rounded-2xl border border-line bg-bg-deep/40 p-4 sm:flex-row sm:items-center sm:gap-3 sm:p-5">
              <s.i className="size-5 shrink-0 text-lime-300" aria-hidden />
              <p className="font-display text-xl font-semibold tabular sm:text-2xl">{formatNumber(s.v)}</p>
              <p className="text-xs text-muted sm:text-sm">{s.l}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ------------------------------------------------------------------ recursos (bento)

function MiniBars() {
  const bars = [18, 26, 31, 40, 52, 61, 70, 82, 90];
  return (
    <div className="flex h-20 items-end gap-1.5" aria-hidden>
      {bars.map((b, i) => (
        <div key={i} className="flex-1 rounded-t-md bg-gradient-to-t from-brand-600/60 to-lime-300/80" style={{ height: `${b}%`, opacity: 0.4 + i * 0.07 }} />
      ))}
    </div>
  );
}

export function Features() {
  const cards: { icon: LucideIcon; title: string; text: string; className?: string; extra?: ReactNode }[] = [
    {
      icon: BrainCircuit, title: 'Identificação por foto com IA', className: 'md:col-span-2',
      text: 'Modelo de visão no servidor e fallback no próprio navegador (TensorFlow.js). Sugere a categoria com nível de confiança — e você pode corrigir.',
      extra: (
        <div className="mt-6 flex flex-wrap gap-2" aria-hidden>
          {[['Plástico', '#ef4444', 96], ['Papel', '#3b82f6', 3], ['Vidro', '#22c55e', 1]].map(([n, c, p]) => (
            <span key={n as string} className="inline-flex items-center gap-2 rounded-full border border-line bg-bg-deep/50 px-3 py-1.5 text-xs">
              <span className="size-2 rounded-full" style={{ background: c as string }} />{n}<b className="text-fg tabular">{p}%</b>
            </span>
          ))}
        </div>
      ),
    },
    {
      icon: Fingerprint, title: 'Antifraude',
      text: 'Hash perceptual detecta fotos repetidas, limites por categoria, chave de idempotência e pontuação única por descarte.',
    },
    {
      icon: Route, title: 'Rotas otimizadas',
      text: 'Vizinho mais próximo + 2-opt com capacidade do veículo. Mostramos a economia de quilômetros em cada rota.',
    },
    {
      icon: Crown, title: 'Ranking por bairro, turma e empresa',
      text: 'Competição saudável entre pessoas, residências, bairros e organizações — por semana, mês ou ano.',
    },
    { icon: Gift, title: 'Recompensas e desafios', text: 'Níveis, medalhas, desafios com bônus e vouchers de parceiros locais.' },
    { icon: Building2, title: 'Painel administrativo', text: 'Moderação, ecopontos no mapa, catálogo, lixeiras, auditoria e relatórios CSV.' },
    {
      icon: BarChart3, title: 'Simulador 2050', className: 'md:col-span-2',
      text: 'Projete população, geração per capita e metas de reciclagem: veja aterro evitado, CO₂, caminhões e empregos verdes até 2050.',
      extra: <div className="mt-6"><MiniBars /></div>,
    },
  ];
  return (
    <section id="recursos" className="contain-section relative py-24 sm:py-32">
      <div className="container-app">
        <div className="mb-12 max-w-2xl" data-reveal>
          <SectionEyebrow>Recursos</SectionEyebrow>
          <h2 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">Tecnologia de verdade, do celular ao caminhão.</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {cards.map((c) => (
            <article key={c.title} data-reveal className={cn('glass group relative overflow-hidden rounded-3xl p-6 transition-[border-color,transform] duration-500 hover:-translate-y-1 hover:border-line-strong sm:p-7', c.className)}>
              <div aria-hidden className="pointer-events-none absolute -top-28 -right-28 size-72 bg-[radial-gradient(closest-side,rgb(16_185_129/0.2),transparent)] opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
              <span className="inline-flex size-11 items-center justify-center rounded-2xl border border-brand-300/30 bg-gradient-to-br from-brand-500/25 to-lime-300/5 text-brand-300">
                <c.icon className="size-5" aria-hidden />
              </span>
              <h3 className="mt-5 font-display text-xl font-semibold">{c.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-muted">{c.text}</p>
              {c.extra}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

// ------------------------------------------------------------------ linha do tempo

const TIMELINE = [
  { year: '2026', title: 'Lançamento', text: 'Piloto na ExpoTech · UniFECAF com moradores, turmas e coletores.' },
  { year: '2030', title: '40% reciclado', text: 'Bairros participantes desviam 40% dos resíduos do aterro.' },
  { year: '2035', title: 'Casas conectadas', text: 'Uma em cada três casas com lixeiras inteligentes.' },
  { year: '2040', title: 'Frota inteligente', text: 'Rotas 100% otimizadas e coleta com veículos elétricos.' },
  { year: '2050', title: 'Lixo Zero', text: '90% de desvio do aterro: o resíduo volta como matéria-prima.' },
];

export function Timeline() {
  return (
    <section id="2050" data-timeline className="contain-section relative py-24 sm:py-32">
      <div className="container-app">
        <div className="mb-14 max-w-2xl" data-reveal>
          <SectionEyebrow>Rumo a 2050</SectionEyebrow>
          <h2 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">Uma meta ousada, com um plano claro.</h2>
        </div>
        <ol className="relative grid gap-8 lg:grid-cols-5 lg:gap-6">
          <span aria-hidden className="absolute top-0 bottom-0 left-[11px] w-px bg-line-strong lg:top-[11px] lg:right-0 lg:bottom-auto lg:left-0 lg:h-px lg:w-full" />
          <span aria-hidden data-timeline-line className="absolute top-0 bottom-0 left-[11px] w-px origin-top bg-gradient-to-b from-brand-400 to-lime-300 shadow-[0_0_12px_#34d399] lg:top-[11px] lg:right-0 lg:bottom-auto lg:left-0 lg:h-px lg:w-full lg:origin-left lg:bg-gradient-to-r" />
          {TIMELINE.map((t, i) => (
            <li key={t.year} data-reveal className="relative pl-10 lg:pt-10 lg:pl-0">
              <span aria-hidden className={cn('absolute top-0 left-0 inline-flex size-6 items-center justify-center rounded-full border-2 bg-bg',
                i === TIMELINE.length - 1 ? 'border-lime-300 shadow-[0_0_18px_#bef264]' : 'border-brand-400')}>
                <span className={cn('size-2 rounded-full', i === TIMELINE.length - 1 ? 'bg-lime-300' : 'bg-brand-400')} />
              </span>
              <p className={cn('font-display text-4xl font-bold tracking-tight tabular', i === TIMELINE.length - 1 ? 'text-gradient' : 'text-fg')}>{t.year}</p>
              <p className="mt-2 font-medium">{t.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted">{t.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

// ------------------------------------------------------------------ CTA + rodapé

export function FinalCta() {
  return (
    <section className="relative py-24 sm:py-32">
      <div className="container-app">
        <div data-reveal className="glass-strong ring-gradient relative overflow-hidden rounded-[32px] px-6 py-16 text-center sm:px-12 sm:py-20">
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_80%_at_50%_0%,rgb(34_197_94/0.25),transparent_70%)]" />
          <div aria-hidden className="pointer-events-none absolute inset-0 grid-bg opacity-60" />
          <div className="relative">
            <h2 className="mx-auto max-w-3xl font-display text-4xl font-semibold tracking-tight sm:text-6xl">
              Faça parte da geração <span className="text-gradient">Lixo Zero</span>.
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-[17px] text-fg-soft">
              Crie sua conta, registre seu primeiro descarte hoje e veja o seu impacto crescer junto com o do seu bairro.
            </p>
            <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
              <ButtonLink to="/cadastro" size="xl" rightIcon={ArrowRight}>Criar conta grátis</ButtonLink>
              <ButtonLink to="/entrar" size="xl" variant="secondary">Já tenho conta</ButtonLink>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="cv-auto relative border-t border-line bg-bg py-12">
      <div className="container-app grid gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Logo variant="full" size={40} />
          <p className="mt-5 max-w-sm text-sm text-muted">
            Lixo Zero 2050 é uma plataforma inteligente de gestão de resíduos criada pela equipe EcoTech Zero para a ExpoTech 2026 — tema Smart Home 2050.
          </p>
        </div>
        <div>
          <p className="mb-3 text-sm font-semibold">Plataforma</p>
          <ul className="space-y-2 text-sm text-muted">
            <li><a href="#como-funciona" className="hover:text-fg">Como funciona</a></li>
            <li><a href="#smart-home" className="hover:text-fg">Smart Home</a></li>
            <li><a href="#recursos" className="hover:text-fg">Recursos</a></li>
            <li><a href="#2050" className="hover:text-fg">Rumo a 2050</a></li>
          </ul>
        </div>
        <div>
          <p className="mb-3 text-sm font-semibold">Acesso</p>
          <ul className="space-y-2 text-sm text-muted">
            <li><Link to="/entrar" className="hover:text-fg">Entrar</Link></li>
            <li><Link to="/cadastro" className="hover:text-fg">Criar conta</Link></li>
          </ul>
        </div>
      </div>
      <div className="container-app mt-10">
        <div className="flex flex-col justify-between gap-3 border-t border-line pt-6 text-xs text-subtle sm:flex-row">
          <p>© 2026 EcoTech Zero · Tecnologia para um mundo sem desperdício.</p>
          <p>ExpoTech 2026 · UniFECAF</p>
        </div>
      </div>
    </footer>
  );
}
