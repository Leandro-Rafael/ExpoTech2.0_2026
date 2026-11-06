// Moldura da área logada (/app): menu lateral, barra do celular, topo com pontos e o vigia de inspeção.
import { Suspense, useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router';
import { motion } from 'motion/react';
import { ScanLine } from 'lucide-react';
import { tituloDaRota } from '@/app/navigation';
import { useAutenticacao } from '@/auth/AuthProvider';
import { LinkBotao, EsqueletoPagina } from '@/components/ui';
import { cn } from '@/lib/cn';
import { LimiteDeErro } from './ErrorBoundary';
import { Logo } from './Logo';
import { MenuCelular } from './MobileNav';
import { MenuLateral } from './Sidebar';
import { ChipPontos, MenuUsuario } from './UserMenu';
import { VigiaInspecao } from '@/security/InspectionGuard';

const CHAVE_RECOLHIDO = 'ez:sidebar-collapsed';

function lerRecolhido() {
  try { return localStorage.getItem(CHAVE_RECOLHIDO) === '1'; } catch { return false; }
}

/**
 * Layout autenticado: sidebar (desktop), top bar, bottom nav (celular) e área de conteúdo
 * com transição suave entre páginas. As páginas renderizam dentro de `container-app`.
 */
export function MolduraApp() {
  const localizacao = useLocation();
  const ehMorador = useAutenticacao().user?.role === 'USER';
  const [recolhido, setRecolhido] = useState(lerRecolhido);
  const titulo = tituloDaRota(localizacao.pathname);

  useEffect(() => {
    try { localStorage.setItem(CHAVE_RECOLHIDO, recolhido ? '1' : '0'); } catch { /* armazenamento indisponível */ }
  }, [recolhido]);

  // Volta ao topo a cada navegação.
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior }); }, [localizacao.pathname]);

  return (
    <div className="min-h-dvh">
      <a href="#conteudo" className="sr-only z-[100] rounded-lg bg-lime-300 px-4 py-2 font-medium text-bg-deep focus:not-sr-only focus:fixed focus:top-3 focus:left-3">
        Pular para o conteúdo
      </a>
      <MenuLateral recolhido={recolhido} aoAlternar={() => setRecolhido((c) => !c)} />

      <div className={cn('transition-[padding] duration-300 ease-[var(--ease-out-expo)]', recolhido ? 'lg:pl-[var(--sidebar-w-collapsed)]' : 'lg:pl-[var(--sidebar-w)]')}>
        <header className="sticky top-0 z-30 h-[var(--header-h)] border-b border-line bg-bg/85 backdrop-blur-md">
          <div className="container-app flex h-full items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <Link to="/app" className="rounded-lg lg:hidden" aria-label="Início"><Logo size={30} /></Link>
              {titulo && <p className="hidden truncate text-sm font-medium text-fg-soft lg:block">{titulo}</p>}
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              {ehMorador && (
                <>
                  <LinkBotao to="/app/descartar" size="md" iconeEsquerda={ScanLine} className="max-md:hidden">
                    Registrar descarte
                  </LinkBotao>
                  <ChipPontos className="max-sm:hidden" />
                </>
              )}
              <MenuUsuario />
            </div>
          </div>
        </header>

        <main id="conteudo" tabIndex={-1} className="container-app pt-6 pb-28 outline-none sm:pt-8 lg:pb-16">
          <motion.div
            key={localizacao.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          >
            <LimiteDeErro chaveReinicio={localizacao.pathname}>
              <Suspense fallback={<EsqueletoPagina />}>
                <Outlet />
              </Suspense>
            </LimiteDeErro>
          </motion.div>
        </main>
      </div>

      <MenuCelular />
      {/* Dissuasão de inspeção: só existe dentro da área logada */}
      <VigiaInspecao />
    </div>
  );
}
