/**
 * "Como funciona": UM cartão contínuo em que a mesma garrafa PET atravessa os 5 passos.
 *
 *   01 Registre        garrafa fotografada sobre a bancada
 *   02 A IA identifica caixa de detecção + varredura + rótulo
 *   03 Validação       garrafa vai para a esquerda; checagens ao lado ganham ✓ uma a uma
 *   04 Pontos          garrafa centralizada; "+3 +5 +8…" sobem e somem
 *   05 Coleta          traseira do caminhão: as duas portas abrem, a garrafa entra, as portas fecham;
 *                      a câmera inclina para a vista de cima, o caminhão encolhe até o depósito e percorre a rota
 *
 * Desempenho: tudo é SVG/HTML inline; o progresso do scroll (0..5) é aplicado direto no DOM
 * (`apply(p)`), sem re-render do React por quadro, mexendo só em transform/opacity
 * (+ stroke-dashoffset de um traço pequeno). `mode="static"` desenha o estado final de um
 * passo (celular, movimento reduzido).
 */
import { useId, useLayoutEffect, useRef, type MutableRefObject, type ReactNode } from 'react';
import { Check, MapPin } from 'lucide-react';
import { prefereMenosMovimento } from '@/hooks/useReducedMotion';
import { cn } from '@/lib/cn';
import { gsap } from './gsap';

// ------------------------------------------------------------------ geometria (palco 520×320)

const W = 520;
const H = 320;
const limitar = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const suavizarSaida = (t: number) => 1 - Math.pow(1 - t, 3);

/** Pose da garrafa: centro x, topo y, escala (desenho local: 52×134, centro x=26). */
interface Pose { cx: number; top: number; s: number }
const P_FOTO: Pose = { cx: 260, top: 46, s: 1.4 };
const P_CHECAGEM: Pose = { cx: 122, top: 58, s: 1.28 };
const P_PONTOS: Pose = { cx: 260, top: 52, s: 1.3 };
/** Garrafa "pairando" antes de ir para o caminhão (centro x, centro y, escala). */
const PAIRANDO = { x: 92, y: 70, s: 0.5 };
const interpolarPose = (a: Pose, b: Pose, t: number): Pose => ({ cx: lerp(a.cx, b.cx, t), top: lerp(a.top, b.top, t), s: lerp(a.s, b.s, t) });

const PARADAS: [number, number][] = [[62, 262], [150, 172], [236, 228], [326, 118], [408, 192], [466, 86]];
const INGENUA = [0, 2, 1, 4, 3, 5];
const DEPOSITO = PARADAS[0];

/**
 * Passo 05 — caminhão. Um só estilo plano (ortográfico) em duas vistas do MESMO desenho:
 *   traseira (close, portas de duas folhas) → câmera "inclina" → vista de cima (ícone na rota).
 * REAR: centro da traseira no palco. Abertura local: x −90..90, y −102..42.
 */
const TRASEIRA = { x: 290, y: 168 };
const ABERTURA = { x0: TRASEIRA.x - 90, x1: TRASEIRA.x + 90, y0: TRASEIRA.y - 102, y1: TRASEIRA.y + 42 };
const TOPO_S = 0.16; // ícone: 300×116 local → ~48×19 px no palco
/** Inclinação: altura da traseira (topo −122 até as rodas 100), proporção de largura
 *  traseira/teto (224/112) e comprimento do teto em unidades da traseira. */
const ALTURA_TRASEIRA = 222;
const TOPO_K = 2;
const TOPO_COMP = 300 * TOPO_K;
/**
 * Perspectiva durante a inclinação: distância da câmera (unidades da traseira). O mais
 * próximo fica mais largo, o mais distante mais estreito (fator F / (F + profundidade)).
 * O SVG não tem perspectiva, então só enquanto a câmera inclina a traseira e o teto viram
 * dois planos CSS 3D emendados a 90° (uma "caixa") que giram juntos — perspectiva real,
 * feita pela GPU, sem custo de pintura por quadro.
 */
const PERSP_F = 1100;
/** Unidade do palco (viewBox) em CSS: o palco é um container, 100cqw = W unidades. */
const u = (v: number) => `calc(${v.toFixed(2)} * 100cqw / ${W})`;
const suavizarEntradaSaida = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const suavizarSeno = (t: number) => 0.5 - 0.5 * Math.cos(Math.PI * t);
const caminhoRota = PARADAS.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' ');
const caminhoIngenuo = INGENUA.map((k, i) => `${i ? 'L' : 'M'}${PARADAS[k][0]} ${PARADAS[k][1]}`).join(' ');
const TRECHOS = PARADAS.slice(1).map(([x, y], i) => Math.hypot(x - PARADAS[i][0], y - PARADAS[i][1]));
const COMP_ROTA = TRECHOS.reduce((a, b) => a + b, 0);
const POSICAO_PARADA = TRECHOS.reduce<number[]>((acc, l) => [...acc, acc[acc.length - 1] + l], [0]);

/** Ponto e ângulo ao longo da rota (polilinha), com curva suave do ângulo nas esquinas. */
function aoLongo(d: number): { x: number; y: number; deg: number } {
  let resto = limitar(d, 0, COMP_ROTA);
  for (let i = 0; i < TRECHOS.length; i++) {
    if (resto <= TRECHOS[i] || i === TRECHOS.length - 1) {
      const [x0, y0] = PARADAS[i];
      const [x1, y1] = PARADAS[i + 1];
      const f = TRECHOS[i] ? resto / TRECHOS[i] : 0;
      let graus = (Math.atan2(y1 - y0, x1 - x0) * 180) / Math.PI;
      const faltando = TRECHOS[i] - resto;
      if (faltando < 14 && i < TRECHOS.length - 1) {
        const [x2, y2] = PARADAS[i + 2];
        let proximo = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
        if (proximo - graus > 180) proximo -= 360;
        if (graus - proximo > 180) proximo += 360;
        graus = lerp(graus, proximo, (1 - faltando / 14) * 0.5);
      }
      return { x: lerp(x0, x1, f), y: lerp(y0, y1, f), deg: graus };
    }
    resto -= TRECHOS[i];
  }
  const [x, y] = PARADAS[PARADAS.length - 1];
  return { x, y, deg: 0 };
}

