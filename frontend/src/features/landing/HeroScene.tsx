/**
 * Cena three.js da landing: milhares de partículas que saem do "caos" (resíduos
 * dispersos) e se organizam num anel de economia circular — o "0" do logo —
 * fluindo continuamente em volta de um planeta vivo de pontos.
 *
 * - Shaders próprios (GPU faz todo o movimento; CPU só atualiza uniforms).
 * - DPR limitado, pausa com aba oculta ou canvas fora da tela, dispose completo.
 * - Reage levemente ao mouse (parallax) e ao scroll (o anel se expande e dissolve).
 * - Se o WebGL falhar, chama onFail() e o pai mantém o fundo estático.
 */
import { useEffect, useRef } from 'react';
import {
  AdditiveBlending, BufferAttribute, BufferGeometry, Clock, Color, Group, PerspectiveCamera, Points, Scene,
  ShaderMaterial, WebGLRenderer,
} from 'three';

interface Props { onReady?: () => void; onFail?: () => void }

const RING_VERT = /* glsl */ `
uniform float uTime;
uniform float uProgress;
uniform float uScroll;
uniform float uPixelRatio;
uniform float uSize;
attribute vec3 aScatter;
attribute vec4 aRing;   // theta, phi, radius jitter, speed
attribute vec3 aMeta;   // size, delay, seed
varying float vGrad;
varying float vAlpha;
varying float vHead;

const float TAU = 6.2831853;
const float R = 2.55;
const float TUBE = 0.42;

void main() {
  float t = uTime;
  float speed = aRing.w;
  float theta = aRing.x + t * speed;
  float phi = aRing.y + t * speed * 2.3;
  float tube = TUBE * (0.25 + aRing.z * 0.75) * (1.0 + 0.18 * sin(theta * 3.0 + t * 0.7));
  vec3 ring = vec3((R + tube * cos(phi)) * cos(theta), (R + tube * cos(phi)) * sin(theta), tube * sin(phi) * 0.8);
  ring *= 1.0 + uScroll * 0.28;

  float delay = aMeta.y;
  float p = smoothstep(delay * 0.55, delay * 0.55 + 0.45, uProgress);

  float seed = aMeta.z;
  vec3 scatter = aScatter + vec3(sin(t * 0.21 + seed * 6.28), cos(t * 0.17 + seed * 3.1), sin(t * 0.13 + seed * 1.7)) * 0.35;
  vec3 pos = mix(scatter, ring, p);
  pos += normalize(aScatter + 0.001) * uScroll * uScroll * (0.6 + seed * 2.6);

  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;

  float ang = mod(theta, TAU);
  vGrad = ang / TAU;

  // "cometa" que percorre o anel — sensação de ciclo contínuo
  float head = mod(t * 0.55, TAU);
  float d = abs(ang - head);
  d = min(d, TAU - d);
  vHead = exp(-d * d * 3.0) * p;

  // fenda do logo (o anel quase fechado)
  float gapCenter = 1.05;
  float g = abs(ang - gapCenter);
  g = min(g, TAU - g);
  float gap = mix(1.0, smoothstep(0.06, 0.32, g), p);

  vAlpha = mix(0.28, 1.0, p) * gap * (1.0 - uScroll * 0.45);
  gl_PointSize = uSize * aMeta.x * (1.0 + vHead * 1.4) * uPixelRatio * (9.0 / -mv.z);
}
`;

const RING_FRAG = /* glsl */ `
uniform vec3 uC1;
uniform vec3 uC2;
uniform vec3 uC3;
uniform float uOpacity;
varying float vGrad;
varying float vAlpha;
varying float vHead;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  if (d > 0.5) discard;
  float a = smoothstep(0.5, 0.0, d);
  a *= a;
  // gradiente esmeralda → verde → lima ao longo do anel (como no logo)
  float g = vGrad;
  vec3 col = g < 0.55 ? mix(uC1, uC2, g / 0.55) : mix(uC2, uC3, (g - 0.55) / 0.45);
  col = mix(col, vec3(0.93, 1.0, 0.8), vHead * 0.55);
  gl_FragColor = vec4(col, a * vAlpha * uOpacity * (0.75 + vHead));
}
`;

const GLOBE_VERT = /* glsl */ `
uniform float uTime;
uniform float uProgress;
uniform float uPixelRatio;
attribute float aSeed;
varying float vLand;
varying float vFacing;

// value noise 3D barato
float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float noise(vec3 x) {
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
}

void main() {
  float n = noise(position * 1.6 + 3.0) * 0.65 + noise(position * 3.4) * 0.35;
  vLand = smoothstep(0.48, 0.62, n);
  float scale = mix(0.6, 1.0, smoothstep(0.0, 1.0, uProgress));
  vec3 pos = position * scale * (1.0 + vLand * 0.025 * sin(uTime * 1.5 + aSeed * 6.28));
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  vec3 nrm = normalize(normalMatrix * position);
  vFacing = clamp(dot(nrm, vec3(0.0, 0.0, 1.0)) * 0.5 + 0.5, 0.0, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = (1.6 + vLand * 2.2) * uPixelRatio * (9.0 / -mv.z);
}
`;

