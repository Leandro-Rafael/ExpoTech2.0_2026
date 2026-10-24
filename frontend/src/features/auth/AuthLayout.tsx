import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { motion } from 'motion/react';
import { Logo } from '@/components/layout/Logo';

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
      <aside className="relative hidden overflow-hidden border-r border-line bg-bg lg:flex lg:flex-col" aria-hidden>
        {/* quadro estático da cena 3D da landing */}
        <img src="/scene/ring-desktop.webp" alt="" decoding="async" className="absolute inset-0 size-full object-cover object-[78%_45%] opacity-90" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgb(10_14_12/0.2)_0%,rgb(10_14_12/0)_35%,rgb(10_14_12/0.85)_72%,#0a0e0c_100%)]" />
        <div className="relative z-10 flex h-full flex-col justify-between p-10 xl:p-12">
          <Link to="/" className="w-fit" tabIndex={-1}><Logo size={30} /></Link>
          <div className="max-w-[30rem]">
            <p className="label-mono mb-4">Smart Home 2050</p>
            <h2 className="text-[clamp(2rem,1.5rem+1.4vw,2.75rem)] leading-[1.06] text-fg">
              Cada descarte certo aproxima o bairro do lixo zero.
            </h2>
            <dl className="mt-8 border-t border-line">
              {highlights.map(([k, v]) => (
                <div key={k} className="grid grid-cols-[5.5rem_1fr] gap-4 border-b border-line py-3 text-[14px]">
                  <dt className="label-mono pt-0.5">{k}</dt>
                  <dd className="text-fg-soft">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-6 font-mono text-[11px] text-subtle">Sessão com cookies HttpOnly, CSRF e bloqueio por tentativas.</p>
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