const META_PASSOS = [
  { title: 'Novo descarte', meta: '23/10 · 14:02' },
  { title: 'Identificação por IA', meta: '0,8 s' },
  { title: 'Validação antifraude', meta: 'risco 0,04' },
  { title: 'Pontos creditados', meta: 'nível Broto' },
  { title: 'Rota otimizada', meta: '−31% km' },
];
const CHECAGENS = ['Foto inédita (hash perceptual)', 'Quantidade dentro do limite', 'Localização consistente', 'Frequência normal de envios'];
/** Versões curtas para o palco estreito do celular. */
const CHECAGENS_CURTAS = ['Foto inédita', 'Quantidade ok', 'Local consistente', 'Frequência normal'];
const PARTICULAS = [
  { t: '+3', x: -78, y: 30, d: 0 }, { t: '+5', x: 70, y: 6, d: 0.35 }, { t: '+8', x: -60, y: -18, d: 0.8 },
  { t: '+12', x: 82, y: 58, d: 1.15 }, { t: '+', x: -92, y: 78, d: 1.5 }, { t: '+6', x: 54, y: -40, d: 1.85 },
  { t: '+', x: 96, y: 18, d: 0.55 }, { t: '+9', x: -44, y: 96, d: 2.1 },
];

// ------------------------------------------------------------------ desenhos

function DesenhoGarrafa() {
  return (
    <>
      <defs>
        <linearGradient id="sc-body" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#9fd6ff" stopOpacity=".16" />
          <stop offset=".35" stopColor="#d8efff" stopOpacity=".38" />
          <stop offset=".6" stopColor="#9fd6ff" stopOpacity=".14" />
          <stop offset="1" stopColor="#7cc4f0" stopOpacity=".26" />
        </linearGradient>
      </defs>
      <rect x="15" y="0" width="22" height="12" rx="3" fill="#2f7fd6" />
      <rect x="15" y="9" width="22" height="3" fill="#1f5fa8" />
      <path d="M17 12h18v10c0 6 15 12 15 26v76c0 6-4 10-10 10H12c-6 0-10-4-10-10V48c0-14 15-20 15-26z" fill="url(#sc-body)" stroke="#d8efff" strokeOpacity=".5" strokeWidth="1.2" />
      <rect x="2.6" y="66" width="46.8" height="30" fill="#e9efe9" opacity=".88" />
      <rect x="9" y="74" width="24" height="3" rx="1.5" fill="#2f7fd6" opacity=".8" />
      <rect x="9" y="81" width="34" height="2" rx="1" fill="#7d8680" opacity=".7" />
      <rect x="9" y="86" width="18" height="2" rx="1" fill="#7d8680" opacity=".7" />
      <path d="M10 104v24M42 104v24" stroke="#d8efff" strokeOpacity=".22" />
      <path d="M8 50c3-8 8-12 10-14" stroke="#fff" strokeOpacity=".55" strokeWidth="2" strokeLinecap="round" fill="none" />
      <path d="M7 104v18" stroke="#fff" strokeOpacity=".35" strokeWidth="2" strokeLinecap="round" />
    </>
  );
}

/**
 * Traseira do caminhão de coleta (plano, mesmo traço da vista de cima): carroceria neutra,
 * uma faixa esmeralda contínua, DUAS portas com dobradiças nas bordas externas que abrem
 * para fora (scaleX a partir da dobradiça = rotação em vista ortográfica) e interior escuro
 * em perspectiva de um ponto.
 */