const GLOBE_FRAG = /* glsl */ `
uniform float uOpacity;
varying float vLand;
varying float vFacing;
void main() {
  float d = length(gl_PointCoord - 0.5);
  if (d > 0.5) discard;
  float a = smoothstep(0.5, 0.1, d);
  vec3 sea = vec3(0.02, 0.45, 0.32);
  vec3 land = vec3(0.55, 0.92, 0.45);
  vec3 col = mix(sea, land, vLand);
  gl_FragColor = vec4(col, a * uOpacity * mix(0.16, 0.85, vLand) * (0.25 + vFacing * 0.95));
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
  p.x += sin(uTime * 0.2 + aSeed * 12.0) * 0.3;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  vTw = 0.5 + 0.5 * sin(uTime * (1.0 + aSeed * 2.0) + aSeed * 30.0);
  gl_PointSize = (1.0 + aSeed * 1.8) * uPixelRatio * (9.0 / -mv.z);
}
`;
const DUST_FRAG = /* glsl */ `
uniform float uOpacity;
varying float vTw;
void main() {
  float d = length(gl_PointCoord - 0.5);
  if (d > 0.5) discard;
  gl_FragColor = vec4(0.75, 0.95, 0.55, smoothstep(0.5, 0.0, d) * (0.15 + vTw * 0.35) * uOpacity);
}
`;

function rand(min: number, max: number) { return min + Math.random() * (max - min); }

