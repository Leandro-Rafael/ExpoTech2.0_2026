import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { motion } from 'motion/react';
import { BrainCircuit, Home, ShieldCheck, Sparkles } from 'lucide-react';
import { Logo, LogoMark } from '@/components/layout/Logo';

const highlights = [
  { icon: BrainCircuit, title: 'IA identifica o resíduo', text: 'Fotografe e receba a categoria e a orientação de descarte.' },
  { icon: Home, title: 'Casa conectada', text: 'Lixeiras inteligentes pedem a coleta sozinhas.' },
  { icon: Sparkles, title: 'Pontos que valem', text: 'Troque por benefícios de parceiros do seu bairro.' },
];

/** Layout dividido das telas de autenticação: visual da marca à esquerda, formulário à direita. */
export function AuthLayout({ title, subtitle, children, footer }: { title: string; subtitle: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      {/* Painel da marca */}
      <aside className="relative hidden overflow-hidden border-r border-line lg:flex lg:flex-col" aria-hidden>
        <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_0%_0%,rgb(16_185_129/0.22),transparent_55%),radial-gradient(90%_70%_at_100%_100%,rgb(190_242_100/0.12),transparent_60%)]" />
        <div className="absolute inset-0 grid-bg opacity-70" />
        <div className="relative z-10 flex h-full flex-col p-10 xl:p-14">
          <Link to="/" className="w-fit" tabIndex={-1}><Logo size={38} variant="full" /></Link>

          {/* Anel orbital decorativo */}
          <div className="relative my-auto flex items-center justify-center py-8 [@media(max-height:820px)]:hidden">
            <div className="relative size-[300px] xl:size-[340px]">
              <div className="absolute inset-0 animate-spin-slow rounded-full border border-dashed border-brand-300/20" />
              <div className="absolute inset-10 rounded-full border border-lime-300/10" style={{ animation: 'spin 40s linear infinite reverse' }} />
              <div className="absolute inset-16 rounded-full bg-[radial-gradient(closest-side,rgb(52_211_153/0.28),rgb(190_242_100/0.08)_60%,transparent)]" />
              {[0, 72, 144, 216, 288].map((deg) => (
                <span key={deg} className="absolute top-1/2 left-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-lime-300 shadow-[0_0_12px_#bef264]"
                  style={{ transform: `translate(-50%, -50%) rotate(${deg}deg) translateY(-150px)` }} />
              ))}
              <div className="absolute inset-0 flex items-center justify-center">
                <LogoMark size={128} className="animate-float drop-shadow-[0_0_50px_rgb(34_197_94/0.5)]" />
              </div>
            </div>
          </div>

          <div className="mt-auto max-w-md">
            <p className="mb-3 text-xs font-semibold tracking-[0.18em] text-brand-300 uppercase">Smart Home 2050</p>
            <h2 className="font-display text-4xl leading-[1.1] font-semibold text-fg xl:text-[42px]">
              Cada descarte certo é um passo para o <span className="text-gradient">lixo zero</span>.
            </h2>
            <ul className="mt-7 space-y-4">
              {highlights.map((h) => (
                <li key={h.title} className="flex gap-3.5">
                  <span className="glass inline-flex size-10 shrink-0 items-center justify-center rounded-xl text-brand-300"><h.icon className="size-5" /></span>
                  <div>
                    <p className="font-medium text-fg">{h.title}</p>
                    <p className="text-sm text-muted">{h.text}</p>
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-8 flex items-center gap-2 text-xs text-subtle">
              <ShieldCheck className="size-4 text-brand-400" /> Sessão protegida com cookies HttpOnly, CSRF e bloqueio por tentativas.
            </p>
          </div>
        </div>
      </aside>

      {/* Formulário */}
      <main className="relative flex flex-col">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(60%_100%_at_50%_0%,rgb(16_185_129/0.12),transparent)] lg:hidden" />
        <header className="container-app relative flex h-16 items-center justify-between lg:hidden">
          <Link to="/" aria-label="Página inicial"><Logo size={32} /></Link>
        </header>
        <div className="relative flex flex-1 items-center justify-center px-4 py-8 sm:px-8">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-[420px]"
          >
            <h1 className="font-display text-[28px] leading-tight font-semibold text-fg sm:text-3xl">{title}</h1>
            <p className="mt-2 text-[15px] text-muted">{subtitle}</p>
            <div className="mt-8">{children}</div>
            {footer && <div className="mt-8 text-center text-sm text-muted">{footer}</div>}
          </motion.div>
        </div>
        <footer className="pb-6 text-center text-xs text-subtle">EcoTech Zero · ExpoTech 2026 · UniFECAF</footer>
      </main>
    </div>
  );
}