function TraseiraCaminhao({ r }: { r: (k: string) => (el: SVGElement | null) => void }) {
  const porta = (lado: -1 | 1) => {
    const x = lado < 0 ? -90 : 0;
    return (
      <g ref={r(lado < 0 ? 'doorL' : 'doorR')}>
        <rect x={x} y="-102" width="90" height="144" fill="url(#tr-door)" />
        <rect x={x} y="-102" width="90" height="144" fill="none" stroke="#0a0e0c" strokeOpacity=".22" strokeWidth="1.5" />
        <path d={`M${x + 8} -78h74M${x + 8} 18h74`} stroke="#0a0e0c" strokeOpacity=".1" strokeWidth="2" />
        <rect x={x} y="-34" width="90" height="9" fill="#34d399" />
        <rect x={lado < 0 ? -14 : 10} y="-18" width="4" height="26" rx="2" fill="#7d8680" />
        {/* sombreamento conforme gira */}
        <rect ref={r(lado < 0 ? 'shadeL' : 'shadeR')} x={x} y="-102" width="90" height="144" fill="#000" style={{ opacity: 0 }} />
      </g>
    );
  };
  return (
    <>
      <defs>
        <linearGradient id="tr-body" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#d3d9d4" /><stop offset="1" stopColor="#b9c0bb" /></linearGradient>
        <linearGradient id="tr-door" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#c9d0cb" /><stop offset="1" stopColor="#b2bab4" /></linearGradient>
      </defs>
      <ellipse cx="0" cy="102" rx="132" ry="8" fill="#000" opacity=".4" />
      <rect x="-102" y="62" width="34" height="38" rx="6" fill="#0a0e0c" />
      <rect x="68" y="62" width="34" height="38" rx="6" fill="#0a0e0c" />
      <rect x="-112" y="-122" width="224" height="184" rx="10" fill="url(#tr-body)" />
      <rect x="-104" y="-118" width="208" height="3" rx="1.5" fill="#fff" opacity=".35" />
      <rect x="-112" y="-34" width="22" height="9" fill="#34d399" />
      <rect x="90" y="-34" width="22" height="9" fill="#34d399" />
      {/* interior escuro com profundidade */}
      <rect x="-90" y="-102" width="180" height="144" fill="#070a08" />
      <path d="M-90 42 L90 42 L50 6 L-50 6 Z" fill="#0e1310" />
      <rect x="-50" y="-64" width="100" height="70" fill="#121815" />
      <path d="M-90 -102 L-50 -64 M90 -102 L50 -64 M-90 42 L-50 6 M90 42 L50 6" stroke="#ecefea" strokeOpacity=".07" strokeWidth="1.5" />
      <rect x="-90" y="-102" width="180" height="144" fill="none" stroke="#9aa39d" strokeWidth="4" />
      {[-92, 88].map((hx) => [-88, 22].map((hy) => <rect key={`${hx}${hy}`} x={hx} y={hy} width="4" height="12" rx="1" fill="#7d8680" />))}
      <rect x="-108" y="40" width="12" height="16" rx="2" fill="#f5b544" opacity=".85" />
      <rect x="96" y="40" width="12" height="16" rx="2" fill="#f5b544" opacity=".85" />
      <rect x="-20" y="46" width="40" height="12" rx="2" fill="#ecefea" opacity=".85" />
      <rect x="-118" y="60" width="236" height="12" rx="3" fill="#2b332e" />
      {porta(-1)}
      {porta(1)}
    </>
  );
}

/** O mesmo caminhão visto de cima (frente para +x): baú, faixa, cabine, para-brisa, giroflex. */
function CaminhaoDeCima({ r }: { r: (k: string) => (el: SVGElement | null) => void }) {
  return (
    <>
      <defs>
        <linearGradient id="tt-body" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#d3d9d4" /><stop offset="1" stopColor="#b9c0bb" /></linearGradient>
      </defs>
      {/* sombra projetada no chão: só faz sentido de cima, some durante a inclinação */}
      <rect ref={r('topShadow')} x="-144" y="-50" width="300" height="116" rx="14" fill="#000" opacity=".35" />
      {[-118, 92].map((wx) => [-64, 58].map((wy) => <rect key={`${wx}${wy}`} x={wx} y={wy} width="30" height="6" rx="2" fill="#0a0e0c" />))}
      <rect x="-150" y="-56" width="214" height="112" rx="8" fill="url(#tt-body)" />
      <path d="M-110 -50V50M-70 -50V50M-30 -50V50M10 -50V50M50 -50V50" stroke="#0a0e0c" strokeOpacity=".08" strokeWidth="2" />
      <rect x="-150" y="-6" width="214" height="12" fill="#34d399" />
      <rect x="64" y="-44" width="8" height="88" fill="#2b332e" />
      <rect x="70" y="-50" width="80" height="100" rx="16" fill="#ecefea" />
      <rect x="122" y="-40" width="20" height="80" rx="6" fill="#1c231e" />
      <rect x="86" y="-14" width="10" height="28" rx="3" fill="#f5b544" opacity=".85" />
      <rect x="112" y="-62" width="10" height="6" rx="2" fill="#c8cec9" />
      <rect x="112" y="56" width="10" height="6" rx="2" fill="#c8cec9" />
    </>
  );
}

// ------------------------------------------------------------------ componente

export interface PropsCartaoHistoria {
  /** scroll: controlado por `progressRef.current(p)` (p de 0 a 5). static: estado final de `step`. */
  modo: 'scroll' | 'static';
  passo?: number;
  refProgresso?: MutableRefObject<((p: number) => void) | null>;
  /** Sequência do caminhão (por tempo) começou (true) ou terminou/foi cancelada (false). */
  onIntro?: (tocando: boolean) => void;
  className?: string;
}

