/**
 * Cena three.js da landing: partículas que saem do "caos" (resíduos dispersos) e se
 * organizam num anel de economia circular — o "0" do logo — fluindo em volta de um
 * planeta de pontos.
 *
 * Desempenho (pensado para GPUs integradas, ex.: Intel UHD 600):
 * - Sem requestAnimationFrame próprio: roda no gsap.ticker (o mesmo do Lenis/ScrollTrigger).
 * - Só renderiza enquanto o hero é relevante: para por completo quando a página já rolou
 *   além do hero ou a aba fica oculta (visibilitychange), e retoma ao voltar.
 * - 30 fps quando ociosa (intro concluída, sem mouse/scroll recentes).
 * - Buffer de desenho limitado (DPR 1 em máquinas com ≤ 4 threads, largura interna ≤ 1600 px).
 * - Máscara de "continentes" do planeta calculada UMA vez na CPU (atributo), não por quadro.
 * - Governador adaptativo (após a intro): mediana do intervalo de quadros > 28 ms reduz DPR e
 *   partículas, depois fixa 30 fps; só cai para o fundo estático se ainda ficar abaixo de ~25 fps.
 */
import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import {
  AdditiveBlending, BufferAttribute, BufferGeometry, Color, Group, PerspectiveCamera, Points, Scene,
  ShaderMaterial, WebGLRenderer,
} from 'three';

interface Props { onReady?: () => void; onFail?: () => void }

const ANEL_VERT = /* glsl */ `
uniform float uTime;
uniform float uProgress;
uniform float uScroll;
uniform float uPixelRatio;
uniform float uSize;
uniform float uTextFade; // 1 = esmaece partículas na metade esquerda (texto) conforme o scroll
attribute vec3 aScatter;
attribute vec4 aRing;   // theta, phi, raio, velocidade
attribute vec3 aMeta;   // tamanho, atraso, semente
varying float vGrad;
varying float vAlpha;
varying float vHead;
const float TAU = 6.2831853;
const float R = 2.55;
const float TUBE = 0.42;
void main() {
  float t = uTime;
  float theta = aRing.x + t * aRing.w;
  float phi = aRing.y + t * aRing.w * 2.3;
  float tube = TUBE * (0.25 + aRing.z * 0.75);
  float cp = cos(phi);
  vec3 ring = vec3((R + tube * cp) * cos(theta), (R + tube * cp) * sin(theta), tube * sin(phi) * 0.8);
  ring *= 1.0 + uScroll * 0.28;
  float p = smoothstep(aMeta.y * 0.55, aMeta.y * 0.55 + 0.45, uProgress);
  vec3 pos = mix(aScatter, ring, p);
  pos += aScatter * (uScroll * uScroll * (0.08 + aMeta.z * 0.3));
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;
  float ang = mod(theta, TAU);
  vGrad = ang / TAU;
  float d = abs(ang - mod(t * 0.55, TAU));
  d = min(d, TAU - d);
  vHead = exp(-d * d * 3.0) * p;
  float g = abs(ang - 1.05);
  g = min(g, TAU - g);
  float ndcX = gl_Position.x / gl_Position.w;
  float textMask = mix(1.0, smoothstep(-0.15, 0.35, ndcX), uScroll * uTextFade);
  vAlpha = mix(0.3, 1.0, p) * mix(1.0, smoothstep(0.06, 0.32, g), p) * (1.0 - uScroll * 0.7) * textMask;
  gl_PointSize = uSize * aMeta.x * (1.0 + vHead * 0.5) * uPixelRatio * (9.0 / -mv.z);
}
`;

const ANEL_FRAG = /* glsl */ `
uniform vec3 uC1;
uniform vec3 uC2;
uniform vec3 uC3;
uniform float uAlphaMul;
varying float vGrad;
varying float vAlpha;
varying float vHead;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d2 = dot(c, c);
  if (d2 > 0.25) discard;
  float a = 1.0 - d2 * 4.0;
  a *= a;
  vec3 col = vGrad < 0.55 ? mix(uC1, uC2, vGrad / 0.55) : mix(uC2, uC3, (vGrad - 0.55) / 0.45);
  col = mix(col, vec3(0.85, 1.0, 0.7), vHead * 0.3);
  gl_FragColor = vec4(col, min(1.0, a * vAlpha * uAlphaMul * (0.95 + vHead * 0.45)));
}
`;

