/** Mini-interfaces ilustrativas do "Como funciona" (visuais, sem dados reais). Um estilo de cartão só. */
import type { ReactNode } from 'react';
import { Camera, Check, MapPin } from 'lucide-react';
import { cn } from '@/lib/cn';

function Frame({ children, className, title, meta }: { children: ReactNode; className?: string; title: string; meta?: string }) {
  return (
    <div className={cn('surface w-full rounded-2xl', className)}>
      <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
        <span className="text-[13px] font-medium text-fg-soft">{title}</span>
        {meta && <span className="font-mono text-[11px] text-subtle tabular">{meta}</span>}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-t border-line py-3 first:border-t-0 first:pt-0">
      <span className="text-[13px] text-muted">{k}</span>
      <span className="font-mono text-[13px] text-fg tabular">{v}</span>
    </div>
  );
}

/**
 * "Foto" ilustrada de uma garrafa PET sobre a bancada (SVG inline, sem imagens externas).
 * `scanning` adiciona caixa de detecção, linha de varredura e o rótulo da IA.
 */
function BottlePhoto({ scanning = false }: { scanning?: boolean }) {
  return (
    <div className="relative aspect-[16/10] overflow-hidden rounded-xl border border-line bg-[#0d1210]">
      <svg viewBox="0 0 320 200" className="absolute inset-0 size-full" aria-hidden>
        <defs>
          <linearGradient id="bp-wall" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#1a221d" /><stop offset="1" stopColor="#111713" />
          </linearGradient>
          <linearGradient id="bp-table" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#202a24" /><stop offset="1" stopColor="#141b17" />
          </linearGradient>
          <linearGradient id="bp-body" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#9fd6ff" stopOpacity=".16" />
            <stop offset=".35" stopColor="#d8efff" stopOpacity=".38" />
            <stop offset=".6" stopColor="#9fd6ff" stopOpacity=".14" />
            <stop offset="1" stopColor="#7cc4f0" stopOpacity=".26" />
          </linearGradient>
          <radialGradient id="bp-light" cx=".3" cy=".1" r=".9">
            <stop offset="0" stopColor="#ffffff" stopOpacity=".07" /><stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="320" height="132" fill="url(#bp-wall)" />
        <rect y="132" width="320" height="68" fill="url(#bp-table)" />
        <rect width="320" height="200" fill="url(#bp-light)" />
        <line x1="0" y1="132" x2="320" y2="132" stroke="#ecefea" strokeOpacity=".06" />
        {/* sombra */}
        <ellipse cx="166" cy="168" rx="46" ry="6" fill="#000" opacity=".45" />
        {/* garrafa */}
        <g transform="translate(140 34)">
          <rect x="15" y="0" width="22" height="12" rx="3" fill="#2f7fd6" />
          <rect x="15" y="9" width="22" height="3" fill="#1f5fa8" />
          <path d="M17 12h18v10c0 6 15 12 15 26v76c0 6-4 10-10 10H12c-6 0-10-4-10-10V48c0-14 15-20 15-26z" fill="url(#bp-body)" stroke="#d8efff" strokeOpacity=".5" strokeWidth="1.2" />
          <rect x="2.6" y="66" width="46.8" height="30" fill="#e9efe9" opacity=".88" />
          <rect x="9" y="74" width="24" height="3" rx="1.5" fill="#2f7fd6" opacity=".8" />
          <rect x="9" y="81" width="34" height="2" rx="1" fill="#7d8680" opacity=".7" />
          <rect x="9" y="86" width="18" height="2" rx="1" fill="#7d8680" opacity=".7" />
          <path d="M10 104v24M42 104v24" stroke="#d8efff" strokeOpacity=".22" />
          <path d="M8 50c3-8 8-12 10-14" stroke="#ffffff" strokeOpacity=".55" strokeWidth="2" strokeLinecap="round" fill="none" />
          <path d="M7 104v18" stroke="#ffffff" strokeOpacity=".35" strokeWidth="2" strokeLinecap="round" />
        </g>
        {scanning && (
          <g fill="none" stroke="#34d399" strokeWidth="2" strokeLinecap="round">
            <path d="M124 26v-8h10M210 18h10v8M220 166v8h-10M134 174h-10v-8" />
            <rect x="124" y="18" width="96" height="156" rx="2" strokeOpacity=".22" strokeWidth="1" />
          </g>
        )}
      </svg>
      {scanning && (
        <>
          <div aria-hidden className="pointer-events-none absolute inset-x-[38%] top-[9%] h-px bg-brand-300 shadow-[0_0_8px_rgb(52_211_153/0.8)] [--scan-distance:150px] motion-safe:animate-[scan_2.6s_ease-in-out_infinite] max-sm:[--scan-distance:110px]" />
          <div className="absolute top-[9%] left-[70%] animate-fade-up rounded-md border border-line-strong bg-bg/90 px-2.5 py-1.5 [animation-delay:400ms]">
            <p className="font-mono text-[10px] text-subtle uppercase">Plástico · PET</p>
            <p className="font-mono text-[13px] text-fg tabular">96%</p>
          </div>
        </>
      )}
    </div>
  );
}

