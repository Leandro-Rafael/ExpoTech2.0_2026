import { Suspense, useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router';
import { motion } from 'motion/react';
import { ScanLine } from 'lucide-react';
import { titleForPath } from '@/app/navigation';
import { ButtonLink, PageSkeleton } from '@/components/ui';
import { cn } from '@/lib/cn';
import { ErrorBoundary } from './ErrorBoundary';
import { Logo } from './Logo';
import { MobileNav } from './MobileNav';
import { Sidebar } from './Sidebar';
import { PointsChip, UserMenu } from './UserMenu';
import { InspectionGuard } from '@/security/InspectionGuard';

const COLLAPSE_KEY = 'ez:sidebar-collapsed';

function readCollapsed() {
  try { return localStorage.getItem(COLLAPSE_KEY) === '1'; } catch { return false; }
}

/**
 * Layout autenticado: sidebar (desktop), top bar, bottom nav (celular) e área de conteúdo
 * com transição suave entre páginas. As páginas renderizam dentro de `container-app`.
 */
export function AppShell() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const title = titleForPath(location.pathname);

  useEffect(() => {
    try { localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0'); } catch { /* armazenamento indisponível */ }
  }, [collapsed]);

  // Volta ao topo a cada navegação.
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior }); }, [location.pathname]);

  return (
    <div className="min-h-dvh">
      <a href="#conteudo" className="sr-only z-[100] rounded-lg bg-lime-300 px-4 py-2 font-medium text-bg-deep focus:not-sr-only focus:fixed focus:top-3 focus:left-3">
        Pular para o conteúdo
      </a>
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />

      <div className={cn('transition-[padding] duration-300 ease-[var(--ease-out-expo)]', collapsed ? 'lg:pl-[var(--sidebar-w-collapsed)]' : 'lg:pl-[var(--sidebar-w)]')}>
        <header className="sticky top-0 z-30 h-[var(--header-h)] border-b border-line bg-bg/85 backdrop-blur-md">
          <div className="container-app flex h-full items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <Link to="/app" className="rounded-lg lg:hidden" aria-label="Início"><Logo size={30} /></Link>
              {title && <p className="hidden truncate text-sm font-medium text-fg-soft lg:block">{title}</p>}
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <ButtonLink to="/app/descartar" size="md" leftIcon={ScanLine} className="max-md:hidden">
                Registrar descarte
              </ButtonLink>
              <PointsChip className="max-sm:hidden" />
              <UserMenu />
            </div>
          </div>
        </header>

        <main id="conteudo" tabIndex={-1} className="container-app pt-6 pb-28 outline-none sm:pt-8 lg:pb-16">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          >
            <ErrorBoundary resetKey={location.pathname}>
              <Suspense fallback={<PageSkeleton />}>
                <Outlet />
              </Suspense>
            </ErrorBoundary>
          </motion.div>
        </main>
      </div>

      <MobileNav />
      {/* Dissuasão de inspeção: só existe dentro da área logada */}
      <InspectionGuard />
    </div>
  );
}
