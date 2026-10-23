import { useState } from 'react';
import { Link, NavLink } from 'react-router';
import { LayoutGrid, Plus } from 'lucide-react';
import { useAuth } from '@/auth/AuthProvider';
import { MOBILE_TABS, PROFILE_ITEM, sectionsForRole } from '@/app/navigation';
import { Drawer } from '@/components/ui';
import { cn } from '@/lib/cn';
import { NavItemLink } from './Sidebar';
import { PointsChip } from './UserMenu';

/** Barra inferior (celular) com botão central "Registrar" e menu completo em sheet. */
export function MobileNav() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const sections = sectionsForRole(user?.role);
  const tab = 'flex flex-1 flex-col items-center justify-center gap-1 text-[10.5px] font-medium';

  return (
    <>
      <nav
        aria-label="Navegação rápida"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg-deep/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
      >
        <div className="mx-auto flex h-16 max-w-lg items-stretch px-2">
          {MOBILE_TABS.slice(0, 2).map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => cn(tab, isActive ? 'text-brand-300' : 'text-muted')}>
              <item.icon className="size-5" aria-hidden />
              {item.label}
            </NavLink>
          ))}
          <div className="flex flex-1 items-center justify-center">
            <Link
              to="/app/descartar"
              aria-label="Registrar descarte"
              className="-mt-7 inline-flex size-14 items-center justify-center rounded-2xl bg-brand-gradient text-bg-deep shadow-[0_10px_30px_-6px_rgb(34_197_94/0.7),0_0_0_4px_var(--color-bg)] transition-transform active:scale-95"
            >
              <Plus className="size-7" strokeWidth={2.5} aria-hidden />
            </Link>
          </div>
          {MOBILE_TABS.slice(2).map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => cn(tab, isActive ? 'text-brand-300' : 'text-muted')}>
              <item.icon className="size-5" aria-hidden />
              {item.label}
            </NavLink>
          ))}
          <button type="button" onClick={() => setOpen(true)} className={cn(tab, 'text-muted')} aria-haspopup="dialog" aria-expanded={open}>
            <LayoutGrid className="size-5" aria-hidden />
            Menu
          </button>
        </div>
      </nav>

      <Drawer open={open} onClose={() => setOpen(false)} side="bottom" title="Menu">
        <div className="mb-4"><PointsChip className="w-fit" /></div>
        {sections.map((s) => (
          <div key={s.id} className="mb-4">
            <p className="mb-1.5 px-1 text-[11px] font-semibold tracking-[0.14em] text-subtle uppercase">{s.label}</p>
            <ul className="grid grid-cols-1 gap-0.5">
              {s.items.map((item) => <li key={item.to}><NavItemLink item={item} onNavigate={() => setOpen(false)} /></li>)}
            </ul>
          </div>
        ))}
        <div className="border-t border-line pt-3">
          <NavItemLink item={PROFILE_ITEM} onNavigate={() => setOpen(false)} />
        </div>
      </Drawer>
    </>
  );
}
