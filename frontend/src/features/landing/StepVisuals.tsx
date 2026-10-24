/** Mini-interfaces ilustrativas usadas no "Como funciona" (apenas visuais, sem dados reais). */
import type { ReactNode } from 'react';
import { BadgeCheck, Camera, Check, Fingerprint, MapPin, Medal, Recycle, ScanLine, ShieldCheck, Sparkles, Truck } from 'lucide-react';
import { cn } from '@/lib/cn';

function Frame({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('glass-strong relative w-full overflow-hidden rounded-3xl p-5 sm:p-6', className)}>
      <div aria-hidden className="pointer-events-none absolute -top-32 -right-32 size-80 bg-[radial-gradient(closest-side,rgb(16_185_129/0.16),transparent)]" />
      {children}
    </div>
  );
}

export function VisualRegister() {
  return (
    <Frame>
      <div className="mb-4 flex items-center justify-between text-xs text-muted"><span>Novo descarte</span><span className="tabular">23/10 · 14:02</span></div>
      <div className="relative mb-4 aspect-[16/10] overflow-hidden rounded-2xl border border-line bg-[radial-gradient(circle_at_40%_40%,rgb(52_211_153/0.25),transparent_60%),linear-gradient(135deg,#0b1f15,#04140d)]">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex size-24 items-center justify-center rounded-3xl border border-brand-300/30 bg-brand-500/10 text-brand-300"><Camera className="size-10" /></div>
        </div>
        <span className="absolute bottom-3 left-3 rounded-full bg-black/60 px-2.5 py-1 text-[11px] text-fg-soft">garrafa-pet.jpg · 1,2 MB</span>
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-xl border border-line bg-bg-deep/50 p-3"><p className="text-[11px] text-muted">Quantidade</p><p className="font-display text-lg font-semibold tabular">2,4 kg</p></div>
        <div className="rounded-xl border border-line bg-bg-deep/50 p-3"><p className="text-[11px] text-muted">Local</p><p className="flex items-center gap-1 font-medium text-fg-soft"><MapPin className="size-3.5 text-brand-300" />Vila Mariana</p></div>
      </div>
    </Frame>
  );
}

export function VisualAI() {
  return (
    <Frame>
      <div className="relative mb-4 aspect-[16/10] overflow-hidden rounded-2xl border border-line bg-[linear-gradient(135deg,#0b1f15,#04140d)]">
        <div className="absolute inset-6 rounded-xl border-2 border-dashed border-lime-300/50" />
        <div className="absolute inset-x-6 top-1/2 h-0.5 bg-gradient-to-r from-transparent via-lime-300 to-transparent shadow-[0_0_20px_#bef264] motion-safe:animate-[float_2.4s_ease-in-out_infinite]" />
        <div className="absolute top-4 left-4 inline-flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-[11px] text-lime-200"><ScanLine className="size-3.5" />Analisando imagem…</div>
      </div>
      <div className="flex items-center gap-3 rounded-2xl border border-brand-300/30 bg-brand-500/10 p-3.5">
        <span className="inline-flex size-11 items-center justify-center rounded-xl bg-[#ef4444]/15 text-[#f87171]"><Recycle className="size-5" /></span>
        <div className="flex-1">
          <p className="text-[11px] text-muted">Categoria sugerida</p>
          <p className="font-display font-semibold">Plástico · PET</p>
        </div>
        <div className="text-right"><p className="font-display text-xl font-semibold text-lime-300 tabular">96%</p><p className="text-[10px] text-muted">confiança</p></div>
      </div>
      <p className="mt-3 flex items-center gap-1.5 text-xs text-muted"><Sparkles className="size-3.5 text-lime-300" />Lave e amasse a garrafa antes de descartar.</p>
    </Frame>
  );
}

export function VisualApproval() {
  const checks = ['Foto inédita (hash perceptual)', 'Quantidade dentro do limite', 'Localização consistente', 'Frequência normal de envios'];
  return (
    <Frame>
      <div className="mb-4 flex items-center gap-2 text-sm font-medium"><ShieldCheck className="size-4 text-brand-300" />Validação antifraude</div>
      <ul className="space-y-2">
        {checks.map((c) => (
          <li key={c} className="flex items-center gap-3 rounded-xl border border-line bg-bg-deep/50 px-3 py-2.5 text-sm text-fg-soft">
            <span className="inline-flex size-5 items-center justify-center rounded-full bg-brand-400/20 text-brand-300"><Check className="size-3" strokeWidth={3} /></span>{c}
          </li>
        ))}
      </ul>
      <div className="mt-4 flex items-center justify-between rounded-2xl border border-success/30 bg-success/10 px-4 py-3">
        <span className="flex items-center gap-2 text-sm font-medium text-success"><BadgeCheck className="size-4" />Descarte aprovado</span>
        <span className="flex items-center gap-1 text-xs text-muted"><Fingerprint className="size-3.5" />risco 0,04</span>
      </div>
    </Frame>
  );
}