export default function HeroScene({ onReady, onFail }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const cb = useRef({ onReady, onFail });
  cb.current = { onReady, onFail };

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const isSmall = window.innerWidth < 768;
    const lowEnd = (navigator.hardwareConcurrency ?? 4) <= 4;
    const dpr = Math.min(window.devicePixelRatio || 1, isSmall ? 1.25 : lowEnd ? 1.25 : 1.75);

    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({ antialias: false, alpha: true, powerPreference: 'high-performance', stencil: false, depth: false });
    } catch {
      cb.current.onFail?.();
      return;
    }
    renderer.setPixelRatio(dpr);
    renderer.setClearColor(0x000000, 0);
    const canvas = renderer.domElement;
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    host.appendChild(canvas);

    const onLost = (e: Event) => { e.preventDefault(); cb.current.onFail?.(); };
    canvas.addEventListener('webglcontextlost', onLost);

    const scene = new Scene();
    const camera = new PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(0, 0, 9.5);

    const world = new Group();
    scene.add(world);
    const ringGroup = new Group();
    ringGroup.rotation.set(-1.02, 0.18, 0.35);
    world.add(ringGroup);

    // ---------- anel de partículas
    const N = isSmall ? 3200 : lowEnd ? 5200 : 8000;
    const scatter = new Float32Array(N * 3);
    const ring = new Float32Array(N * 4);
    const meta = new Float32Array(N * 3);
    const zeros = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const r = rand(4.5, 11);
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(rand(-1, 1));
      scatter[i * 3] = r * Math.sin(ph) * Math.cos(th);
      scatter[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th) * 0.7;
      scatter[i * 3 + 2] = r * Math.cos(ph) * 0.6;
      ring[i * 4] = Math.random() * Math.PI * 2;
      ring[i * 4 + 1] = Math.random() * Math.PI * 2;
      ring[i * 4 + 2] = Math.pow(Math.random(), 0.7);
      ring[i * 4 + 3] = rand(0.08, 0.2);
      meta[i * 3] = Math.random() < 0.06 ? rand(2.2, 3.2) : rand(0.7, 1.6);
      meta[i * 3 + 1] = Math.random();
      meta[i * 3 + 2] = Math.random();
    }
    const ringGeo = new BufferGeometry();
    ringGeo.setAttribute('position', new BufferAttribute(zeros, 3));
    ringGeo.setAttribute('aScatter', new BufferAttribute(scatter, 3));
    ringGeo.setAttribute('aRing', new BufferAttribute(ring, 4));
    ringGeo.setAttribute('aMeta', new BufferAttribute(meta, 3));
    const ringMat = new ShaderMaterial({
      vertexShader: RING_VERT,
      fragmentShader: RING_FRAG,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: AdditiveBlending,
      uniforms: {
        uTime: { value: 0 }, uProgress: { value: 0 }, uScroll: { value: 0 }, uPixelRatio: { value: dpr },
        uSize: { value: isSmall ? 2.6 : 2.3 }, uOpacity: { value: 1 },
        uC1: { value: new Color('#059669') }, uC2: { value: new Color('#22c55e') }, uC3: { value: new Color('#bef264') },
      },
    });
    const ringPoints = new Points(ringGeo, ringMat);
    ringPoints.frustumCulled = false;
    ringGroup.add(ringPoints);

    // ---------- planeta de pontos (esfera de Fibonacci)
    const G = isSmall ? 1400 : 2600;
    const gPos = new Float32Array(G * 3);
    const gSeed = new Float32Array(G);
    const golden = Math.PI * (3 - Math.sqrt(5));
    const GR = 1.45;
    for (let i = 0; i < G; i++) {
      const y = 1 - (i / (G - 1)) * 2;
      const rr = Math.sqrt(1 - y * y);
      const th = golden * i;
      gPos[i * 3] = Math.cos(th) * rr * GR;
      gPos[i * 3 + 1] = y * GR;
      gPos[i * 3 + 2] = Math.sin(th) * rr * GR;
      gSeed[i] = Math.random();
    }
    const globeGeo = new BufferGeometry();
    globeGeo.setAttribute('position', new BufferAttribute(gPos, 3));
    globeGeo.setAttribute('aSeed', new BufferAttribute(gSeed, 1));
    const globeMat = new ShaderMaterial({
      vertexShader: GLOBE_VERT, fragmentShader: GLOBE_FRAG, transparent: true, depthWrite: false, depthTest: false,
      blending: AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uProgress: { value: 0 }, uPixelRatio: { value: dpr }, uOpacity: { value: 0 } },
    });
    const globe = new Points(globeGeo, globeMat);
    globe.rotation.z = 0.35;
    world.add(globe);

    // ---------- poeira ambiente
    const D = isSmall ? 260 : 600;
    const dPos = new Float32Array(D * 3);
    const dSeed = new Float32Array(D);
    for (let i = 0; i < D; i++) {
      dPos[i * 3] = rand(-14, 14);
      dPos[i * 3 + 1] = rand(-10, 10);
      dPos[i * 3 + 2] = rand(-8, 3);
      dSeed[i] = Math.random();
    }
    const dustGeo = new BufferGeometry();
    dustGeo.setAttribute('position', new BufferAttribute(dPos, 3));
    dustGeo.setAttribute('aSeed', new BufferAttribute(dSeed, 1));
    const dustMat = new ShaderMaterial({
      vertexShader: DUST_VERT, fragmentShader: DUST_FRAG, transparent: true, depthWrite: false, depthTest: false,
      blending: AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uPixelRatio: { value: dpr }, uOpacity: { value: 1 } },
    });
    const dust = new Points(dustGeo, dustMat);
    dust.frustumCulled = false;
    scene.add(dust);

    // ---------- layout responsivo
    let layout = { x: 0, y: 0, scale: 1 };
    const resize = () => {
      const w = host.clientWidth || window.innerWidth;
      const h = host.clientHeight || window.innerHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      const aspect = w / h;
      if (aspect > 1.25) layout = { x: Math.min(3.1, 1.2 + (aspect - 1.25) * 2.4), y: -0.1, scale: 1 };
      else if (aspect > 0.85) layout = { x: 0.9, y: 0.2, scale: 0.9 };
      else layout = { x: 0, y: 1.55, scale: 0.68 };
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(host);

    // ---------- interação
    const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
    const onPointer = (e: PointerEvent) => {
      mouse.tx = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.ty = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener('pointermove', onPointer, { passive: true });

    let visible = true;
    const io = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }, { threshold: 0 });
    io.observe(host);

    // ---------- loop
    const clock = new Clock();
    let elapsed = 0;
    let raf = 0;
    let first = true;
    let scrollS = 0;
    const startedAt = performance.now();

    const frame = () => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(clock.getDelta(), 0.05);
      if (!visible || document.hidden) return;
      elapsed += dt;

      const intro = Math.min(1, (performance.now() - startedAt) / 3200);
      const introEased = 1 - Math.pow(1 - intro, 3);
      const vh = window.innerHeight || 1;
      const targetScroll = Math.min(1, Math.max(0, window.scrollY / (vh * 1.4)));
      scrollS += (targetScroll - scrollS) * 0.08;

      mouse.x += (mouse.tx - mouse.x) * 0.04;
      mouse.y += (mouse.ty - mouse.y) * 0.04;

      ringMat.uniforms.uTime.value = elapsed;
      ringMat.uniforms.uProgress.value = introEased;
      ringMat.uniforms.uScroll.value = scrollS;
      globeMat.uniforms.uTime.value = elapsed;
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

      renderer.render(scene, camera);
      if (first) { first = false; cb.current.onReady?.(); }
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      window.removeEventListener('pointermove', onPointer);
      canvas.removeEventListener('webglcontextlost', onLost);
      ringGeo.dispose(); ringMat.dispose();
      globeGeo.dispose(); globeMat.dispose();
      dustGeo.dispose(); dustMat.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    };
  }, []);

  return <div ref={hostRef} className="absolute inset-0" />;
}
