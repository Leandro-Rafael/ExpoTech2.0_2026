/**
 * Seções da landing. Sistema editorial:
 *  - rótulo mono "01 / Seção" + hairline (sem pílulas)
 *  - h1/h2 em Fraunces; textos em Geist; números em Geist Mono
 *  - acento lima só no CTA primário e na única ênfase do hero
 *  - divisórias em vez de caixas; um visual por seção
 */
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { ArrowRight, ArrowUpRight, BatteryMedium } from 'lucide-react';
import type { PublicStats } from '@/api/types';
import { useEstatisticasPublicas } from '@/api/queries';
import { LinkBotao } from '@/components/ui';
import { Logo } from '@/components/layout/Logo';
import { useContagemTexto } from '@/hooks/useCountUp';
import { useNaTela } from '@/hooks/useInView';
import { prefereMenosMovimento } from '@/hooks/useReducedMotion';
import { formatarCompacto, formatarNumero } from '@/lib/format';
import { cn } from '@/lib/cn';
import { CartaoHistoria } from './StepVisuals';
import { gsap, ScrollTrigger } from './gsap';
import { obterLenis, rolarAteY } from './useSmoothScroll';
import { LINKS } from './hero';

// ------------------------------------------------------------------ primitivas

/** "01 / Como funciona" + hairline. */
function RotuloSecao({ indice, children }: { indice: string; children: ReactNode }) {
  return (
    <div className="mb-10 flex items-center gap-4 lg:mb-14" data-reveal>
      <p className="label-mono shrink-0"><span className="text-fg-soft">{indice}</span> / {children}</p>
      <span aria-hidden className="h-px flex-1 bg-line" />
    </div>
  );
}

function Secao({ id, className, children, ...rest }: { id?: string; className?: string; children: ReactNode } & Record<`data-${string}`, string | boolean>) {
  return (
    <section id={id} className={cn('relative py-20 lg:py-24', className)} {...rest}>
      <div className="container-app">{children}</div>
    </section>
  );
}

const H2 = ({ children, className }: { children: ReactNode; className?: string }) => (
  <h2 data-reveal className={cn('text-headline max-w-[20ch] text-fg', className)}>{children}</h2>
);
const Subtitulo = ({ children, className }: { children: ReactNode; className?: string }) => (
  <p data-reveal className={cn('mt-6 max-w-[54ch] text-[17px] leading-[1.6] text-muted', className)}>{children}</p>
);

// ------------------------------------------------------------------ 01 como funciona