const GLOBO_VERT = /* glsl */ `
uniform float uProgress;
uniform float uPixelRatio;
attribute float aLand;  // máscara de "continente" pré-calculada na CPU
varying float vLand;
varying float vFacing;
void main() {
  vLand = aLand;
  vec4 mv = modelViewMatrix * vec4(position * mix(0.6, 1.0, uProgress), 1.0);
  vFacing = clamp(normalize(normalMatrix * position).z * 0.5 + 0.5, 0.0, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = (2.0 + aLand * 2.6) * uPixelRatio * (9.0 / -mv.z);
}
`;
const GLOBO_FRAG = /* glsl */ `
uniform float uOpacity;
varying float vLand;
varying float vFacing;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d2 = dot(c, c);
  if (d2 > 0.25) discard;
  vec3 col = mix(vec3(0.05, 0.62, 0.45), vec3(0.72, 0.98, 0.45), vLand);
  gl_FragColor = vec4(col, (1.0 - d2 * 4.0) * uOpacity * mix(0.28, 1.0, vLand) * (0.3 + vFacing));
}
`;

const POEIRA_VERT = /* glsl */ `
uniform float uTime;
uniform float uPixelRatio;
attribute float aSeed;
varying float vTw;
void main() {
  vec3 p = position;
  p.y += mod(uTime * (0.05 + aSeed * 0.12) + aSeed * 20.0, 20.0) - 10.0;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  vTw = 0.5 + 0.5 * sin(uTime * (1.0 + aSeed * 2.0) + aSeed * 30.0);
  gl_PointSize = (1.0 + aSeed * 1.6) * uPixelRatio * (9.0 / -mv.z);
}
`;
const POEIRA_FRAG = /* glsl */ `
varying float vTw;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d2 = dot(c, c);
  if (d2 > 0.25) discard;
  gl_FragColor = vec4(0.75, 0.95, 0.55, (1.0 - d2 * 4.0) * (0.15 + vTw * 0.35));
}
`;

const aleatorio = (min: number, max: number) => min + Math.random() * (max - min);

// Ruído de valor 3D (CPU, executado uma vez na montagem).
function hash3(x: number, y: number, z: number) {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return s - Math.floor(s);
}
function ruidoDeValor(x: number, y: number, z: number) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const fx = x - xi, fy = y - yi, fz = z - zi;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz);
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const c = (dx: number, dy: number, dz: number) => hash3(xi + dx, yi + dy, zi + dz);
  return lerp(
    lerp(lerp(c(0, 0, 0), c(1, 0, 0), u), lerp(c(0, 1, 0), c(1, 1, 0), u), v),
    lerp(lerp(c(0, 0, 1), c(1, 0, 1), u), lerp(c(0, 1, 1), c(1, 1, 1), u), v),
    w,
  );
}
const suave = (e0: number, e1: number, x: number) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

