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
import { useLayoutEffect, useRef, type MutableRefObject, type ReactNode } from 'react';
import { Check, MapPin } from 'lucide-react';
import { prefersReducedMotion } from '@/hooks/useReducedMotion';
import { cn } from '@/lib/cn';

// ------------------------------------------------------------------ geometria (palco 520×320)

const W = 520;
const H = 320;
const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/** Pose da garrafa: centro x, topo y, escala (desenho local: 52×134, centro x=26). */
interface Pose { cx: number; top: number; s: number }
const P_PHOTO: Pose = { cx: 260, top: 46, s: 1.4 };
const P_CHECK: Pose = { cx: 122, top: 58, s: 1.28 };
const P_POINTS: Pose = { cx: 260, top: 52, s: 1.3 };
/** Garrafa "pairando" antes de ir para o caminhão (centro x, centro y, escala). */
const HOVER = { x: 92, y: 70, s: 0.5 };
const poseLerp = (a: Pose, b: Pose, t: number): Pose => ({ cx: lerp(a.cx, b.cx, t), top: lerp(a.top, b.top, t), s: lerp(a.s, b.s, t) });

const STOPS: [number, number][] = [[62, 262], [150, 172], [236, 228], [326, 118], [408, 192], [466, 86]];
const NAIVE = [0, 2, 1, 4, 3, 5];
const DEPOT = STOPS[0];

/**
 * Passo 05 — caminhão. Um só estilo plano (ortográfico) em duas vistas do MESMO desenho:
 *   traseira (close, portas de duas folhas) → câmera "inclina" → vista de cima (ícone na rota).
 * REAR: centro da traseira no palco. Abertura local: x −90..90, y −102..42.
 */
const REAR = { x: 290, y: 168 };
const OPEN = { x0: REAR.x - 90, x1: REAR.x + 90, y0: REAR.y - 102, y1: REAR.y + 42 };
const TOP_S = 0.16; // ícone: 300×116 local → ~48×19 px no palco
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const routeD = STOPS.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' ');
const naiveD = NAIVE.map((k, i) => `${i ? 'L' : 'M'}${STOPS[k][0]} ${STOPS[k][1]}`).join(' ');
const SEG = STOPS.slice(1).map(([x, y], i) => Math.hypot(x - STOPS[i][0], y - STOPS[i][1]));
const ROUTE_LEN = SEG.reduce((a, b) => a + b, 0);
const STOP_AT = SEG.reduce<number[]>((acc, l) => [...acc, acc[acc.length - 1] + l], [0]);

/** Ponto e ângulo ao longo da rota (polilinha), com curva suave do ângulo nas esquinas. */
function along(d: number): { x: number; y: number; deg: number } {
  let rest = clamp(d, 0, ROUTE_LEN);
  for (let i = 0; i < SEG.length; i++) {
    if (rest <= SEG[i] || i === SEG.length - 1) {
      const [x0, y0] = STOPS[i];
      const [x1, y1] = STOPS[i + 1];
      const f = SEG[i] ? rest / SEG[i] : 0;
      let deg = (Math.atan2(y1 - y0, x1 - x0) * 180) / Math.PI;
      const left = SEG[i] - rest;
      if (left < 14 && i < SEG.length - 1) {
        const [x2, y2] = STOPS[i + 2];
        let next = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
        if (next - deg > 180) next -= 360;
        if (deg - next > 180) next += 360;
        deg = lerp(deg, next, (1 - left / 14) * 0.5);
      }
      return { x: lerp(x0, x1, f), y: lerp(y0, y1, f), deg };
    }
    rest -= SEG[i];
  }
  const [x, y] = STOPS[STOPS.length - 1];
  return { x, y, deg: 0 };
}

const STEP_META = [
  { title: 'Novo descarte', meta: '23/10 · 14:02' },
  { title: 'Identificação por IA', meta: '0,8 s' },
  { title: 'Validação antifraude', meta: 'risco 0,04' },
  { title: 'Pontos creditados', meta: 'nível Broto' },
  { title: 'Rota otimizada', meta: '−31% km' },
];
const CHECKS = ['Foto inédita (hash perceptual)', 'Quantidade dentro do limite', 'Localização consistente', 'Frequência normal de envios'];
/** Versões curtas para o palco estreito do celular. */
const CHECKS_SHORT = ['Foto inédita', 'Quantidade ok', 'Local consistente', 'Frequência normal'];
const PARTICLES = [
  { t: '+3', x: -78, y: 30, d: 0 }, { t: '+5', x: 70, y: 6, d: 0.35 }, { t: '+8', x: -60, y: -18, d: 0.8 },
  { t: '+12', x: 82, y: 58, d: 1.15 }, { t: '+', x: -92, y: 78, d: 1.5 }, { t: '+6', x: 54, y: -40, d: 1.85 },
  { t: '+', x: 96, y: 18, d: 0.55 }, { t: '+9', x: -44, y: 96, d: 2.1 },
];