export function VisualPoints() {
  return (
    <Frame className="text-center">
      <p className="text-xs text-muted">Pontos creditados</p>
      <p className="mt-1 font-display text-6xl font-bold text-gradient tabular">+48</p>
      <p className="mt-1 text-sm text-fg-soft">2,4 kg × 20 pts/kg</p>
      <div className="mx-auto mt-6 max-w-xs text-left">
        <div className="mb-1.5 flex justify-between text-xs"><span className="text-muted">Nível Broto</span><span className="text-lime-200">Árvore em 152 pts</span></div>
        <div className="h-2 overflow-hidden rounded-full bg-white/8"><div className="h-full w-[68%] rounded-full bg-brand-gradient" /></div>
      </div>
      <div className="mt-6 flex justify-center gap-2">
        {[{ i: Medal, t: 'Primeiro descarte' }, { i: Recycle, t: '10 kg de plástico' }].map((b) => (
          <span key={b.t} className="inline-flex items-center gap-1.5 rounded-full border border-lime-300/25 bg-lime-300/10 px-3 py-1 text-xs text-lime-200"><b.i className="size-3.5" />{b.t}</span>
        ))}
      </div>
    </Frame>
  );
}

export function VisualRoute() {
  const stops: [number, number][] = [[40, 150], [95, 92], [150, 128], [210, 70], [262, 112], [300, 48]];
  const d = stops.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' ');
  return (
    <Frame>
      <div className="mb-3 flex items-center justify-between text-sm"><span className="flex items-center gap-2 font-medium"><Truck className="size-4 text-brand-300" />Rota otimizada</span><span className="rounded-full bg-lime-300/12 px-2.5 py-1 text-xs font-medium text-lime-200">−31% km</span></div>
      <svg viewBox="0 0 340 190" className="w-full rounded-2xl border border-line bg-bg-deep/60" aria-hidden>
        <defs><linearGradient id="rt" x1="0" x2="1"><stop offset="0" stopColor="#10b981" /><stop offset="1" stopColor="#bef264" /></linearGradient></defs>
        {Array.from({ length: 8 }, (_, i) => <line key={`h${i}`} x1="0" x2="340" y1={i * 26} y2={i * 26} stroke="rgb(190 242 100 / 0.05)" />)}
        {Array.from({ length: 14 }, (_, i) => <line key={`v${i}`} y1="0" y2="190" x1={i * 26} x2={i * 26} stroke="rgb(190 242 100 / 0.05)" />)}
        <path d="M40 150 L150 128 L95 92 L262 112 L210 70 L300 48" stroke="rgb(248 113 113 / 0.35)" strokeWidth="2" strokeDasharray="4 5" fill="none" />
        <path d={d} stroke="url(#rt)" strokeWidth="3.5" fill="none" strokeLinecap="round" strokeLinejoin="round" className="[stroke-dasharray:600] motion-safe:animate-[dash_3s_ease-out_forwards]" />
        {stops.map(([x, y], i) => (
          <g key={i}>
            <circle cx={x} cy={y} r="9" fill="#04140d" stroke={i === 0 ? '#bef264' : '#34d399'} strokeWidth="2" />
            <text x={x} y={y + 3.5} textAnchor="middle" fontSize="9" fill="#f4f7f5" fontFamily="Inter Variable, sans-serif">{i === 0 ? 'D' : i}</text>
          </g>
        ))}
      </svg>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
        <div className="rounded-xl bg-bg-deep/50 p-2"><p className="text-muted">Paradas</p><p className="font-display text-base font-semibold">5</p></div>
        <div className="rounded-xl bg-bg-deep/50 p-2"><p className="text-muted">Distância</p><p className="font-display text-base font-semibold">8,2 km</p></div>
        <div className="rounded-xl bg-bg-deep/50 p-2"><p className="text-muted">Carga</p><p className="font-display text-base font-semibold">340 kg</p></div>
      </div>
    </Frame>
  );
}
