import { Suspense, type ReactNode } from 'react';
import { Link } from 'react-router';
import { motion } from 'motion/react';
import { Logo } from '@/components/layout/Logo';
import { CenaAbertura, useCena3D } from '@/features/landing/LandingBackground';
import { useEhDesktop } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/cn';

const destaques = [
  ['IA', 'Fotografe e receba a categoria e o jeito certo de descartar.'],
  ['Casa', 'Lixeiras inteligentes pedem a coleta sozinhas.'],
  ['Pontos', 'Troque por benefícios de parceiros do seu bairro.'],
];

/** Mesma cena 3D da landing no painel da marca; o quadro estático aparece até ela carregar (ou se o PC for fraco). */
function FundoPainel() {
  const cena = useCena3D(useEhDesktop());
  return (
    <>
      <img src="/scene/ring-desktop.webp" alt="" decoding="async"
        className={cn('absolute inset-0 size-full object-cover object-[78%_45%] transition-opacity duration-[1500ms]', cena.visivel ? 'opacity-0' : 'opacity-90')} />
      {cena.mostrarCena && (
        <div className={cn('absolute inset-0 transition-opacity duration-[1500ms]', cena.visivel ? 'opacity-100' : 'opacity-0')}>
          <Suspense fallback={null}><CenaAbertura onReady={cena.aoFicarPronta} onFail={cena.aoFalhar} /></Suspense>
        </div>
      )}
    </>
  );
}

// Classes [@media(max-height:900px)]: telas baixas (notebooks 1366×768, 1280×720 e Full HD com zoom de 125%) com espaçamentos menores, para caber sem rolar.

/** Layout dividido das telas de autenticação: painel editorial à esquerda, formulário à direita. */
export function LayoutAuth({ title, subtitulo, children, rodape }: { title: string; subtitulo: ReactNode; children: ReactNode; rodape?: ReactNode }) {
  return (
    // No computador ocupa exatamente a altura da tela: a página não rola; se faltar espaço, rola só o formulário.
    <div className="grid min-h-dvh lg:h-dvh lg:grid-cols-[1fr_1fr] lg:overflow-hidden">
      {/* Painel da marca */}
      <aside className="relative hidden overflow-hidden border-r border-line bg-bg lg:flex lg:flex-col" aria-hidden>
        <FundoPainel />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgb(10_14_12/0.2)_0%,rgb(10_14_12/0)_35%,rgb(10_14_12/0.85)_72%,#0a0e0c_100%)]" />
        <div className="pointer-events-none relative z-10 flex h-full flex-col justify-between p-10 xl:p-12 [@media(max-height:900px)]:py-8">
          <Link to="/" className="pointer-events-auto w-fit" tabIndex={-1}><Logo size={30} /></Link>
          <div className="max-w-[30rem]">
            <p className="label-mono mb-4">Smart Home 2050</p>
            <h2 className="text-[clamp(2rem,1.5rem+1.4vw,2.75rem)] leading-[1.06] text-fg">
              Cada descarte certo aproxima o bairro do lixo zero.
            </h2>
            <dl className="mt-8 border-t border-line [@media(max-height:900px)]:hidden">
              {destaques.map(([k, v]) => (
                <div key={k} className="grid grid-cols-[5.5rem_1fr] gap-4 border-b border-line py-3 text-[14px]">
                  <dt className="label-mono pt-0.5">{k}</dt>
                  <dd className="text-fg-soft">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-6 font-mono text-[11px] text-subtle [@media(max-height:900px)]:mt-4">Sessão com cookies HttpOnly, CSRF e bloqueio por tentativas.</p>
          </div>
        </div>
      </aside>

      {/* Formulário */}
      <main className="relative flex flex-col lg:overflow-y-auto" data-lenis-prevent>
        <header className="container-app relative flex h-16 items-center justify-between lg:hidden">
          <Link to="/" aria-label="Página inicial"><Logo size={28} /></Link>
        </header>
        <div className="relative flex flex-1 items-center justify-center px-4 py-8 sm:px-8 [@media(max-height:900px)]:py-4">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-[400px]"
          >
            <h1 className="text-[clamp(2rem,1.7rem+1vw,2.5rem)] leading-[1.08] text-fg [@media(max-height:740px)]:text-[1.75rem]">{title}</h1>
            <p className="mt-3 text-[15px] leading-relaxed text-muted [@media(max-height:900px)]:mt-2 [@media(max-height:740px)]:hidden">{subtitulo}</p>
            <div className="mt-8 [@media(max-height:900px)]:mt-6 [@media(max-height:740px)]:mt-4">{children}</div>
            {rodape && <div className="mt-8 text-center text-sm text-muted [@media(max-height:900px)]:mt-5 [@media(max-height:740px)]:mt-3">{rodape}</div>}
          </motion.div>
        </div>
        <footer className="pb-6 text-center font-mono text-[11px] text-subtle [@media(max-height:900px)]:pb-4">EcoTech Zero · ExpoTech 2026 · UniFECAF</footer>
      </main>
    </div>
  );
}