// ------------------------------------------------------------------ desenhos

function BottleArt() {
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
function TruckRear({ r }: { r: (k: string) => (el: SVGElement | null) => void }) {
  const door = (side: -1 | 1) => {
    const x = side < 0 ? -90 : 0;
    return (
      <g ref={r(side < 0 ? 'doorL' : 'doorR')}>
        <rect x={x} y="-102" width="90" height="144" fill="url(#tr-door)" />
        <rect x={x} y="-102" width="90" height="144" fill="none" stroke="#0a0e0c" strokeOpacity=".22" strokeWidth="1.5" />
        <path d={`M${x + 8} -78h74M${x + 8} 18h74`} stroke="#0a0e0c" strokeOpacity=".1" strokeWidth="2" />
        <rect x={x} y="-34" width="90" height="9" fill="#34d399" />
        <rect x={side < 0 ? -14 : 10} y="-18" width="4" height="26" rx="2" fill="#7d8680" />
        {/* sombreamento conforme gira */}
        <rect ref={r(side < 0 ? 'shadeL' : 'shadeR')} x={x} y="-102" width="90" height="144" fill="#000" style={{ opacity: 0 }} />
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
      {door(-1)}
      {door(1)}
    </>
  );
}

/** O mesmo caminhão visto de cima (frente para +x): baú, faixa, cabine, para-brisa, giroflex. */
function TruckTop() {
  return (
    <>
      <defs>
        <linearGradient id="tt-body" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#d3d9d4" /><stop offset="1" stopColor="#b9c0bb" /></linearGradient>
      </defs>
      <rect x="-144" y="-50" width="300" height="116" rx="14" fill="#000" opacity=".35" />
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

export interface StoryCardProps {
  /** scroll: controlado por `progressRef.current(p)` (p de 0 a 5). static: estado final de `step`. */
  mode: 'scroll' | 'static';
  step?: number;
  progressRef?: MutableRefObject<((p: number) => void) | null>;
  className?: string;
}

export function StoryCard({ mode, step = 0, progressRef, className }: StoryCardProps) {
  const els = useRef<Record<string, HTMLElement | SVGElement | null>>({});
  const ref = (k: string) => (el: HTMLElement | SVGElement | null) => { els.current[k] = el; };
  const animated = mode === 'scroll' || !prefersReducedMotion();

  useLayoutEffect(() => {
    const e = els.current;
    const op = (k: string, v: number) => { const el = e[k]; if (el) el.style.opacity = String(Math.round(v * 1000) / 1000); };
    const last: Record<string, string> = {};
    const attr = (k: string, name: string, v: string) => {
      const key = k + name;
      if (last[key] === v) return;
      last[key] = v;
      e[k]?.setAttribute(name, v);
    };

    const apply = (pRaw: number) => {
      const isStatic = mode === 'static';
      const p = isStatic ? step + 0.999 : clamp(pRaw, 0, 4.999);
      const i = Math.min(4, Math.floor(p));
      const t = p - i;
      const vis = (k: number) => {
        if (isStatic) return k === step ? 1 : 0;
        const lo = k === 0 ? 1 : clamp((p - k) / 0.06);
        const hi = k === 4 ? 1 : clamp((k + 1 - p) / 0.06);
        return lo * hi;
      };

      // garrafa (persistente)
      let pose = P_PHOTO;
      let bottleO = 1;
      if (i === 2) pose = poseLerp(P_PHOTO, P_CHECK, easeOut(clamp(t / 0.2)));
      else if (i === 3) pose = poseLerp(P_CHECK, P_POINTS, easeOut(clamp(t / 0.2)));
      else if (i === 4) {
        // A: sobe para "pairar" à esquerda · B (.2–.38): arco até o centro da abertura ·
        // C (.38–.47): cai para dentro — some ao passar a soleira (clip na abertura)
        const hoverPose: Pose = { cx: HOVER.x, top: HOVER.y - 67 * HOVER.s, s: HOVER.s };
        if (t < 0.2) pose = poseLerp(P_POINTS, hoverPose, easeInOut(clamp(t / 0.16)));
        else if (t < 0.38) {
          const a = easeInOut(clamp((t - 0.2) / 0.18));
          const c = { x: REAR.x - 110, y: REAR.y - 150 };
          const e = { x: REAR.x, y: REAR.y - 58 };
          const bx = (1 - a) * (1 - a) * HOVER.x + 2 * (1 - a) * a * c.x + a * a * e.x;
          const by = (1 - a) * (1 - a) * HOVER.y + 2 * (1 - a) * a * c.y + a * a * e.y;
          const bs = lerp(HOVER.s, 0.48, a);
          pose = { cx: bx, top: by - 67 * bs, s: bs };
        } else {
          const d = clamp((t - 0.38) / 0.09);
          const bs = lerp(0.48, 0.38, d);
          const by = lerp(REAR.y - 58, REAR.y + 92, d * d);
          pose = { cx: REAR.x, top: by - 67 * bs, s: bs };
        }
        bottleO = t > 0.48 ? 0 : 1;
      }
      attr('bottleClip', 'clip-path', i === 4 && t >= 0.38 ? 'url(#sc-open)' : 'none');
      attr('bottle', 'transform', `translate(${(pose.cx - 26 * pose.s).toFixed(2)} ${pose.top.toFixed(2)}) scale(${pose.s.toFixed(4)})`);
      op('bottle', bottleO);
      op('shadow', i === 4 ? 1 - clamp(t / 0.1) : 1);

      // "câmera": traseira → vista de cima, enquanto encolhe até o depósito (.58–.76)
      const cam = i === 4 ? easeInOut(clamp((t - 0.58) / 0.18)) : 0;
      const mapO = i === 4 ? clamp((cam - 0.15) / 0.6) : 0;
      op('photo', 1 - mapO);
      op('map', mapO);
      const zoom = lerp(1.8, 1, cam);
      attr('map', 'transform', `translate(${DEPOT[0]} ${DEPOT[1]}) scale(${zoom.toFixed(4)}) translate(${-DEPOT[0]} ${-DEPOT[1]})`);

      // IA: caixa + varredura + rótulo
      op('bbox', i === 1 ? clamp((t - 0.05) / 0.12) : i === 2 ? 1 - clamp(t / 0.1) : 0);
      op('chip', i === 1 ? clamp((t - 0.35) / 0.1) : 0);
      let scanO = 0;
      let scanY = 6;
      if (i === 1) { scanO = clamp((t - 0.05) / 0.1); scanY = 6 + 128 * (0.5 - 0.5 * Math.cos(2 * Math.PI * t * 1.5)); }
      if (i === 2) { scanO = clamp((t - 0.1) / 0.05) * (1 - clamp((t - 0.58) / 0.05)); scanY = 6 + 128 * clamp((t - 0.12) / 0.45); }
      op('scan', scanO);
      attr('scan', 'transform', `translate(0 ${scanY.toFixed(1)})`);

      // validação: painel ao lado + ✓ em sequência + aprovado
      op('checks', i === 2 ? clamp((t - 0.08) / 0.12) : i === 3 ? 1 - clamp(t / 0.1) : 0);
      CHECKS.forEach((_, k) => {
        const on = i > 2 ? 1 : i === 2 ? clamp((t - (0.3 + 0.12 * k)) / 0.04) : 0;
        op(`ck${k}`, on);
        op(`pd${k}`, 1 - on);
      });
      op('approved', i > 2 ? 1 : i === 2 ? clamp((t - 0.8) / 0.06) : 0);

      // pontos
      op('particles', vis(3) * (i === 3 ? clamp((t - 0.12) / 0.1) : 1));

      // coleta: traseira em close → portas abrem → garrafa entra → portas fecham → câmera inclina → rota
      const drive = i === 4 ? clamp((t - 0.78) / 0.2) : 0;
      const pt = along(drive * ROUTE_LEN);
      const start = along(0);
      const appear = i === 4 ? easeOut(clamp((t - 0.02) / 0.12)) : 0;
      const settle = i === 4 ? Math.sin(Math.PI * clamp((t - 0.53) / 0.06)) * 2.5 : 0;
      // traseira: entra subindo, depois "achata" (inclinação) e encolhe rumo ao depósito
      const rx = lerp(REAR.x, start.x, cam);
      const ry = lerp(REAR.y + (1 - appear) * 16 + settle, start.y, cam);
      const rs = lerp(1, 0.24, cam);
      attr('truckRear', 'transform', `translate(${rx.toFixed(1)} ${ry.toFixed(1)}) scale(${rs.toFixed(4)} ${(rs * lerp(1, 0.12, cam)).toFixed(4)})`);
      op('truckRear', appear * (1 - clamp((cam - 0.35) / 0.3)));
      // vista de cima: nasce "achatada" no comprimento e abre até a planta; depois percorre a rota
      let tx = rx;
      let ty = ry;
      let deg = lerp(-90, start.deg, cam);
      let sLen = lerp(0.62, TOP_S, cam) * lerp(0.15, 1, cam);
      let sWid = lerp(0.62, TOP_S, cam);
      if (drive > 0) { tx = pt.x; ty = pt.y; deg = pt.deg; sLen = TOP_S; sWid = TOP_S; }
      attr('truckTop', 'transform', `translate(${tx.toFixed(1)} ${ty.toFixed(1)}) rotate(${deg.toFixed(1)}) scale(${sLen.toFixed(4)} ${sWid.toFixed(4)})`);
      op('truckTop', i === 4 ? clamp((cam - 0.35) / 0.3) : 0);
      // portas (duas folhas): abrem .12–.24, fecham .46–.55 com leve acomodação
      const open = i === 4 ? easeInOut(clamp((t - 0.12) / 0.12)) - easeInOut(clamp((t - 0.46) / 0.09)) : 0;
      const wobble = i === 4 ? Math.sin(Math.PI * clamp((t - 0.55) / 0.04)) * 0.04 : 0;
      const dsx = lerp(1, -0.32, clamp(open)) - wobble;
      attr('doorL', 'transform', `translate(-90 0) scale(${dsx.toFixed(3)} 1) translate(90 0)`);
      attr('doorR', 'transform', `translate(90 0) scale(${dsx.toFixed(3)} 1) translate(-90 0)`);
      const shade = dsx >= 0 ? (1 - dsx) * 0.35 : 0.3 + Math.abs(dsx) * 0.2;
      op('shadeL', shade);
      op('shadeR', shade);
      attr('route', 'stroke-dashoffset', (ROUTE_LEN * (1 - drive)).toFixed(1));
      STOP_AT.forEach((at, k) => { if (k > 0) op(`stop${k}`, drive * ROUTE_LEN >= at - 2 ? 1 : 0); });

      // cabeçalho e painel de detalhes por passo
      for (let k = 0; k < 5; k++) { op(`head${k}`, vis(k)); op(`detail${k}`, vis(k)); }
    };

    apply(0);
    if (progressRef) progressRef.current = apply;
    return () => { if (progressRef) progressRef.current = null; };
  }, [mode, step, progressRef]);

  const pct = (x: number, total: number) => `${(x / total) * 100}%`;

  return (
    <div className={cn('surface w-full overflow-hidden rounded-2xl', className)}>
      {/* cabeçalho (troca suave por passo) */}
      <div className="relative h-[49px] border-b border-line">
        {STEP_META.map((m, k) => (
          <div key={m.title} ref={ref(`head${k}`)} className="absolute inset-0 flex items-center justify-between px-5" style={{ opacity: 0 }} aria-hidden={mode === 'scroll' ? undefined : k !== step}>
            <span className="text-[13px] font-medium text-fg-soft">{m.title}</span>
            <span className="font-mono text-[11px] text-subtle tabular">{m.meta}</span>
          </div>
        ))}
      </div>

      <div className="p-4 sm:p-5">
        {/* palco */}
        <div className="relative aspect-[520/320] overflow-hidden rounded-xl border border-line bg-[#0d1210]">
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
              <path d={naiveD} stroke="#ecefea" strokeOpacity=".2" strokeWidth="1.5" strokeDasharray="3 5" fill="none" />
              <path d={routeD} stroke="#34d399" strokeOpacity=".18" strokeWidth="2.5" fill="none" strokeLinejoin="round" />
              <path ref={ref('route')} d={routeD} stroke="#34d399" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeDasharray={ROUTE_LEN} strokeDashoffset={ROUTE_LEN} />
              {STOPS.map(([x, y], k) => (
                <g key={k}>
                  <circle cx={x} cy={y} r="9" fill="#0a0e0c" stroke={k === 0 ? '#ecefea' : 'rgb(52 211 153 / 0.45)'} strokeWidth="1.5" />
                  {k > 0 && <circle ref={ref(`stop${k}`)} cx={x} cy={y} r="9" fill="#123b2c" stroke="#34d399" strokeWidth="1.5" style={{ opacity: 0 }} />}
                  <text x={x} y={y + 3.2} textAnchor="middle" fontSize="9" fill="#ecefea" fontFamily="Geist Mono Variable, monospace">{k === 0 ? 'D' : k}</text>
                </g>
              ))}
            </g>
            {/* caminhão: traseira (close) e vista de cima (rota) — mesmo desenho, mesmo estilo */}
            <g ref={ref('truckRear')} style={{ opacity: 0 }}><TruckRear r={ref} /></g>
            <g ref={ref('truckTop')} style={{ opacity: 0 }}><TruckTop /></g>
            <clipPath id="sc-open" clipPathUnits="userSpaceOnUse">
              <rect x={OPEN.x0} y={OPEN.y0} width={OPEN.x1 - OPEN.x0} height={OPEN.y1 - OPEN.y0} />
            </clipPath>
            {/* garrafa persistente (+ sombra, caixa de detecção e linha de varredura acompanham) */}
            <g ref={ref('bottleClip')}>
            <g ref={ref('bottle')}>
              <ellipse ref={ref('shadow')} cx="26" cy="138" rx="34" ry="5" fill="#000" opacity=".45" />
              <BottleArt />
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

          {/* rótulo da IA (passo 2) */}
          <div ref={ref('chip')} className="absolute rounded-md border border-line-strong bg-bg/90 px-2.5 py-1.5" style={{ left: pct(P_PHOTO.cx + 26 * P_PHOTO.s + 18, W), top: pct(P_PHOTO.top, H), opacity: 0 }}>
            <p className="font-mono text-[10px] text-subtle uppercase">Plástico · PET</p>
            <p className="font-mono text-[13px] text-fg tabular">96%</p>
          </div>

          {/* checagens ao lado da garrafa (passo 3) */}
          <div ref={ref('checks')} className="absolute inset-y-[10%] right-[4%] left-[44%] flex flex-col justify-center rounded-lg border border-line bg-bg/80 px-3 sm:px-4" style={{ opacity: 0 }}>
            <ul className="divide-y divide-line">
              {CHECKS.map((c, k) => (
                <li key={c} className="flex items-center gap-2.5 py-1.5 text-[11px] leading-snug text-fg-soft sm:py-2.5 sm:text-[13px]">
                  <span className="relative inline-flex size-4 shrink-0 items-center justify-center">
                    <span ref={ref(`pd${k}`)} className="absolute inset-0.5 rounded-full border border-line-strong" />
                    <Check ref={ref(`ck${k}`)} className="absolute size-4 text-brand-300" strokeWidth={2.5} style={{ opacity: 0 }} aria-hidden />
                  </span>
                  <span className="sm:hidden">{CHECKS_SHORT[k]}</span>
                  <span className="max-sm:hidden">{c}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* pontos subindo (passo 4) */}
          <div ref={ref('particles')} aria-hidden className="pointer-events-none absolute" style={{ left: pct(P_POINTS.cx, W), top: pct(P_POINTS.top + 50, H), opacity: 0 }}>
            {PARTICLES.map((q, k) => (
              <span
                key={k}
                className={cn('absolute font-mono text-[13px] tabular', k % 3 === 0 ? 'text-accent' : 'text-brand-300', animated && 'animate-[pts-rise_2.6s_cubic-bezier(0.22,1,0.36,1)_infinite]')}
                style={{ left: q.x, top: q.y, animationDelay: `${q.d}s`, opacity: animated ? undefined : 0.85 }}
              >
                {q.t}
              </span>
            ))}
          </div>
        </div>

        {/* detalhes por passo (altura fixa, troca suave) */}
        <div className="relative mt-4 h-[104px]">
          <div ref={ref('detail0')} className="absolute inset-0" style={{ opacity: 0 }}>
            <Row k="Quantidade" v="2,4 kg" />
            <Row k="Local" v={<span className="inline-flex items-center gap-1"><MapPin className="size-3.5 text-subtle" aria-hidden />Vila Mariana</span>} />
            <Row k="Foto" v="garrafa-pet.jpg · 1,2 MB" />
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

function Row({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-t border-line py-2.5 first:border-t-0 first:pt-0">
      <span className="text-[13px] text-muted">{k}</span>
      <span className="font-mono text-[13px] text-fg tabular">{v}</span>
    </div>
  );
}
