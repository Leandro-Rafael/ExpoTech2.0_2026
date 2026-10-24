/**
 * Navegação + hero da landing: carregados de imediato (primeira pintura instantânea).
 * Sem GSAP aqui — a entrada usa a animação CSS `animate-hero` (mesma curva e ritmo do resto).
 */
import { useEffect, useState, type MouseEvent } from 'react';
import { Link } from 'react-router';
import { ArrowRight, BatteryMedium, Menu, Recycle, Sparkles, X, type LucideIcon } from 'lucide-react';
import { useAuth } from '@/auth/AuthProvider';
import { ButtonLink, buttonClasses } from '@/components/ui';
import { Logo } from '@/components/layout/Logo';
import { prefersReducedMotion } from '@/hooks/useReducedMotion';
import { cn } from '@/lib/cn';

type ScrollTo = (target: string) => void;

// ------------------------------------------------------------------ navegação

export const LINKS = [
  { href: '#como-funciona', label: 'Como funciona' },
  { href: '#casa', label: 'Casa conectada' },
  { href: '#impacto', label: 'Impacto' },
  { href: '#recursos', label: 'Recursos' },
  { href: '#2050', label: '2050' },
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
    <header className={cn(
      'fixed inset-x-0 top-0 z-50 border-b transition-[background-color,border-color] duration-300 [will-change:transform]',
      scrolled || open ? 'border-line bg-bg' : 'border-transparent bg-transparent',
    )}>
      <div className="container-app flex h-16 items-center justify-between gap-6">
        <a href="#topo" onClick={go('#topo')} aria-label="EcoTech Zero — voltar ao topo"><Logo size={30} /></a>
        <nav aria-label="Seções" className="hidden items-center gap-7 lg:flex">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} onClick={go(l.href)} className="text-[14px] text-muted transition-colors hover:text-fg">{l.label}</a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          {status === 'authenticated' ? (
            <ButtonLink to="/app" size="sm" rightIcon={ArrowRight}>Abrir painel</ButtonLink>
          ) : (
            <>
              <Link to="/entrar" className={buttonClasses({ variant: 'ghost', size: 'sm', className: 'max-sm:hidden' })}>Entrar</Link>
              <ButtonLink to="/cadastro" size="sm">Criar conta</ButtonLink>
            </>
          )}
          <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="menu-mobile" aria-label={open ? 'Fechar menu' : 'Abrir menu'}
            className="inline-flex size-9 items-center justify-center rounded-lg text-fg-soft hover:bg-white/5 lg:hidden">
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>
      {open && (
        <nav id="menu-mobile" aria-label="Seções" className="container-app border-t border-line pt-2 pb-4 lg:hidden">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} onClick={go(l.href)} className="block border-b border-line py-3.5 text-[15px] text-fg-soft last:border-0">{l.label}</a>
          ))}
          {status !== 'authenticated' && <Link to="/entrar" className="block py-3.5 text-[15px] text-fg">Entrar</Link>}
        </nav>
      )}
    </header>
  );
}

// ------------------------------------------------------------------ hero

const TICKER: { icon: LucideIcon; label: string; value: string }[] = [
  { icon: Recycle, label: 'IA identificou plástico PET', value: '96%' },
  { icon: Sparkles, label: 'Descarte aprovado em Vila Mariana', value: '+48 pts' },
  { icon: BatteryMedium, label: 'Lixeira orgânica pediu coleta', value: '91%' },
];

/** Único elemento flutuante do hero: um letreiro "ao vivo" discreto. */
function LiveTicker() {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (prefersReducedMotion()) return;
    const t = window.setInterval(() => setI((n) => (n + 1) % TICKER.length), 3200);
    return () => clearInterval(t);
  }, []);
  const item = TICKER[i];
  return (
    <div data-hero="ticker" style={{ animationDelay: '900ms' }} className="animate-hero surface-raised w-[300px] rounded-xl px-4 py-3.5" aria-live="off">
      <p className="label-mono mb-2.5 flex items-center gap-2 text-[11px]">
        <span className="relative flex size-1.5"><span className="absolute inline-flex size-full animate-ping rounded-full bg-brand-300 opacity-60" /><span className="relative size-1.5 rounded-full bg-brand-300" /></span>
        Agora na plataforma
      </p>
      <div key={i} className="flex animate-fade-up items-center gap-3">
        <item.icon className="size-4 shrink-0 text-fg-soft" aria-hidden />
        <span className="flex-1 text-[13.5px] text-fg-soft">{item.label}</span>
        <span className="font-mono text-[13px] text-fg tabular">{item.value}</span>
      </div>
    </div>
  );
}

export function Hero({ scrollTo }: { scrollTo: ScrollTo }) {
  return (
    <section id="topo" className="relative flex min-h-[100svh] items-end pt-28 pb-16 sm:items-center sm:pb-24">
      <div className="container-app relative w-full">
        <div className="grid lg:grid-cols-12">
          <div className="pt-[30vh] sm:pt-0 lg:col-span-7">
            <p data-hero="label" className="label-mono mb-8 animate-hero" style={{ animationDelay: '80ms' }}>Lixo Zero 2050 <span className="mx-2 text-line-strong">/</span> ExpoTech 2026</p>
            <h1 className="text-display text-fg">
              {['Lixo', 'zero', 'até', '2050'].map((w, i) => (
                <span key={w} data-hero="word" className="inline-block animate-hero" style={{ animationDelay: `${180 + i * 50}ms` }}>{w}&nbsp;</span>
              ))}
              <span data-hero="word" className="inline-block animate-hero" style={{ animationDelay: '380ms' }}>começa&nbsp;</span>
              <span data-hero="word" className="inline-block animate-hero italic text-accent" style={{ fontVariationSettings: '"opsz" 144', animationDelay: '430ms' }}>em&nbsp;casa.</span>
            </h1>
            <p data-hero="sub" style={{ animationDelay: '560ms' }} className="animate-hero mt-8 max-w-[46ch] text-[17px] leading-[1.6] text-muted sm:text-lg">
              Fotografe o resíduo e a IA identifica o material. Cada descarte aprovado vira pontos, e a coleta do bairro
              passa a seguir rotas otimizadas.
            </p>
            <div data-hero="cta" style={{ animationDelay: '680ms' }} className="animate-hero mt-10 flex flex-col gap-3 sm:flex-row">
              <ButtonLink to="/cadastro" size="lg" rightIcon={ArrowRight}>Criar conta grátis</ButtonLink>
              <a href="#como-funciona" onClick={(e) => { e.preventDefault(); scrollTo('#como-funciona'); }} className={buttonClasses({ variant: 'secondary', size: 'lg' })}>
                Ver como funciona
              </a>
            </div>
          </div>
        </div>
        <div className="pointer-events-none absolute right-8 bottom-0 hidden xl:block">
          <LiveTicker />
        </div>
      </div>
    </section>
  );
}