export function CartaoHistoria({ modo, passo = 0, refProgresso, onIntro, className }: PropsCartaoHistoria) {
  const els = useRef<Record<string, HTMLElement | SVGElement | null>>({});
  // lido dentro do efeito sem recriá-lo (o efeito monta os tweens uma vez)
  const onIntroRef = useRef(onIntro);
  onIntroRef.current = onIntro;
  const ref = (k: string) => (el: HTMLElement | SVGElement | null) => { els.current[k] = el; };
  const animado = modo === 'scroll' || !prefereMenosMovimento();
  // ids únicos por cartão (a página tem vários): desenhos do caminhão e recortes das faixas
  const uid = `sc${useId().replace(/[^\w-]/g, '')}`;
  const desenhoTraseira = `${uid}-rear`;
  const desenhoTopo = `${uid}-top`;

  useLayoutEffect(() => {
    const e = els.current;
    const op = (k: string, v: number) => { const el = e[k]; if (el) el.style.opacity = String(Math.round(v * 1000) / 1000); };
    /** Como `op`, mas também tira a camada da pintura (visibility) quando some — usado no caminhão. */
    const mostrar = (k: string, v: number) => {
      op(k, v);
      const el = e[k];
      if (el) el.style.visibility = v > 0.001 ? 'visible' : 'hidden';
    };
    const ultimo: Record<string, string> = {};
    const atributo = (k: string, nome: string, v: string) => {
      const chave = k + nome;
      if (ultimo[chave] === v) return;
      ultimo[chave] = v;
      e[k]?.setAttribute(nome, v);
    };
    /** Como `attr`, para propriedades de estilo (camada 3D da inclinação). */
    const css = (k: string, prop: 'transform' | 'perspective' | 'perspectiveOrigin', v: string) => {
      const chave = k + prop;
      if (ultimo[chave] === v) return;
      ultimo[chave] = v;
      const el = e[k];
      if (el) el.style[prop] = v;
    };

    /**
     * Passo 05: a mini-história do caminhão (surge → portas abrem → garrafa entra → portas
     * fecham → câmera inclina) roda por TEMPO (~4,8 s) assim que o passo começa — sempre
     * completa, mesmo com scroll rápido ou quadros perdidos. O scroll só dispara/zera a
     * intro e depois controla o trajeto na rota.
     */
    const FIM_INTRO = 0.79; // fração do passo 05 coberta pela intro (fases já calibradas)
    const SEGUNDOS_INTRO = 7.6;
    /**
     * Relógio da intro (s) → fase t. A garrafa (arco .30–.44 e queda .44–.52), a inclinação
     * da câmera (.65–.73) e o deslocamento até o depósito (.73–.79) ganham mais tempo para
     * ficarem fluidos. As emendas caem onde o movimento já está parado, sem trancos.
     */
    const QUADROS_INTRO: [number, number][] = [[0, 0], [1.2, 0.3], [2.6, 0.44], [3.4, 0.52], [4.4, 0.65], [6.3, 0.73], [SEGUNDOS_INTRO, FIM_INTRO]];
    /** Depois da intro, o caminhão "alcança" a posição do scroll na rota em vez de saltar. */
    const SEGUNDOS_SEGUIR = 1.1;
    const seguir = { v: 0 };
    let tweenSeguir: gsap.core.Tween | null = null;
    const faseIntro = (v: number) => {
      const s = v * SEGUNDOS_INTRO;
      for (let k = 1; k < QUADROS_INTRO.length; k++) {
        const [s1, t1] = QUADROS_INTRO[k];
        if (s <= s1) {
          const [s0, t0] = QUADROS_INTRO[k - 1];
          return lerp(t0, t1, (s - s0) / (s1 - s0));
        }
      }
      return FIM_INTRO;
    };
    const intro = { v: 0 };
    let tweenIntro: gsap.core.Tween | null = null;
    let ultimoP = 0;

    const aplicar = (pBruto: number) => {
      const ehEstatico = modo === 'static';
      const p = ehEstatico ? passo + 0.999 : limitar(pBruto, 0, 4.999);
      if (!ehEstatico) {
        ultimoP = p;
        if (p >= 4 && !tweenIntro && intro.v < 1) {
          onIntroRef.current?.(true);
          tweenIntro = gsap.to(intro, {
            v: 1, duration: SEGUNDOS_INTRO, ease: 'none', overwrite: true,
            onUpdate: () => desenhar(ultimoP),
            onComplete: () => {
              tweenIntro = null;
              onIntroRef.current?.(false);
              tweenSeguir = gsap.to(seguir, {
                v: 1, duration: SEGUNDOS_SEGUIR, ease: 'power2.inOut', overwrite: true,
                onUpdate: () => desenhar(ultimoP),
                onComplete: () => { tweenSeguir = null; },
              });
            },
          });
        } else if (p < 4 && (tweenIntro || intro.v > 0)) {
          if (tweenIntro) onIntroRef.current?.(false);
          tweenIntro?.kill();
          tweenSeguir?.kill();
          tweenIntro = tweenSeguir = null;
          intro.v = seguir.v = 0;
        }
      }
      desenhar(p);
    };

    const desenhar = (p: number) => {
      const ehEstatico = modo === 'static';
      const i = Math.min(4, Math.floor(p));
      const t0 = p - i;
      // No passo 05 as fases da intro usam o relógio da intro (ou o estado final, no modo estático).
      const t = i === 4 && !ehEstatico ? faseIntro(intro.v) : t0;
      const vis = (k: number) => {
        if (ehEstatico) return k === passo ? 1 : 0;
        const lo = k === 0 ? 1 : limitar((p - k) / 0.06);
        const hi = k === 4 ? 1 : limitar((k + 1 - p) / 0.06);
        return lo * hi;
      };

      // garrafa (persistente)
      let pose = P_FOTO;
      let opacidadeGarrafa = 1;
      if (i === 2) pose = interpolarPose(P_FOTO, P_CHECAGEM, suavizarSaida(limitar(t / 0.2)));
      else if (i === 3) pose = interpolarPose(P_CHECAGEM, P_PONTOS, suavizarSaida(limitar(t / 0.2)));
      else if (i === 4) {
        // A (0–.1): vai "pairar" à esquerda · caminhão surge (.1–.2) · portas abrem (.2–.3) ·
        // B (.3–.44): arco até o centro da abertura · C (.44–.52): cai para dentro (clip na abertura)
        const posePairando: Pose = { cx: PAIRANDO.x, top: PAIRANDO.y - 67 * PAIRANDO.s, s: PAIRANDO.s };
        if (t < 0.3) pose = interpolarPose(P_PONTOS, posePairando, suavizarEntradaSaida(limitar(t / 0.1)));
        else if (t < 0.44) {
          const a = suavizarEntradaSaida(limitar((t - 0.3) / 0.14));
          const c = { x: TRASEIRA.x - 110, y: TRASEIRA.y - 150 };
          const e = { x: TRASEIRA.x, y: TRASEIRA.y - 58 };
          const bx = (1 - a) * (1 - a) * PAIRANDO.x + 2 * (1 - a) * a * c.x + a * a * e.x;
          const by = (1 - a) * (1 - a) * PAIRANDO.y + 2 * (1 - a) * a * c.y + a * a * e.y;
          const bs = lerp(PAIRANDO.s, 0.48, a);
          pose = { cx: bx, top: by - 67 * bs, s: bs };
        } else {
          const d = limitar((t - 0.44) / 0.08);
          const bs = lerp(0.48, 0.38, d);
          const by = lerp(TRASEIRA.y - 58, TRASEIRA.y + 92, d * d);
          pose = { cx: TRASEIRA.x, top: by - 67 * bs, s: bs };
        }
        opacidadeGarrafa = t > 0.53 ? 0 : 1;
      }
      atributo('bottleClip', 'clip-path', i === 4 && t >= 0.44 ? 'url(#sc-open)' : 'none');
      atributo('bottle', 'transform', `translate(${(pose.cx - 26 * pose.s).toFixed(2)} ${pose.top.toFixed(2)}) scale(${pose.s.toFixed(4)})`);
      op('bottle', opacidadeGarrafa);
      op('shadow', i === 4 ? 1 - limitar(t / 0.1) : 1);

      // "câmera", em duas etapas com curva senoidal (começa e termina parada):
      //   inclina (.65–.73): sobe de trás até ficar sobre o caminhão, no lugar, sem o mapa;
      //   desloca (.73–.79): o mapa surge e o caminhão, já visto de cima, vai até o depósito.
      const inclinacao = i === 4 ? suavizarSeno(limitar((t - 0.65) / 0.08)) : 0;
      const movimento = i === 4 ? suavizarSeno(limitar((t - 0.73) / 0.06)) : 0;
      const opacidadeMapa = limitar(movimento / 0.6);
      op('photo', (1 - 0.6 * limitar((inclinacao - 0.4) / 0.6)) * (1 - opacidadeMapa));
      op('map', opacidadeMapa);
      const zoom = Math.pow(1.8, 1 - movimento);
      atributo('map', 'transform', `translate(${DEPOSITO[0]} ${DEPOSITO[1]}) scale(${zoom.toFixed(4)}) translate(${-DEPOSITO[0]} ${-DEPOSITO[1]})`);

      // IA: caixa + varredura + rótulo
      op('bbox', i === 1 ? limitar((t - 0.05) / 0.12) : i === 2 ? 1 - limitar(t / 0.1) : 0);
      op('chip', i === 1 ? limitar((t - 0.35) / 0.1) : 0);
      let opacidadeVarredura = 0;
      let yVarredura = 6;
      if (i === 1) { opacidadeVarredura = limitar((t - 0.05) / 0.1); yVarredura = 6 + 128 * (0.5 - 0.5 * Math.cos(2 * Math.PI * t * 1.5)); }
      if (i === 2) { opacidadeVarredura = limitar((t - 0.1) / 0.05) * (1 - limitar((t - 0.58) / 0.05)); yVarredura = 6 + 128 * limitar((t - 0.12) / 0.45); }
      op('scan', opacidadeVarredura);
      atributo('scan', 'transform', `translate(0 ${yVarredura.toFixed(1)})`);

      // validação: painel ao lado + ✓ em sequência + aprovado
      op('checks', i === 2 ? limitar((t - 0.08) / 0.12) : i === 3 ? 1 - limitar(t / 0.1) : 0);
      CHECAGENS.forEach((_, k) => {
        const ligado = i > 2 ? 1 : i === 2 ? limitar((t - (0.3 + 0.12 * k)) / 0.04) : 0;
        op(`ck${k}`, ligado);
        op(`pd${k}`, 1 - ligado);
      });
      op('approved', i > 2 ? 1 : i === 2 ? limitar((t - 0.8) / 0.06) : 0);

      // pontos
      op('particles', vis(3) * (i === 3 ? limitar((t - 0.12) / 0.1) : 1));

      // coleta: traseira em close → portas abrem → garrafa entra → portas fecham → câmera inclina → rota
      // trajeto na rota: controlado pelo scroll, só depois da intro completa
      const percurso = i !== 4 ? 0 : ehEstatico ? limitar((t - 0.8) / 0.18) : intro.v >= 1 ? limitar((t0 - 0.25) / 0.7) * seguir.v : 0;
      const pt = aoLongo(percurso * COMP_ROTA);
      const inicio = aoLongo(0);
      const surgir = i === 4 ? suavizarSaida(limitar((t - 0.1) / 0.1)) : 0;
      const assentar = i === 4 ? Math.sin(Math.PI * limitar((t - 0.59) / 0.06)) * 2.5 : 0;
      // Inclinação como câmera ortográfica girando θ = 0→90°: a traseira encolhe na altura
      // (cos θ) e o teto aparece acima dela (sin θ), as duas faces sempre emendadas na borda
      // de cima da traseira — nada se sobrepõe nem fica transparente. A escala compensa para
      // a altura total na tela ficar constante (a câmera "afasta" enquanto sobe).
      const th = (inclinacao * Math.PI) / 2;
      const cos = Math.cos(th);
      const sin = Math.sin(th);
      // profundidade → fator de perspectiva: traseira afunda para baixo (sin θ), teto para a frente (cos θ)
      const kRear = (y: number) => PERSP_F / (PERSP_F + (y + 122) * sin);
      const kTop = (x: number) => PERSP_F / (PERSP_F + (x + 150) * TOPO_K * cos);
      const acima = TOPO_COMP * sin * kTop(150);
      const abaixo = ALTURA_TRASEIRA * cos * kRear(100);
      const ts = ALTURA_TRASEIRA / (acima + abaixo); // = 1 em θ=0; altura total na tela constante
      const yBorda = TRASEIRA.y + (1 - surgir) * 16 + assentar - 122 + ts * acima; // emenda traseira/teto
      const persp = i === 4 && inclinacao > 0 && inclinacao < 1;
      atributo('truckRear', 'transform', `translate(${TRASEIRA.x} ${yBorda.toFixed(1)}) scale(${ts.toFixed(4)} ${(ts * cos).toFixed(4)}) translate(0 122)`);
      mostrar('truckRear', i === 4 && !persp && cos > 0.004 ? surgir : 0);
      mostrar('truck3d', persp ? surgir : 0);
      atributo('topShadow', 'opacity', (0.35 * (i === 4 ? Math.pow(inclinacao, 4) : 1)).toFixed(3));
      if (persp) {
        // câmera na emenda: mesma projeção F / (F + profundidade) usada para enquadrar acima
        css('truck3d', 'perspective', u(PERSP_F * ts));
        css('truck3d', 'perspectiveOrigin', `${u(TRASEIRA.x)} ${u(yBorda)}`);
        css('truckBox', 'transform', `translate(${u(TRASEIRA.x)}, ${u(yBorda)}) scale(${ts.toFixed(4)}) rotateX(${(-90 * inclinacao).toFixed(2)}deg)`);
      }
      // vista de cima (frente para cima): comprimento ∝ sin θ, traseira na emenda; depois
      // desloca até o depósito (escala em log = zoom uniforme) e percorre a rota
      const inclinado = TOPO_K * ts;
      let tx = lerp(TRASEIRA.x, inicio.x, movimento);
      let ty = lerp(yBorda - 150 * inclinado * sin, inicio.y, movimento);
      let graus = lerp(-90, inicio.deg, movimento);
      let sWid = inclinado * Math.pow(TOPO_S / inclinado, movimento);
      let sLen = sWid * sin; // no deslocamento sin já é 1
      if (percurso > 0) { tx = pt.x; ty = pt.y; graus = pt.deg; sLen = TOPO_S; sWid = TOPO_S; }
      atributo('truckTop', 'transform', `translate(${tx.toFixed(1)} ${ty.toFixed(1)}) rotate(${graus.toFixed(1)}) scale(${sLen.toFixed(4)} ${sWid.toFixed(4)})`);
      mostrar('truckTop', i === 4 && !persp && sin > 0.004 ? 1 : 0);
      // portas (duas folhas): abrem .2–.3, fecham .52–.6 com leve acomodação
      const abertura = i === 4 ? suavizarEntradaSaida(limitar((t - 0.2) / 0.1)) - suavizarEntradaSaida(limitar((t - 0.52) / 0.08)) : 0;
      const oscilacao = i === 4 ? Math.sin(Math.PI * limitar((t - 0.6) / 0.04)) * 0.04 : 0;
      // aberta = girada 180° na dobradiça, encostada na lateral com o mesmo tamanho de fechada
      const dsx = lerp(1, -1, limitar(abertura)) - oscilacao;
      atributo('doorL', 'transform', `translate(-90 0) scale(${dsx.toFixed(3)} 1) translate(90 0)`);
      atributo('doorR', 'transform', `translate(90 0) scale(${dsx.toFixed(3)} 1) translate(-90 0)`);
      // escurece de lado (de perfil para a câmera) e clareia de novo ao ficar de frente, por dentro
      const sombra = dsx >= 0 ? (1 - dsx) * 0.35 : 0.35 - Math.abs(dsx) * 0.13;
      op('shadeL', sombra);
      op('shadeR', sombra);
      atributo('route', 'stroke-dashoffset', (COMP_ROTA * (1 - percurso)).toFixed(1));
      POSICAO_PARADA.forEach((quando, k) => { if (k > 0) op(`stop${k}`, percurso * COMP_ROTA >= quando - 2 ? 1 : 0); });

      // cabeçalho e painel de detalhes por passo
      for (let k = 0; k < 5; k++) { op(`head${k}`, vis(k)); op(`detail${k}`, vis(k)); }
    };

    aplicar(0);
    if (refProgresso) refProgresso.current = aplicar;
    return () => {
      if (tweenIntro) onIntroRef.current?.(false);
      tweenIntro?.kill();
      tweenSeguir?.kill();
      if (refProgresso) refProgresso.current = null;
    };
  }, [modo, passo, refProgresso]);

  const pct = (x: number, total: number) => `${(x / total) * 100}%`;

  return (
    <div className={cn('surface w-full overflow-hidden rounded-2xl', className)}>
      {/* cabeçalho (troca suave por passo) */}
      <div className="relative h-[49px] border-b border-line">
        {META_PASSOS.map((m, k) => (
          <div key={m.title} ref={ref(`head${k}`)} className="absolute inset-0 flex items-center justify-between px-5" style={{ opacity: 0 }} aria-hidden={modo === 'scroll' ? undefined : k !== passo}>
            <span className="text-[13px] font-medium text-fg-soft">{m.title}</span>
            <span className="font-mono text-[11px] text-subtle tabular">{m.meta}</span>
          </div>
        ))}
      </div>

      <div className="p-4 sm:p-5">
        {/* palco */}
        <div className="relative aspect-[520/320] overflow-hidden rounded-xl border border-line bg-[#0d1210] [container-type:inline-size]">
          <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 size-full" aria-hidden>
            <defs>
              <linearGradient id="sc-wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1a221d" /><stop offset="1" stopColor="#111713" /></linearGradient>
              <linearGradient id="sc-table" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#202a24" /><stop offset="1" stopColor="#141b17" /></linearGradient>
            </defs>
            {/* bancada */}
            <g ref={ref('photo')}>
              <rect width={W} height="238" fill="url(#sc-wall)" />
              <rect y="238" width={W} height={H - 238} fill="url(#sc-table)" />
              <line x1="0" y1="238" x2={W} y2="238" stroke="#ecefea" strokeOpacity=".06" />
            </g>
            {/* mapa da rota */}
            <g ref={ref('map')} style={{ opacity: 0 }}>
              <rect width={W} height={H} fill="#0c110e" />
              {Array.from({ length: 13 }, (_, k) => <line key={`h${k}`} x1="0" x2={W} y1={k * 26} y2={k * 26} stroke="#ecefea" strokeOpacity=".035" />)}
              {Array.from({ length: 21 }, (_, k) => <line key={`v${k}`} y1="0" y2={H} x1={k * 26} x2={k * 26} stroke="#ecefea" strokeOpacity=".035" />)}
              <path d={caminhoIngenuo} stroke="#ecefea" strokeOpacity=".2" strokeWidth="1.5" strokeDasharray="3 5" fill="none" />
              <path d={caminhoRota} stroke="#34d399" strokeOpacity=".18" strokeWidth="2.5" fill="none" strokeLinejoin="round" />
              <path ref={ref('route')} d={caminhoRota} stroke="#34d399" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeDasharray={COMP_ROTA} strokeDashoffset={COMP_ROTA} />
              {PARADAS.map(([x, y], k) => (
                <g key={k}>
                  <circle cx={x} cy={y} r="9" fill="#0a0e0c" stroke={k === 0 ? '#ecefea' : 'rgb(52 211 153 / 0.45)'} strokeWidth="1.5" />
                  {k > 0 && <circle ref={ref(`stop${k}`)} cx={x} cy={y} r="9" fill="#123b2c" stroke="#34d399" strokeWidth="1.5" style={{ opacity: 0 }} />}
                  <text x={x} y={y + 3.2} textAnchor="middle" fontSize="9" fill="#ecefea" fontFamily="Geist Mono Variable, monospace">{k === 0 ? 'D' : k}</text>
                </g>
              ))}
            </g>
            {/* caminhão: traseira (close) e vista de cima (rota) — mesmo desenho, mesmo estilo.
                Cada desenho existe uma vez (defs) e é clonado: inteiro, ou em faixas na inclinação. */}
            <defs>
              <g id={desenhoTraseira}><TraseiraCaminhao r={ref} /></g>
              <g id={desenhoTopo}><CaminhaoDeCima r={ref} /></g>
            </defs>
            <g ref={ref('truckRear')} style={{ opacity: 0, visibility: 'hidden' }}><use href={`#${desenhoTraseira}`} /></g>
            <g ref={ref('truckTop')} style={{ opacity: 0, visibility: 'hidden' }}><use href={`#${desenhoTopo}`} /></g>
            <clipPath id="sc-open" clipPathUnits="userSpaceOnUse">
              <rect x={ABERTURA.x0} y={ABERTURA.y0} width={ABERTURA.x1 - ABERTURA.x0} height={ABERTURA.y1 - ABERTURA.y0} />
            </clipPath>
            {/* garrafa persistente (+ sombra, caixa de detecção e linha de varredura acompanham) */}
            <g ref={ref('bottleClip')}>
            <g ref={ref('bottle')}>
              <ellipse ref={ref('shadow')} cx="26" cy="138" rx="34" ry="5" fill="#000" opacity=".45" />
              <DesenhoGarrafa />
              <g ref={ref('bbox')} fill="none" stroke="#34d399" strokeWidth="1.6" strokeLinecap="round" style={{ opacity: 0 }}>
                <path d="M-10 -2v-6h8M54 -8h8v6M62 140v6h-8M-2 146h-8v-6" />
                <rect x="-10" y="-8" width="72" height="154" rx="2" strokeOpacity=".22" strokeWidth=".8" />
              </g>
              <g ref={ref('scan')} style={{ opacity: 0 }}>
                <line x1="-10" x2="62" y1="0" y2="0" stroke="#34d399" strokeWidth="1.2" />
              </g>
            </g>
            </g>
          </svg>

          {/* inclinação da câmera: traseira e teto como dois planos 3D emendados a 90°, girando
              juntos em volta da emenda (só visível enquanto inclina; ver PERSP_F) */}
          <div ref={ref('truck3d')} className="pointer-events-none absolute inset-0" style={{ opacity: 0, visibility: 'hidden' }} aria-hidden>
            <div ref={ref('truckBox')} className="absolute top-0 left-0 origin-top-left [transform-style:preserve-3d]">
              <svg viewBox="-135 -122 270 234" className="absolute" style={{ left: u(-135), top: 0, width: u(270), height: u(234) }}>
                <use href={`#${desenhoTraseira}`} />
              </svg>
              <svg viewBox="-136 -316 272 616" className="absolute origin-bottom" style={{ left: u(-136), top: u(-616), width: u(272), height: u(616), transform: 'rotateX(90deg)' }}>
                <g transform={`rotate(-90) scale(${TOPO_K})`}><use href={`#${desenhoTopo}`} /></g>
              </svg>
            </div>
          </div>

          {/* rótulo da IA (passo 2) */}
          <div ref={ref('chip')} className="absolute rounded-md border border-line-strong bg-bg/90 px-2.5 py-1.5" style={{ left: pct(P_FOTO.cx + 26 * P_FOTO.s + 18, W), top: pct(P_FOTO.top, H), opacity: 0 }}>
            <p className="font-mono text-[10px] text-subtle uppercase">Plástico · PET</p>
            <p className="font-mono text-[13px] text-fg tabular">96%</p>
          </div>

          {/* checagens ao lado da garrafa (passo 3) */}
          <div ref={ref('checks')} className="absolute inset-y-[10%] right-[4%] left-[44%] flex flex-col justify-center rounded-lg border border-line bg-bg/80 px-3 sm:px-4" style={{ opacity: 0 }}>
            <ul className="divide-y divide-line">
              {CHECAGENS.map((c, k) => (
                <li key={c} className="flex items-center gap-2.5 py-1.5 text-[11px] leading-snug text-fg-soft sm:py-2.5 sm:text-[13px]">
                  <span className="relative inline-flex size-4 shrink-0 items-center justify-center">
                    <span ref={ref(`pd${k}`)} className="absolute inset-0.5 rounded-full border border-line-strong" />
                    <Check ref={ref(`ck${k}`)} className="absolute size-4 text-brand-300" strokeWidth={2.5} style={{ opacity: 0 }} aria-hidden />
                  </span>
                  <span className="sm:hidden">{CHECAGENS_CURTAS[k]}</span>
                  <span className="max-sm:hidden">{c}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* pontos subindo (passo 4) */}
          <div ref={ref('particles')} aria-hidden className="pointer-events-none absolute" style={{ left: pct(P_PONTOS.cx, W), top: pct(P_PONTOS.top + 50, H), opacity: 0 }}>
            {PARTICULAS.map((q, k) => (
              <span
                key={k}
                className={cn('absolute font-mono text-[13px] tabular', k % 3 === 0 ? 'text-accent' : 'text-brand-300', animado && 'animate-[pts-rise_2.6s_cubic-bezier(0.22,1,0.36,1)_infinite]')}
                style={{ left: q.x, top: q.y, animationDelay: `${q.d}s`, opacity: animado ? undefined : 0.85 }}
              >
                {q.t}
              </span>
            ))}
          </div>
        </div>

        {/* detalhes por passo (altura fixa, troca suave) */}
        <div className="relative mt-4 h-[104px]">
          <div ref={ref('detail0')} className="absolute inset-0" style={{ opacity: 0 }}>
            <Linha k="Quantidade" v="2,4 kg" />
            <Linha k="Local" v={<span className="inline-flex items-center gap-1"><MapPin className="size-3.5 text-subtle" aria-hidden />Vila Mariana</span>} />
            <Linha k="Foto" v="garrafa-pet.jpg · 1,2 MB" />
          </div>
          <div ref={ref('detail1')} className="absolute inset-0 space-y-2" style={{ opacity: 0 }}>
            {[{ n: 'Plástico (PET)', p: 96, c: '#e5484d' }, { n: 'Papel', p: 3, c: '#3b82f6' }, { n: 'Vidro', p: 1, c: '#22c55e' }].map((r, k) => (
              <div key={r.n}>
                <div className="mb-1 flex justify-between text-[13px]">
                  <span className={k === 0 ? 'text-fg' : 'text-muted'}>{r.n}</span>
                  <span className="font-mono text-fg-soft tabular">{r.p}%</span>
                </div>
                <div className="h-1 rounded-full bg-white/[0.06]"><div className="h-full rounded-full opacity-80" style={{ width: `${r.p}%`, background: r.c }} /></div>
              </div>
            ))}
          </div>
          <div ref={ref('detail2')} className="absolute inset-0 flex flex-col justify-center" style={{ opacity: 0 }}>
            <div className="relative flex items-center justify-between rounded-xl border border-line px-4 py-3">
              <div ref={ref('approved')} aria-hidden className="absolute inset-0 rounded-xl border border-brand-300/40 bg-brand-500/[0.08]" style={{ opacity: 0 }} />
              <span className="relative text-[14px] font-medium text-fg">Descarte aprovado</span>
              <span className="relative inline-flex items-center gap-1.5 font-mono text-[11px] text-brand-300 uppercase"><span className="size-1.5 rounded-full bg-brand-300" />aprovado</span>
            </div>
            <p className="mt-2.5 text-[12.5px] text-muted">Pontos liberados só depois das quatro checagens.</p>
          </div>
          <div ref={ref('detail3')} className="absolute inset-0" style={{ opacity: 0 }}>
            <div className="flex items-baseline justify-between">
              <p className="font-mono text-[34px] leading-none font-medium tracking-[-0.04em] text-fg tabular">+48<span className="ml-1.5 text-base text-subtle">pts</span></p>
              <p className="font-mono text-[12px] text-muted">2,4 kg × 20 pts/kg</p>
            </div>
            <div className="mt-5">
              <div className="mb-2 flex justify-between text-[13px]"><span className="text-muted">Até o nível Árvore</span><span className="font-mono text-fg-soft tabular">152 pts</span></div>
              <div className="h-1 rounded-full bg-white/[0.06]"><div className="h-full w-[68%] rounded-full bg-brand-500" /></div>
            </div>
          </div>
          <div ref={ref('detail4')} className="absolute inset-0 grid grid-cols-3 content-center divide-x divide-line text-center" style={{ opacity: 0 }}>
            {[['Paradas', '5'], ['Distância', '8,2 km'], ['Carga', '340 kg']].map(([k, v]) => (
              <div key={k}><p className="text-[12px] text-muted">{k}</p><p className="font-mono text-[15px] text-fg tabular">{v}</p></div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Linha({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-t border-line py-2.5 first:border-t-0 first:pt-0">
      <span className="text-[13px] text-muted">{k}</span>
      <span className="font-mono text-[13px] text-fg tabular">{v}</span>
    </div>
  );
}
