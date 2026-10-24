import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { motion } from 'motion/react';
import { Logo, LogoMark } from '@/components/layout/Logo';

const highlights = [
  ['IA', 'Fotografe e receba a categoria e o jeito certo de descartar.'],
  ['Casa', 'Lixeiras inteligentes pedem a coleta sozinhas.'],
  ['Pontos', 'Troque por benefícios de parceiros do seu bairro.'],
];

/** Layout dividido das telas de autenticação: painel editorial à esquerda, formulário à direita. */
export function AuthLayout({ title, subtitle, children, footer }: { title: string; subtitle: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_1fr]">
      {/* Painel da marca */}
      <aside className="relative hidden overflow-hidden border-r border-line bg-bg-deep lg:flex lg:flex-col" aria-hidden>
        <div className="absolute inset-0 bg-[radial-gradient(50%_45%_at_70%_38%,rgb(16_185_129/0.12),transparent_70%)]" />
        <div className="relative z-10 flex h-full flex-col p-10 xl:p-14">
          <Link to="/" className="w-fit" tabIndex={-1}><Logo size={30} /></Link>

          <div className="relative my-auto flex items-center justify-center py-10 [@media(max-height:820px)]:hidden">
            <div className="relative size-[280px]">
              <div className="absolute inset-0 rounded-full border border-line" />
              <div className="absolute inset-10 rounded-full border border-line" />
              <div className="absolute inset-0 animate-spin-slow rounded-full border border-dashed border-[rgb(52_211_153/0.25)]" />
              <div className="absolute inset-0 flex items-center justify-center">
                <LogoMark size={104} />
              </div>
            </div>
          </div>

          <div className="mt-auto max-w-[30rem]">
            <p className="label-mono mb-5">Smart Home 2050</p>
            <h2 className="text-[clamp(2.25rem,1.6rem+1.6vw,3rem)] leading-[1.06] text-fg">
              Cada descarte certo aproxima o bairro do lixo zero.
            </h2>
            <dl className="mt-10 border-t border-line">
              {highlights.map(([k, v]) => (
                <div key={k} className="grid grid-cols-[5.5rem_1fr] gap-4 border-b border-line py-3.5 text-[14px]">
                  <dt className="label-mono pt-0.5">{k}</dt>
                  <dd className="text-fg-soft">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-8 font-mono text-[11px] text-subtle">Sessão com cookies HttpOnly, CSRF e bloqueio por tentativas.</p>
          </div>
        </div>
      </aside>

      {/* Formulário */}
      <main className="relative flex flex-col">
        <header className="container-app relative flex h-16 items-center justify-between lg:hidden">
          <Link to="/" aria-label="Página inicial"><Logo size={28} /></Link>
        </header>
        <div className="relative flex flex-1 items-center justify-center px-4 py-10 sm:px-8">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-[400px]"
          >
            <h1 className="text-[clamp(2rem,1.7rem+1vw,2.5rem)] leading-[1.08] text-fg">{title}</h1>
            <p className="mt-3 text-[15px] leading-relaxed text-muted">{subtitle}</p>
            <div className="mt-10">{children}</div>
            {footer && <div className="mt-10 text-center text-sm text-muted">{footer}</div>}
          </motion.div>
        </div>
        <footer className="pb-6 text-center font-mono text-[11px] text-subtle">EcoTech Zero · ExpoTech 2026 · UniFECAF</footer>
      </main>
    </div>
  );
}
