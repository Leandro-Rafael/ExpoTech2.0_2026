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

const RING_VERT = /* glsl */ `
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

const RING_FRAG = /* glsl */ `
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

const GLOBE_VERT = /* glsl */ `
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
const GLOBE_FRAG = /* glsl */ `
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

const DUST_VERT = /* glsl */ `
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
const DUST_FRAG = /* glsl */ `
varying float vTw;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d2 = dot(c, c);
  if (d2 > 0.25) discard;
  gl_FragColor = vec4(0.75, 0.95, 0.55, (1.0 - d2 * 4.0) * (0.15 + vTw * 0.35));
}
`;

const rand = (min: number, max: number) => min + Math.random() * (max - min);

// Ruído de valor 3D (CPU, executado uma vez na montagem).
function hash3(x: number, y: number, z: number) {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return s - Math.floor(s);
}
function valueNoise(x: number, y: number, z: number) {
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
const smooth = (e0: number, e1: number, x: number) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

export default function HeroScene({ onReady, onFail }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const cb = useRef({ onReady, onFail });
  cb.current = { onReady, onFail };

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const isSmall = window.innerWidth < 768;
    const lowEnd = (navigator.hardwareConcurrency ?? 4) <= 4;
    const baseDpr = lowEnd ? 1 : Math.min(window.devicePixelRatio || 1, isSmall ? 1.25 : 1.5);

    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({ antialias: false, alpha: true, powerPreference: 'high-performance', stencil: false, depth: false });
    } catch (err) {
      if (import.meta.env.DEV) console.warn('[HeroScene] WebGL indisponível, usando fundo estático.', err);
      cb.current.onFail?.();
      return;
    }
    renderer.setClearColor(0x000000, 0);
    const canvas = renderer.domElement;
    canvas.setAttribute('aria-hidden', 'true');
    Object.assign(canvas.style, { width: '100%', height: '100%', display: 'block' });
    host.appendChild(canvas);

    let failed = false;
    let running = false;

    const scene = new Scene();
    const camera = new PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(0, 0, 9.5);
    const world = new Group();
    scene.add(world);
    const ringGroup = new Group();
    ringGroup.rotation.set(-1.02, 0.18, 0.35);
    world.add(ringGroup);

    // ---------- anel (pontos finos) + halo (poucos pontos grandes e tênues = "bloom" barato)
    const N = isSmall ? 1500 : lowEnd ? 3000 : 4500;
    const H = isSmall ? 160 : 260;
    const buildRing = (count: number, halo: boolean) => {
      const scatter = new Float32Array(count * 3);
      const ring = new Float32Array(count * 4);
      const meta = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        const r = rand(4.5, 11), th = Math.random() * Math.PI * 2, ph = Math.acos(rand(-1, 1));
        scatter[i * 3] = r * Math.sin(ph) * Math.cos(th);
        scatter[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th) * 0.7;
        scatter[i * 3 + 2] = r * Math.cos(ph) * 0.6;
        ring[i * 4] = halo ? (i / count) * Math.PI * 2 + rand(-0.02, 0.02) : Math.random() * Math.PI * 2;
        ring[i * 4 + 1] = Math.random() * Math.PI * 2;
        ring[i * 4 + 2] = halo ? rand(0, 0.35) : Math.pow(Math.random(), 0.7);
        ring[i * 4 + 3] = halo ? 0.12 : rand(0.08, 0.2);
        meta[i * 3] = halo ? rand(9, 13) : Math.random() < 0.07 ? rand(2.2, 3.0) : rand(0.85, 1.7);
        meta[i * 3 + 1] = halo ? 0.6 + Math.random() * 0.4 : Math.random();
        meta[i * 3 + 2] = Math.random();
      }
      const geo = new BufferGeometry();
      geo.setAttribute('position', new BufferAttribute(new Float32Array(count * 3), 3));
      geo.setAttribute('aScatter', new BufferAttribute(scatter, 3));
      geo.setAttribute('aRing', new BufferAttribute(ring, 4));
      geo.setAttribute('aMeta', new BufferAttribute(meta, 3));
      return geo;
    };
    const makeRingMat = (size: number, alphaMul: number) => new ShaderMaterial({
      vertexShader: RING_VERT, fragmentShader: RING_FRAG, transparent: true, depthWrite: false, depthTest: false, blending: AdditiveBlending,
      uniforms: {
        uTime: { value: 0 }, uProgress: { value: 0 }, uScroll: { value: 0 }, uPixelRatio: { value: baseDpr },
        uSize: { value: size }, uAlphaMul: { value: alphaMul }, uTextFade: { value: isSmall ? 0.6 : 1 },
        uC1: { value: new Color('#059669') }, uC2: { value: new Color('#22c55e') }, uC3: { value: new Color('#bef264') },
      },
    });
    const ringGeo = buildRing(N, false);
    // Celular: anel menor na tela = mais sobreposição aditiva → menos alfa por ponto (não estoura para branco).
    const ringMat = makeRingMat(isSmall ? 2.6 : 3.4, isSmall ? 0.62 : 1);
    const ringPoints = new Points(ringGeo, ringMat);
    ringPoints.frustumCulled = false;
    ringGroup.add(ringPoints);
    const haloGeo = buildRing(H, true);
    const haloAlpha = isSmall ? 0.05 : 0.095;
    const haloMat = makeRingMat(isSmall ? 3.0 : 3.4, haloAlpha);
    const halo = new Points(haloGeo, haloMat);
    halo.frustumCulled = false;
    ringGroup.add(halo);
    const ringMats = [ringMat, haloMat];

    // ---------- planeta (esfera de Fibonacci + máscara de continentes pré-calculada)
    const G = isSmall || lowEnd ? 900 : 1500;
    const gPos = new Float32Array(G * 3);
    const gLand = new Float32Array(G);
    const golden = Math.PI * (3 - Math.sqrt(5));
    const GR = 1.45;
    for (let i = 0; i < G; i++) {
      const y = 1 - (i / (G - 1)) * 2, rr = Math.sqrt(1 - y * y), th = golden * i;
      const x = Math.cos(th) * rr * GR, yy = y * GR, z = Math.sin(th) * rr * GR;
      gPos[i * 3] = x; gPos[i * 3 + 1] = yy; gPos[i * 3 + 2] = z;
      const n = valueNoise(x * 1.6 + 3, yy * 1.6 + 3, z * 1.6 + 3) * 0.65 + valueNoise(x * 3.4, yy * 3.4, z * 3.4) * 0.35;
      gLand[i] = smooth(0.48, 0.62, n);
    }
    const globeGeo = new BufferGeometry();
    globeGeo.setAttribute('position', new BufferAttribute(gPos, 3));
    globeGeo.setAttribute('aLand', new BufferAttribute(gLand, 1));
    const globeMat = new ShaderMaterial({
      vertexShader: GLOBE_VERT, fragmentShader: GLOBE_FRAG, transparent: true, depthWrite: false, depthTest: false, blending: AdditiveBlending,
      uniforms: { uProgress: { value: 0 }, uPixelRatio: { value: baseDpr }, uOpacity: { value: 0 } },
    });
    const globe = new Points(globeGeo, globeMat);
    globe.rotation.z = 0.35;
    world.add(globe);

    // ---------- poeira
    const D = isSmall ? 120 : 250;
    const dPos = new Float32Array(D * 3);
    const dSeed = new Float32Array(D);
    for (let i = 0; i < D; i++) {
      dPos[i * 3] = rand(-14, 14); dPos[i * 3 + 1] = rand(-10, 10); dPos[i * 3 + 2] = rand(-8, 3);
      dSeed[i] = Math.random();
    }
    const dustGeo = new BufferGeometry();
    dustGeo.setAttribute('position', new BufferAttribute(dPos, 3));
    dustGeo.setAttribute('aSeed', new BufferAttribute(dSeed, 1));
    const dustMat = new ShaderMaterial({
      vertexShader: DUST_VERT, fragmentShader: DUST_FRAG, transparent: true, depthWrite: false, depthTest: false, blending: AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uPixelRatio: { value: baseDpr } },
    });
    const dust = new Points(dustGeo, dustMat);
    dust.frustumCulled = false;
    scene.add(dust);

    // ---------- estado de entrada (cacheado por eventos passivos; nada é lido do layout por quadro)
    let scrollY = window.scrollY;
    let vh = window.innerHeight || 1;
    let lastInput = performance.now();
    const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
    const heroRange = () => vh * 1.4;
    let scrollS = Math.min(1, scrollY / heroRange());

    // ---------- qualidade / tamanho
    let quality = 0; // 0 cheio · 1 menos DPR e partículas · 2 + 30 fps fixo · 3 → fundo estático
    let dpr = baseDpr;
    let layout = { x: 0, y: 0, scale: 1 };
    let first = true;

    const renderOnce = () => {
      renderer.render(scene, camera);
      if (first) { first = false; cb.current.onReady?.(); }
    };

    const applySize = () => {
      const w = host.clientWidth || window.innerWidth;
      const h = host.clientHeight || window.innerHeight;
      const pr = Math.min(dpr, 1600 / w); // buffer interno ≤ 1600 px de largura
      renderer.setPixelRatio(pr);
      renderer.setSize(w, h, false);
      for (const m of ringMats) m.uniforms.uPixelRatio.value = pr;
      globeMat.uniforms.uPixelRatio.value = pr;
      dustMat.uniforms.uPixelRatio.value = pr;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      const aspect = w / h;
      if (aspect > 1.25) layout = { x: Math.min(3.0, 1.6 + (aspect - 1.25) * 4), y: -0.15, scale: 0.85 };
      else if (aspect > 0.85) layout = { x: 0.9, y: 0.2, scale: 0.9 };
      else layout = { x: 0, y: 1.75, scale: 0.52 };
      if (!running && !failed && !first) { update(0); renderOnce(); }
    };

    let elapsed = 0;
    const startedAt = performance.now();
    function update(dtSec: number) {
      elapsed += dtSec;
      const intro = Math.min(1, (performance.now() - startedAt) / 3200);
      const introEased = 1 - Math.pow(1 - intro, 3);
      const target = Math.min(1, Math.max(0, scrollY / heroRange()));
      scrollS += (target - scrollS) * 0.1;
      if (Math.abs(target - scrollS) < 0.001) scrollS = target;
      mouse.x += (mouse.tx - mouse.x) * 0.05;
      mouse.y += (mouse.ty - mouse.y) * 0.05;

      // halo some rápido ao rolar (senão vira "bokeh" sobre o conteúdo)
      haloMat.uniforms.uAlphaMul.value = haloAlpha * (1 - scrollS) * (1 - scrollS);
      for (const m of ringMats) {
        m.uniforms.uTime.value = elapsed;
        m.uniforms.uProgress.value = introEased;
        m.uniforms.uScroll.value = scrollS;
      }
      globeMat.uniforms.uProgress.value = introEased;
      globeMat.uniforms.uOpacity.value = introEased * (1 - scrollS * 0.6);
      dustMat.uniforms.uTime.value = elapsed;

      world.position.x = layout.x * (1 - scrollS * 0.85);
      world.position.y = layout.y + scrollS * 0.6;
      world.scale.setScalar(layout.scale * (1 + scrollS * 0.15));
      world.rotation.y = mouse.x * 0.22;
      world.rotation.x = mouse.y * 0.14;
      ringGroup.rotation.z = 0.35 + elapsed * 0.04 + scrollS * 0.9;
      globe.rotation.y = elapsed * 0.08;
      camera.position.z = 9.5 + scrollS * 1.5;
      return target;
    }

    // ---------- loop (gsap.ticker) + governador
    const samples: number[] = [];
    let lastStepAt = startedAt;
    let lastTick = 0;
    let acc = 0;

    const fail = (why: string) => {
      if (failed) return;
      failed = true;
      if (import.meta.env.DEV) console.warn(`[HeroScene] ${why} → fundo estático`);
      stop();
      cb.current.onFail?.();
    };

    const setQuality = (q: number) => {
      quality = q;
      if (q >= 3) { fail('desempenho insuficiente'); return; }
      const keep = q === 0 ? 1 : q === 1 ? 0.7 : 0.5;
      dpr = q === 0 ? baseDpr : Math.max(0.75, baseDpr * (q === 1 ? 0.8 : 0.66));
      ringGeo.setDrawRange(0, Math.floor(N * keep));
      globeGeo.setDrawRange(0, Math.floor(G * keep));
      applySize();
      if (import.meta.env.DEV) console.info(`[HeroScene] qualidade ${q}: dpr ${dpr.toFixed(2)}, ${Math.round(keep * 100)}% partículas`);
    };

    const tick = (_time: number, deltaMs: number) => {
      const now = performance.now();
      const interval = lastTick ? now - lastTick : 16.7;
      lastTick = now;

      // Intervalo médio entre quadros do navegador (após aquecimento e com folga entre passos).
      if (now - startedAt > 4000 && now - lastStepAt > 2500) {
        samples.push(interval);
        if (samples.length >= 90) {
          const s = [...samples].sort((a, b) => a - b);
          const median = s[Math.floor(s.length / 2)];
          samples.length = 0;
          const limit = quality >= 2 ? 40 : 28; // em 30 fps fixo, só desiste abaixo de ~25 fps
          if (median > limit) { lastStepAt = now; setQuality(quality + 1); if (failed) return; }
        }
      }

      acc += Math.min(deltaMs, 50) / 1000;
      const idle = now - lastInput > 1500 && now - startedAt > 3400;
      if ((quality >= 2 || idle) && acc < 1 / 31) return; // 30 fps
      const target = update(acc);
      acc = 0;
      renderOnce();
      // Hero fora de vista e cena assentada → loop parado (retoma no scroll de volta).
      if (target >= 1 && scrollS >= 1) stop();
    };

    function start() {
      if (running || failed || document.hidden) return;
      running = true;
      lastTick = 0;
      acc = 0;
      samples.length = 0;
      gsap.ticker.add(tick);
    }
    function stop() {
      if (!running) return;
      running = false;
      gsap.ticker.remove(tick);
    }

    const onPointer = (e: PointerEvent) => {
      mouse.tx = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.ty = (e.clientY / window.innerHeight) * 2 - 1;
      lastInput = performance.now();
      if (scrollY < heroRange()) start();
    };
    const onScroll = () => {
      scrollY = window.scrollY;
      lastInput = performance.now();
      if (scrollY < heroRange() || scrollS < 1) start();
    };
    const onResize = () => { vh = window.innerHeight || 1; };
    const onVisibility = () => { if (document.hidden) stop(); else if (scrollY < heroRange()) start(); };
    const onLost = (e: Event) => { e.preventDefault(); fail('contexto WebGL perdido'); };
    window.addEventListener('pointermove', onPointer, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize, { passive: true });
    document.addEventListener('visibilitychange', onVisibility);
    canvas.addEventListener('webglcontextlost', onLost);

    applySize();
    const ro = new ResizeObserver(() => applySize());
    ro.observe(host);
    update(0);
    renderOnce();
    start();

    return () => {
      stop();
      ro.disconnect();
      window.removeEventListener('pointermove', onPointer);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibility);
      canvas.removeEventListener('webglcontextlost', onLost);
      ringGeo.dispose(); ringMat.dispose();
      haloGeo.dispose(); haloMat.dispose();
      globeGeo.dispose(); globeMat.dispose();
      dustGeo.dispose(); dustMat.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    };
  }, []);

  return <div ref={hostRef} className="absolute inset-0" />;
}