export const PASSOS: { title: string; text: string }[] = [
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
const PESO_PASSO5 = 1.6;
const UNIDADES_PIN = 4 + PESO_PASSO5;
const unidadesParaP = (u: number) => (u < 4 ? u : 4 + (u - 4) / PESO_PASSO5);
const pParaUnidades = (p: number) => (p < 4 ? p : 4 + (p - 4) * PESO_PASSO5);
/** Onde cada passo fica "inteiro" ao navegar pelo clique (05 = início da sequência do caminhão). */
const P_ALVO_PASSO = [0.55, 1.6, 2.92, 3.6, 4.22];

export function ComoFunciona() {
  // Passo ativo (lista à esquerda) muda 5 vezes; o cartão recebe o progresso contínuo
  // direto no DOM via `progress.current(p)` — sem re-render por quadro.
  const [ativo, setAtivo] = useState(0);
  const [fixado] = useState(() => !prefereMenosMovimento());
  const progresso = useRef<((p: number) => void) | null>(null);
  const gatilho = useRef<ScrollTrigger | null>(null);

  useLayoutEffect(() => {
    if (!fixado) return;
    const mm = gsap.matchMedia();
    mm.add('(min-width: 1024px)', () => {
      let ultimo = -1;
      gatilho.current = ScrollTrigger.create({
        trigger: '[data-pin="how"]',
        start: 'top top',
        end: () => `+=${window.innerHeight * (UNIDADES_PIN - 0.4)}`,
        pin: true,
        anticipatePin: 1,
        // Bordas garantidas: com rolagem muito rápida (ou CPU lenta) o último onUpdate pode pular.
        onLeaveBack: () => { progresso.current?.(0); if (ultimo !== 0) { ultimo = 0; setAtivo(0); } },
        onLeave: () => { progresso.current?.(PASSOS.length - 0.001); if (ultimo !== PASSOS.length - 1) { ultimo = PASSOS.length - 1; setAtivo(PASSOS.length - 1); } },
        onUpdate: (self) => {
          const p = unidadesParaP(self.progress * UNIDADES_PIN);
          progresso.current?.(p);
          const idx = Math.min(PASSOS.length - 1, Math.floor(p));
          if (idx !== ultimo) { ultimo = idx; setAtivo(idx); }
        },
      });
      return () => { gatilho.current = null; };
    });
    return () => mm.revert();
  }, [fixado]);

  /** Posição de scroll em que o cartão está no progresso p (0..5) do pin. */
  const yEm = (st: ScrollTrigger, p: number) => Math.round(st.start + ((st.end - st.start) * pParaUnidades(p)) / UNIDADES_PIN);

  /**
   * Enquanto a sequência do caminhão toca (por tempo), a página NÃO avança: senão parece que
   * o scroll é que faz a animação andar e, ao fim, a página "pula" para a frente. Voltar
   * continua livre (cancela a sequência). Só trava se ainda estiver dentro do pin.
   */
  const liberarTrava = useRef<(() => void) | null>(null);
  const onIntro = (tocando: boolean) => {
    liberarTrava.current?.();
    liberarTrava.current = null;
    const st = gatilho.current;
    if (!tocando || !st?.isActive) return;
    const lenis = obterLenis();
    const agora = lenis ? lenis.animatedScroll : window.scrollY;
    // encaixa no início do passo 05 (cabeçalho já inteiro); se já passou dele, para onde está
    const yTravado = Math.max(Math.round(agora), yEm(st, P_ALVO_PASSO[4]));
    if (lenis) lenis.scrollTo(yTravado, yTravado > agora + 1 ? { duration: 0.6, easing: (t) => 1 - Math.pow(1 - t, 3) } : { immediate: true });
    else window.scrollTo({ top: yTravado, behavior: 'smooth' });

    const aoGirarRoda = (e: WheelEvent) => {
      if (e.deltaY <= 0) return;
      e.preventDefault();
      e.stopImmediatePropagation(); // antes do Lenis (que escuta na fase de bolha)
    };
    const aoTeclar = (e: KeyboardEvent) => {
      if (!['ArrowDown', 'PageDown', 'End', ' '].includes(e.key)) return;
      if ((e.target as HTMLElement | null)?.closest?.('input, textarea, select, button, a, [contenteditable]')) return;
      e.preventDefault();
    };
    // reforço (barra de rolagem, gestos): se passar do ponto travado, volta
    const limitarY = () => {
      const y = lenis ? lenis.scroll : window.scrollY;
      if (y <= yTravado + 2) return;
      // rolagem suave para baixo com a roda bloqueada = clique num link do menu: deixa ir
      if (lenis?.isScrolling === 'smooth' && lenis.targetScroll > yTravado + 2) { liberarTrava.current?.(); liberarTrava.current = null; return; }
      if (lenis) lenis.scrollTo(yTravado, { immediate: true });
      else window.scrollTo({ top: yTravado });
    };
    window.addEventListener('wheel', aoGirarRoda, { capture: true, passive: false });
    window.addEventListener('keydown', aoTeclar, { capture: true });
    const pararDeOuvirRolagem = lenis ? lenis.on('scroll', limitarY) : (window.addEventListener('scroll', limitarY, { passive: true }), () => window.removeEventListener('scroll', limitarY));
    liberarTrava.current = () => {
      window.removeEventListener('wheel', aoGirarRoda, { capture: true });
      window.removeEventListener('keydown', aoTeclar, { capture: true });
      pararDeOuvirRolagem();
    };
  };
  useEffect(() => () => liberarTrava.current?.(), []);

  /** Clique num passo: rola até o ponto do pin em que o cartão daquele passo está completo. */
  const irParaPasso = (i: number) => {
    const st = gatilho.current;
    if (st) {
      rolarAteY(yEm(st, P_ALVO_PASSO[i]));
      return;
    }
    const el = document.getElementById(`how-step-${i}`);
    if (el) rolarAteY(Math.max(0, el.getBoundingClientRect().top + window.scrollY - 88));
  };

  const botaoPasso = (s: (typeof PASSOS)[number], i: number, compacto = false) => {
    // Só a lista do pin acompanha o scroll; o índice compacto (celular) é navegação simples.
    const destacado = !compacto && fixado && i === ativo;
    return (
    <button
      type="button"
      onClick={() => irParaPasso(i)}
      aria-current={destacado ? 'step' : undefined}
      aria-controls={fixado ? 'how-card' : `how-step-${i}`}
      className={cn(
        'group/step relative grid w-full cursor-pointer text-left outline-offset-4',
        compacto ? 'grid-cols-[2rem_1fr] items-baseline py-3' : 'grid-cols-[3rem_1fr] py-3.5',
      )}
    >
      {/* indicador fino à esquerda: cresce no hover/foco (só transform) */}
      <span aria-hidden className="absolute top-3 bottom-3 -left-4 w-px origin-center scale-y-0 bg-fg-soft transition-transform duration-200 ease-[var(--ease-out-expo)] group-hover/step:scale-y-100 group-focus-visible/step:scale-y-100" />
      <span className={cn('font-mono text-[13px] tabular transition-colors duration-200', destacado ? 'text-accent' : 'text-subtle group-hover/step:text-fg-soft')}>{String(i + 1).padStart(2, '0')}</span>
      <span className="block">
        <span className={cn('block font-medium transition-colors duration-200', compacto ? 'text-[15px]' : 'text-[17px]', destacado ? 'text-fg' : 'text-muted group-hover/step:text-fg')}>{s.title}</span>
        {!compacto && <span className={cn('mt-0.5 block text-[14px] leading-relaxed transition-colors duration-200', destacado ? 'text-fg-soft' : 'text-subtle group-hover/step:text-muted')}>{s.text}</span>}
      </span>
    </button>
    );
  };

  return (
    <section id="como-funciona" data-pin="how" className={cn('relative py-24', fixado && 'lg:flex lg:min-h-[100svh] lg:items-center lg:py-0')}>
      <div className={cn('container-app w-full', fixado && 'lg:pt-16')}>
        <RotuloSecao indice="01">Como funciona</RotuloSecao>
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-8">
          <div className={cn(fixado ? 'lg:col-span-5' : 'lg:col-span-12')}>
            <h2 className="text-headline text-fg" data-reveal>Do descarte aos pontos, em cinco passos.</h2>
            {fixado && (
              /* Desktop: lista navegável; o passo ativo segue o scroll */
              <nav aria-label="Passos" className="mt-10 hidden lg:block">
                <ol className="border-t border-line">
                  {PASSOS.map((s, i) => <li key={s.title} className="border-b border-line">{botaoPasso(s, i)}</li>)}
                </ol>
              </nav>
            )}
            {/* Celular/tablet (e movimento reduzido): índice compacto que leva ao cartão empilhado */}
            <nav aria-label="Passos" className={cn('mt-8', fixado && 'lg:hidden')} data-reveal>
              <ol className="grid grid-cols-1 border-t border-line sm:grid-cols-2 sm:gap-x-8">
                {PASSOS.map((s, i) => <li key={s.title} className="border-b border-line pl-4">{botaoPasso(s, i, true)}</li>)}
              </ol>
            </nav>
          </div>
          {fixado && (
            <div id="how-card" className="hidden items-center lg:col-span-6 lg:col-start-7 lg:flex">
              {/* um só cartão contínuo: a mesma garrafa atravessa os 5 passos */}
              <CartaoHistoria modo="scroll" refProgresso={progresso} onIntro={onIntro} />
            </div>
          )}

          {/* Celular/tablet e movimento reduzido: passos empilhados, cada um no estado final */}
          <ol className={cn('grid gap-14 md:grid-cols-2 lg:col-span-12', fixado && 'lg:hidden')}>
            {PASSOS.map((s, i) => (
              <li key={s.title} id={`how-step-${i}`} data-reveal className="scroll-mt-24">
                <p className="font-mono text-[13px] text-subtle">{String(i + 1).padStart(2, '0')}</p>
                <h3 className="mt-2 text-[19px] font-medium text-fg">{s.title}</h3>
                <p className="mt-1 mb-6 text-[15px] leading-relaxed text-muted">{s.text}</p>
                <CartaoHistoria modo="static" passo={i} />
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

// ------------------------------------------------------------------ 02 casa conectada

const LIMITE = 85; // limite de coleta automática configurado pela família
// Cores das categorias dessaturadas (~60–70%) para conviver com a base neutra.
const LIXEIRAS = [
  { name: 'Plástico', color: '#c06a62', fill: 72, battery: 88 },
  { name: 'Papel', color: '#6587bd', fill: 38, battery: 64 },
  { name: 'Orgânico', color: '#8c9b58', fill: 91, battery: 52 },
];

export function CasaConectada() {
  const [ref, visivel] = useNaTela<HTMLDivElement>({ threshold: 0.3 });
  return (
    <Secao id="casa" className="contain-section">
      <RotuloSecao indice="02">Casa conectada</RotuloSecao>
      <div className="grid items-start gap-16 lg:grid-cols-12 lg:gap-8">
        <div className="lg:sticky lg:top-28 lg:col-span-5">
          <H2>Sua casa avisa quando a lixeira enche.</H2>
          <Subtitulo>Sensores medem o nível de cada lixeira. Quando chega ao limite que você definiu, o pedido de coleta é criado sozinho.</Subtitulo>
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
          <p className="label-mono border-b border-line px-5 py-2.5 text-[10.5px] sm:px-6">Limite de coleta automática · {LIMITE}%</p>
          <div className="grid grid-cols-3 divide-x divide-line">
            {LIXEIRAS.map((b, i) => (
              <div key={b.name} className="px-4 py-6 sm:px-6">
                <div className="flex justify-center">
                  {/* medidor: trilho escuro; preenchimento dessaturado, mais escuro na base; realce no topo; marca do limite */}
                  <div className="relative">
                    <div className="relative h-32 w-7 overflow-hidden rounded-[5px] bg-[#0c110e] shadow-[inset_0_0_0_1px_rgb(236_239_234/0.08)] sm:h-44 sm:w-11">
                      <div className="absolute inset-x-0 bottom-0 origin-bottom transition-transform duration-[1200ms] ease-[var(--ease-out-expo)]"
                        style={{ height: `${b.fill}%`, transform: `scaleY(${visivel ? 1 : 0.04})`, transitionDelay: `${i * 120}ms`, background: `linear-gradient(180deg, ${b.color}e6 0%, ${b.color}a6 55%, ${b.color}59 100%)` }}>
                        <div className="absolute inset-x-0 top-0 h-px bg-white/40" />
                      </div>
                    </div>
                    {/* marca do limite: atravessa o medidor e sai 4px para cada lado */}
                    <div aria-hidden className="absolute -inset-x-1 h-[1.5px] rounded-full bg-fg/85" style={{ bottom: `${LIMITE}%` }} />
                  </div>
                </div>
                <p className="mt-4 text-center text-[14px] text-fg">{b.name}</p>
                <p className={cn('text-center font-mono text-[15px] tabular', b.fill >= LIMITE ? 'text-warning' : 'text-fg')}>{b.fill}%</p>
                <p className="mt-0.5 inline-flex w-full items-center justify-center gap-1 font-mono text-[11px] text-subtle"><BatteryMedium className="size-3" aria-hidden />{b.battery}%</p>
              </div>
            ))}
          </div>
          <p className="border-t border-line px-5 py-4 text-[14px] text-muted sm:px-6">
            Coleta de orgânicos agendada para <span className="text-fg">amanhã, 08:30</span>.
          </p>
        </div>
      </div>
    </Secao>
  );
}

// ------------------------------------------------------------------ 03 impacto (dados reais)

const ESTATISTICAS_RESERVA: PublicStats = {
  totalKg: 48210, recycledKg: 39870, co2AvoidedKg: 61240, treesEquivalent: 2780,
  users: 1260, households: 412, disposals: 9840, collectionPoints: 38,
};

function NumeroGrande({ value, unidade, label, start, compacto }: { value: number; unidade?: string; label: string; start: boolean; compacto?: boolean }) {
  const formatar = (n: number) => (compacto && value >= 10000 ? formatarCompacto(n) : formatarNumero(n));
  const refNumero = useContagemTexto<HTMLSpanElement>(value, formatar, { start, duration: 1800 });
  return (
    <div className="py-8 lg:px-8 lg:py-2 lg:first:pl-0">
      <p className="font-mono text-[40px] leading-none font-medium tracking-[-0.04em] text-fg tabular sm:text-[48px] xl:text-[52px]">
        <span ref={refNumero} />{unidade && <span className="ml-1.5 text-[0.4em] font-normal tracking-normal text-subtle">{unidade}</span>}
      </p>
      <p className="mt-3 max-w-[22ch] text-[14px] text-muted">{label}</p>
    </div>
  );
}

export function EstatisticasImpacto() {
  const { data, isError, isPending } = useEstatisticasPublicas();
  const [ref, visivel] = useNaTela<HTMLDivElement>({ threshold: 0.25 });
  const estatisticas = data ?? ESTATISTICAS_RESERVA;
  const demonstracao = !data && (isError || !isPending);
  return (
    <Secao id="impacto" className="contain-section">
      <RotuloSecao indice="03">Impacto</RotuloSecao>
      <H2>Resultados medidos a cada descarte aprovado.</H2>
      <div ref={ref} data-reveal className="mt-12 grid divide-y divide-line border-y border-line sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x lg:py-10">
        <NumeroGrande start={visivel} value={estatisticas.recycledKg} unidade="kg" label="encaminhados para reciclagem" />
        <NumeroGrande start={visivel} value={estatisticas.co2AvoidedKg} unidade="kg" label="de CO₂ que deixaram de ser emitidos" />
        <NumeroGrande start={visivel} value={estatisticas.treesEquivalent} label="árvores equivalentes" />
        <NumeroGrande start={visivel} value={estatisticas.disposals} label="descartes registrados" />
      </div>
      <div className="mt-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center" data-reveal>
        <p className="text-[14px] text-muted">
          <span className="font-mono text-fg tabular">{formatarNumero(estatisticas.users)}</span> pessoas ·{' '}
          <span className="font-mono text-fg tabular">{formatarNumero(estatisticas.households)}</span> residências ·{' '}
          <span className="font-mono text-fg tabular">{formatarNumero(estatisticas.collectionPoints)}</span> ecopontos
        </p>
        <p className="label-mono text-[11px]">{demonstracao ? 'Valores ilustrativos · servidor offline' : 'Dados ao vivo da comunidade'}</p>
      </div>
    </Secao>
  );
}

// ------------------------------------------------------------------ 04 recursos (linhas editoriais)

const RECURSOS = [
  { title: 'Identificação por foto', text: 'IA no servidor e no próprio navegador sugere a categoria com nível de confiança.', tag: 'IA' },
  { title: 'Antifraude', text: 'Fotos repetidas, limites por categoria e pontuação única por descarte.', tag: 'Segurança' },
  { title: 'Rotas otimizadas', text: 'Vizinho mais próximo com 2-opt, mostrando os quilômetros economizados.', tag: 'Logística' },
  { title: 'Ranking', text: 'Por pessoa, residência, bairro, turma ou empresa, na semana, no mês ou no ano.', tag: 'Comunidade' },
  { title: 'Simulador 2050', text: 'Ajuste metas de reciclagem e veja aterro, CO₂ e empregos verdes até 2050.', tag: 'Impacto' },
  { title: 'Painel administrativo', text: 'Moderação, ecopontos, catálogo, lixeiras, auditoria e relatórios em CSV.', tag: 'Gestão' },
];

export function Recursos() {
  return (
    <Secao id="recursos" className="contain-section">
      <RotuloSecao indice="04">Recursos</RotuloSecao>
      <div className="grid items-start gap-12 lg:grid-cols-12 lg:gap-8">
        <div className="lg:sticky lg:top-28 lg:col-span-4">
          <H2>O que a plataforma faz por você.</H2>
          <p data-reveal className="mt-6 max-w-[34ch] text-[15px] leading-relaxed text-muted">Seis módulos integrados, do celular do morador ao painel da prefeitura.</p>
        </div>
        <ol className="border-t border-line lg:col-span-8">
          {RECURSOS.map((f, i) => (
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
    </Secao>
  );
}

// ------------------------------------------------------------------ 05 rumo a 2050

const LINHA_DO_TEMPO = [
  { year: '2026', title: 'Piloto', text: 'Moradores, turmas e coletores na ExpoTech · UniFECAF.' },
  { year: '2030', title: '40% reciclado', text: 'Bairros participantes desviam 40% dos resíduos do aterro.' },
  { year: '2035', title: 'Casas conectadas', text: 'Uma em cada três casas com lixeira inteligente.' },
  { year: '2040', title: 'Frota inteligente', text: 'Todas as rotas otimizadas, com veículos elétricos.' },
  { year: '2050', title: 'Lixo zero', text: '90% dos resíduos voltam como matéria-prima.' },
];

export function LinhaDoTempo() {
  return (
    <Secao id="2050" className="contain-section" data-timeline>
      <RotuloSecao indice="05">Rumo a 2050</RotuloSecao>
      <H2>Metas claras, ano a ano.</H2>
      <ol className="relative mt-14 grid gap-10 lg:grid-cols-5 lg:gap-8">
        <span aria-hidden className="absolute top-0 bottom-0 left-0 w-px bg-line lg:right-0 lg:bottom-auto lg:h-px lg:w-full" />
        <span aria-hidden data-timeline-line className="absolute top-0 bottom-0 left-0 w-px origin-top bg-brand-300 lg:right-0 lg:bottom-auto lg:h-px lg:w-full lg:origin-left" />
        {LINHA_DO_TEMPO.map((t, i) => (
          <li key={t.year} data-reveal className="relative pl-8 lg:pt-8 lg:pl-0">
            <span aria-hidden className={cn('absolute top-1.5 -left-[4px] size-[9px] rounded-full border-2 border-bg lg:-top-[4px] lg:left-0', i === LINHA_DO_TEMPO.length - 1 ? 'bg-fg' : 'bg-brand-300')} />
            <p className={cn('font-mono text-[28px] tracking-[-0.03em] tabular', i === LINHA_DO_TEMPO.length - 1 ? 'text-fg' : 'text-fg-soft')}>{t.year}</p>
            <p className="mt-3 text-[16px] font-medium text-fg">{t.title}</p>
            <p className="mt-1 text-[14px] leading-relaxed text-muted">{t.text}</p>
          </li>
        ))}
      </ol>
    </Secao>
  );
}

// ------------------------------------------------------------------ CTA + rodapé

export function ChamadaFinal() {
  return (
    <Secao className="pb-28 lg:pb-32">
      <div className="border-t border-line pt-16 lg:pt-20">
        <div className="grid gap-10 lg:grid-cols-12 lg:items-end lg:gap-8">
          <div className="lg:col-span-7">
            <h2 data-reveal className="text-headline max-w-[16ch] text-fg">Comece pelo próximo descarte.</h2>
            <p data-reveal className="mt-6 max-w-[44ch] text-[17px] text-muted">Crie sua conta em menos de um minuto e acompanhe o impacto da sua casa e do seu bairro.</p>
          </div>
          <div data-reveal className="flex flex-col gap-3 sm:flex-row lg:col-span-5 lg:justify-end">
            <LinkBotao to="/cadastro" size="lg" iconeDireita={ArrowRight}>Criar conta grátis</LinkBotao>
            <LinkBotao to="/entrar" size="lg" variant="secondary">Já tenho conta</LinkBotao>
          </div>
        </div>
      </div>
    </Secao>
  );
}

export function Rodape() {
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