export default function CenaAbertura({ onReady, onFail }: Props) {
  const refContainer = useRef<HTMLDivElement>(null);
  const cb = useRef({ onReady, onFail });
  cb.current = { onReady, onFail };

  useEffect(() => {
    const container = refContainer.current;
    if (!container) return;

    const ehPequena = window.innerWidth < 768;
    const aparelhoFraco = (navigator.hardwareConcurrency ?? 4) <= 4;
    const dprBase = aparelhoFraco ? 1 : Math.min(window.devicePixelRatio || 1, ehPequena ? 1.25 : 1.5);

    let renderizador: WebGLRenderer;
    try {
      renderizador = new WebGLRenderer({ antialias: false, alpha: true, powerPreference: 'high-performance', stencil: false, depth: false });
    } catch (erro) {
      if (import.meta.env.DEV) console.warn('[HeroScene] WebGL indisponível, usando fundo estático.', erro);
      cb.current.onFail?.();
      return;
    }
    renderizador.setClearColor(0x000000, 0);
    const canvas = renderizador.domElement;
    canvas.setAttribute('aria-hidden', 'true');
    Object.assign(canvas.style, { width: '100%', height: '100%', display: 'block' });
    container.appendChild(canvas);

    let falhou = false;
    let rodando = false;

    const cena = new Scene();
    const camera = new PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(0, 0, 9.5);
    const mundo = new Group();
    cena.add(mundo);
    const grupoAnel = new Group();
    grupoAnel.rotation.set(-1.02, 0.18, 0.35);
    mundo.add(grupoAnel);

    // ---------- anel (pontos finos) + halo (poucos pontos grandes e tênues = "bloom" barato)
    const N = ehPequena ? 1500 : aparelhoFraco ? 3000 : 4500;
    const H = ehPequena ? 160 : 260;
    const criarAnel = (quantidade: number, halo: boolean) => {
      const dispersao = new Float32Array(quantidade * 3);
      const anel = new Float32Array(quantidade * 4);
      const meta = new Float32Array(quantidade * 3);
      for (let i = 0; i < quantidade; i++) {
        const r = aleatorio(4.5, 11), th = Math.random() * Math.PI * 2, ph = Math.acos(aleatorio(-1, 1));
        dispersao[i * 3] = r * Math.sin(ph) * Math.cos(th);
        dispersao[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th) * 0.7;
        dispersao[i * 3 + 2] = r * Math.cos(ph) * 0.6;
        anel[i * 4] = halo ? (i / quantidade) * Math.PI * 2 + aleatorio(-0.02, 0.02) : Math.random() * Math.PI * 2;
        anel[i * 4 + 1] = Math.random() * Math.PI * 2;
        anel[i * 4 + 2] = halo ? aleatorio(0, 0.35) : Math.pow(Math.random(), 0.7);
        anel[i * 4 + 3] = halo ? 0.12 : aleatorio(0.08, 0.2);
        meta[i * 3] = halo ? aleatorio(9, 13) : Math.random() < 0.07 ? aleatorio(2.2, 3.0) : aleatorio(0.85, 1.7);
        meta[i * 3 + 1] = halo ? 0.6 + Math.random() * 0.4 : Math.random();
        meta[i * 3 + 2] = Math.random();
      }
      const geo = new BufferGeometry();
      geo.setAttribute('position', new BufferAttribute(new Float32Array(quantidade * 3), 3));
      geo.setAttribute('aScatter', new BufferAttribute(dispersao, 3));
      geo.setAttribute('aRing', new BufferAttribute(anel, 4));
      geo.setAttribute('aMeta', new BufferAttribute(meta, 3));
      return geo;
    };
    const criarMaterialAnel = (tamanho: number, multAlfa: number) => new ShaderMaterial({
      vertexShader: ANEL_VERT, fragmentShader: ANEL_FRAG, transparent: true, depthWrite: false, depthTest: false, blending: AdditiveBlending,
      uniforms: {
        uTime: { value: 0 }, uProgress: { value: 0 }, uScroll: { value: 0 }, uPixelRatio: { value: dprBase },
        uSize: { value: tamanho }, uAlphaMul: { value: multAlfa }, uTextFade: { value: ehPequena ? 0.6 : 1 },
        uC1: { value: new Color('#059669') }, uC2: { value: new Color('#22c55e') }, uC3: { value: new Color('#bef264') },
      },
    });
    const geoAnel = criarAnel(N, false);
    // Celular: anel menor na tela = mais sobreposição aditiva → menos alfa por ponto (não estoura para branco).
    const matAnel = criarMaterialAnel(ehPequena ? 2.6 : 3.4, ehPequena ? 0.62 : 1);
    const pontosAnel = new Points(geoAnel, matAnel);
    pontosAnel.frustumCulled = false;
    grupoAnel.add(pontosAnel);
    const geoHalo = criarAnel(H, true);
    const alfaHalo = ehPequena ? 0.05 : 0.095;
    const matHalo = criarMaterialAnel(ehPequena ? 3.0 : 3.4, alfaHalo);
    const halo = new Points(geoHalo, matHalo);
    halo.frustumCulled = false;
    grupoAnel.add(halo);
    const matsAnel = [matAnel, matHalo];

    // ---------- planeta (esfera de Fibonacci + máscara de continentes pré-calculada)
    const G = ehPequena || aparelhoFraco ? 900 : 1500;
    const gPos = new Float32Array(G * 3);
    const gTerra = new Float32Array(G);
    const aureo = Math.PI * (3 - Math.sqrt(5));
    const GR = 1.45;
    for (let i = 0; i < G; i++) {
      const y = 1 - (i / (G - 1)) * 2, rr = Math.sqrt(1 - y * y), th = aureo * i;
      const x = Math.cos(th) * rr * GR, yy = y * GR, z = Math.sin(th) * rr * GR;
      gPos[i * 3] = x; gPos[i * 3 + 1] = yy; gPos[i * 3 + 2] = z;
      const n = ruidoDeValor(x * 1.6 + 3, yy * 1.6 + 3, z * 1.6 + 3) * 0.65 + ruidoDeValor(x * 3.4, yy * 3.4, z * 3.4) * 0.35;
      gTerra[i] = suave(0.48, 0.62, n);
    }
    const geoGlobo = new BufferGeometry();
    geoGlobo.setAttribute('position', new BufferAttribute(gPos, 3));
    geoGlobo.setAttribute('aLand', new BufferAttribute(gTerra, 1));
    const matGlobo = new ShaderMaterial({
      vertexShader: GLOBO_VERT, fragmentShader: GLOBO_FRAG, transparent: true, depthWrite: false, depthTest: false, blending: AdditiveBlending,
      uniforms: { uProgress: { value: 0 }, uPixelRatio: { value: dprBase }, uOpacity: { value: 0 } },
    });
    const globo = new Points(geoGlobo, matGlobo);
    globo.rotation.z = 0.35;
    mundo.add(globo);

    // ---------- poeira
    const D = ehPequena ? 120 : 250;
    const dPos = new Float32Array(D * 3);
    const dSeed = new Float32Array(D);
    for (let i = 0; i < D; i++) {
      dPos[i * 3] = aleatorio(-14, 14); dPos[i * 3 + 1] = aleatorio(-10, 10); dPos[i * 3 + 2] = aleatorio(-8, 3);
      dSeed[i] = Math.random();
    }
    const geoPoeira = new BufferGeometry();
    geoPoeira.setAttribute('position', new BufferAttribute(dPos, 3));
    geoPoeira.setAttribute('aSeed', new BufferAttribute(dSeed, 1));
    const matPoeira = new ShaderMaterial({
      vertexShader: POEIRA_VERT, fragmentShader: POEIRA_FRAG, transparent: true, depthWrite: false, depthTest: false, blending: AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uPixelRatio: { value: dprBase } },
    });
    const poeira = new Points(geoPoeira, matPoeira);
    poeira.frustumCulled = false;
    cena.add(poeira);

    // ---------- estado de entrada (cacheado por eventos passivos; nada é lido do layout por quadro)
    let rolagemY = window.scrollY;
    let vh = window.innerHeight || 1;
    let ultimaInteracao = performance.now();
    const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
    const alcanceAbertura = () => vh * 1.4;
    let rolagemS = Math.min(1, rolagemY / alcanceAbertura());

    // ---------- qualidade / tamanho
    let qualidade = 0; // 0 cheio · 1 menos DPR e partículas · 2 + 30 fps fixo · 3 → fundo estático
    let dpr = dprBase;
    let layout = { x: 0, y: 0, scale: 1 };
    let primeiro = true;

    const renderizarUmaVez = () => {
      renderizador.render(cena, camera);
      if (primeiro) { primeiro = false; cb.current.onReady?.(); }
    };

    const aplicarTamanho = () => {
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      const pr = Math.min(dpr, 1600 / w); // buffer interno ≤ 1600 px de largura
      renderizador.setPixelRatio(pr);
      renderizador.setSize(w, h, false);
      for (const m of matsAnel) m.uniforms.uPixelRatio.value = pr;
      matGlobo.uniforms.uPixelRatio.value = pr;
      matPoeira.uniforms.uPixelRatio.value = pr;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      const proporcao = w / h;
      if (proporcao > 1.25) layout = { x: Math.min(3.0, 1.6 + (proporcao - 1.25) * 4), y: -0.15, scale: 0.85 };
      else if (proporcao > 0.85) layout = { x: 0.9, y: 0.2, scale: 0.9 };
      else layout = { x: 0, y: 1.75, scale: 0.52 };
      if (!rodando && !falhou && !primeiro) { atualizar(0); renderizarUmaVez(); }
    };

    let decorrido = 0;
    const iniciadoEm = performance.now();
    function atualizar(dtSec: number) {
      decorrido += dtSec;
      const intro = Math.min(1, (performance.now() - iniciadoEm) / 3200);
      const introSuavizada = 1 - Math.pow(1 - intro, 3);
      const alvo = Math.min(1, Math.max(0, rolagemY / alcanceAbertura()));
      rolagemS += (alvo - rolagemS) * 0.1;
      if (Math.abs(alvo - rolagemS) < 0.001) rolagemS = alvo;
      mouse.x += (mouse.tx - mouse.x) * 0.05;
      mouse.y += (mouse.ty - mouse.y) * 0.05;

      // halo some rápido ao rolar (senão vira "bokeh" sobre o conteúdo)
      matHalo.uniforms.uAlphaMul.value = alfaHalo * (1 - rolagemS) * (1 - rolagemS);
      for (const m of matsAnel) {
        m.uniforms.uTime.value = decorrido;
        m.uniforms.uProgress.value = introSuavizada;
        m.uniforms.uScroll.value = rolagemS;
      }
      matGlobo.uniforms.uProgress.value = introSuavizada;
      matGlobo.uniforms.uOpacity.value = introSuavizada * (1 - rolagemS * 0.6);
      matPoeira.uniforms.uTime.value = decorrido;

      mundo.position.x = layout.x * (1 - rolagemS * 0.85);
      mundo.position.y = layout.y + rolagemS * 0.6;
      mundo.scale.setScalar(layout.scale * (1 + rolagemS * 0.15));
      mundo.rotation.y = mouse.x * 0.22;
      mundo.rotation.x = mouse.y * 0.14;
      grupoAnel.rotation.z = 0.35 + decorrido * 0.04 + rolagemS * 0.9;
      globo.rotation.y = decorrido * 0.08;
      camera.position.z = 9.5 + rolagemS * 1.5;
      return alvo;
    }

    // ---------- loop (gsap.ticker) + governador
    const amostras: number[] = [];
    let ultimoPassoEm = iniciadoEm;
    let ultimoTique = 0;
    let acc = 0;

    const falhar = (motivo: string) => {
      if (falhou) return;
      falhou = true;
      if (import.meta.env.DEV) console.warn(`[HeroScene] ${motivo} → fundo estático`);
      parada();
      cb.current.onFail?.();
    };

    const definirQualidade = (q: number) => {
      qualidade = q;
      if (q >= 3) { falhar('desempenho insuficiente'); return; }
      const manter = q === 0 ? 1 : q === 1 ? 0.7 : 0.5;
      dpr = q === 0 ? dprBase : Math.max(0.75, dprBase * (q === 1 ? 0.8 : 0.66));
      geoAnel.setDrawRange(0, Math.floor(N * manter));
      geoGlobo.setDrawRange(0, Math.floor(G * manter));
      aplicarTamanho();
      if (import.meta.env.DEV) console.info(`[HeroScene] qualidade ${q}: dpr ${dpr.toFixed(2)}, ${Math.round(manter * 100)}% partículas`);
    };

    const tique = (_time: number, deltaMs: number) => {
      const agora = performance.now();
      const intervalo = ultimoTique ? agora - ultimoTique : 16.7;
      ultimoTique = agora;

      // Intervalo médio entre quadros do navegador (após aquecimento e com folga entre passos).
      if (agora - iniciadoEm > 4000 && agora - ultimoPassoEm > 2500) {
        amostras.push(intervalo);
        if (amostras.length >= 90) {
          const s = [...amostras].sort((a, b) => a - b);
          const mediana = s[Math.floor(s.length / 2)];
          amostras.length = 0;
          const limite = qualidade >= 2 ? 40 : 28; // em 30 fps fixo, só desiste abaixo de ~25 fps
          if (mediana > limite) { ultimoPassoEm = agora; definirQualidade(qualidade + 1); if (falhou) return; }
        }
      }

      acc += Math.min(deltaMs, 50) / 1000;
      const ocioso = agora - ultimaInteracao > 1500 && agora - iniciadoEm > 3400;
      if ((qualidade >= 2 || ocioso) && acc < 1 / 31) return; // 30 fps
      const alvo = atualizar(acc);
      acc = 0;
      renderizarUmaVez();
      // Hero fora de vista e cena assentada → loop parado (retoma no scroll de volta).
      if (alvo >= 1 && rolagemS >= 1) parada();
    };

    function iniciar() {
      if (rodando || falhou || document.hidden) return;
      rodando = true;
      ultimoTique = 0;
      acc = 0;
      amostras.length = 0;
      gsap.ticker.add(tique);
    }
    function parada() {
      if (!rodando) return;
      rodando = false;
      gsap.ticker.remove(tique);
    }

    const aoMoverPonteiro = (e: PointerEvent) => {
      mouse.tx = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.ty = (e.clientY / window.innerHeight) * 2 - 1;
      ultimaInteracao = performance.now();
      if (rolagemY < alcanceAbertura()) iniciar();
    };
    const aoRolar = () => {
      rolagemY = window.scrollY;
      ultimaInteracao = performance.now();
      if (rolagemY < alcanceAbertura() || rolagemS < 1) iniciar();
    };
    const aoRedimensionar = () => { vh = window.innerHeight || 1; };
    const aoMudarVisibilidade = () => { if (document.hidden) parada(); else if (rolagemY < alcanceAbertura()) iniciar(); };
    const aoPerderContexto = (e: Event) => { e.preventDefault(); falhar('contexto WebGL perdido'); };
    window.addEventListener('pointermove', aoMoverPonteiro, { passive: true });
    window.addEventListener('scroll', aoRolar, { passive: true });
    window.addEventListener('resize', aoRedimensionar, { passive: true });
    document.addEventListener('visibilitychange', aoMudarVisibilidade);
    canvas.addEventListener('webglcontextlost', aoPerderContexto);

    aplicarTamanho();
    const ro = new ResizeObserver(() => aplicarTamanho());
    ro.observe(container);
    atualizar(0);
    renderizarUmaVez();
    iniciar();

    return () => {
      parada();
      ro.disconnect();
      window.removeEventListener('pointermove', aoMoverPonteiro);
      window.removeEventListener('scroll', aoRolar);
      window.removeEventListener('resize', aoRedimensionar);
      document.removeEventListener('visibilitychange', aoMudarVisibilidade);
      canvas.removeEventListener('webglcontextlost', aoPerderContexto);
      geoAnel.dispose(); matAnel.dispose();
      geoHalo.dispose(); matHalo.dispose();
      geoGlobo.dispose(); matGlobo.dispose();
      geoPoeira.dispose(); matPoeira.dispose();
      renderizador.dispose();
      renderizador.forceContextLoss();
      canvas.remove();
    };
  }, []);

  return <div ref={refContainer} className="absolute inset-0" />;
}