export function VisualRegister() {
  return (
    <Frame title="Novo descarte" meta="23/10 · 14:02">
      <div className="relative mb-5">
        <BottlePhoto />
        <span className="absolute bottom-2.5 left-2.5 inline-flex items-center gap-1.5 rounded-md bg-bg/85 px-2 py-1 font-mono text-[10.5px] text-fg-soft">
          <Camera className="size-3" aria-hidden />garrafa-pet.jpg · 1,2 MB
        </span>
      </div>
      <Row k="Quantidade" v="2,4 kg" />
      <Row k="Local" v={<span className="inline-flex items-center gap-1"><MapPin className="size-3.5 text-subtle" aria-hidden />Vila Mariana</span>} />
    </Frame>
  );
}

export function VisualAI() {
  return (
    <Frame title="Identificação por IA" meta="0,8 s">
      <div className="mb-5"><BottlePhoto scanning /></div>
      <div className="space-y-2.5">
        {[{ n: 'Plástico (PET)', p: 96, c: '#e5484d' }, { n: 'Papel', p: 3, c: '#3b82f6' }, { n: 'Vidro', p: 1, c: '#22c55e' }].map((r, i) => (
          <div key={r.n}>
            <div className="mb-1 flex justify-between text-[13px]">
              <span className={i === 0 ? 'text-fg' : 'text-muted'}>{r.n}</span>
              <span className="font-mono text-fg-soft tabular">{r.p}%</span>
            </div>
            <div className="h-1 rounded-full bg-white/[0.06]"><div className="h-full rounded-full opacity-80" style={{ width: `${r.p}%`, background: r.c }} /></div>
          </div>
        ))}
      </div>
      <p className="mt-4 text-[13px] text-muted">Lave e amasse a garrafa antes de descartar.</p>
    </Frame>
  );
}

export function VisualApproval() {
  const checks = ['Foto inédita (hash perceptual)', 'Quantidade dentro do limite', 'Localização consistente', 'Frequência normal de envios'];
  return (
    <Frame title="Validação antifraude" meta="risco 0,04">
      <ul>
        {checks.map((c) => (
          <li key={c} className="flex items-center gap-3 border-t border-line py-3 text-[14px] text-fg-soft first:border-t-0 first:pt-0">
            <Check className="size-4 text-brand-300" strokeWidth={2.5} aria-hidden />{c}
          </li>
        ))}
      </ul>
      <div className="mt-4 flex items-center justify-between rounded-xl border border-line bg-bg-deep/60 px-4 py-3">
        <span className="text-[14px] font-medium text-fg">Descarte aprovado</span>
        <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-brand-300 uppercase"><span className="size-1.5 rounded-full bg-brand-300" />aprovado</span>
      </div>
    </Frame>
  );
}

export function VisualPoints() {
  return (
    <Frame title="Pontos creditados" meta="nível Broto">
      <p className="font-mono text-6xl font-medium tracking-[-0.04em] text-fg tabular">+48<span className="ml-2 text-xl text-subtle">pts</span></p>
      <p className="mt-2 font-mono text-[13px] text-muted">2,4 kg × 20 pts/kg</p>
      <div className="mt-7">
        <div className="mb-2 flex justify-between text-[13px]"><span className="text-muted">Até o nível Árvore</span><span className="font-mono text-fg-soft tabular">152 pts</span></div>
        <div className="h-1 rounded-full bg-white/[0.06]"><div className="h-full w-[68%] rounded-full bg-brand-500" /></div>
      </div>
      <div className="mt-6 flex flex-wrap gap-2">
        {['Primeiro descarte', '10 kg de plástico'].map((b) => (
          <span key={b} className="rounded-md border border-line px-2.5 py-1 text-xs text-fg-soft">{b}</span>
        ))}
      </div>
    </Frame>
  );
}

export function VisualRoute() {
  const stops: [number, number][] = [[40, 150], [95, 92], [150, 128], [210, 70], [262, 112], [300, 48]];
  const d = stops.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' ');
  return (
    <Frame title="Rota otimizada" meta="−31% km">
      <svg viewBox="0 0 340 190" className="w-full rounded-xl border border-line bg-bg-deep/60" aria-hidden>
        <path d="M40 150 L150 128 L95 92 L262 112 L210 70 L300 48" stroke="rgb(236 239 234 / 0.18)" strokeWidth="1.5" strokeDasharray="3 5" fill="none" />
        <path d={d} stroke="#34d399" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        {stops.map(([x, y], i) => (
          <g key={i}>
            <circle cx={x} cy={y} r="8.5" fill="#0a0e0c" stroke={i === 0 ? '#ecefea' : '#34d399'} strokeWidth="1.5" />
            <text x={x} y={y + 3.2} textAnchor="middle" fontSize="8.5" fill="#ecefea" fontFamily="Geist Mono Variable, monospace">{i === 0 ? 'D' : i}</text>
          </g>
        ))}
      </svg>
      <div className="mt-4 grid grid-cols-3 divide-x divide-line text-center">
        {[['Paradas', '5'], ['Distância', '8,2 km'], ['Carga', '340 kg']].map(([k, v]) => (
          <div key={k}><p className="text-[12px] text-muted">{k}</p><p className="font-mono text-[15px] text-fg tabular">{v}</p></div>
        ))}
      </div>
    </Frame>
  );
}
