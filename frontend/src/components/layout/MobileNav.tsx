import { useState } from 'react';
import { Link, NavLink } from 'react-router';
import { LayoutGrid, Plus } from 'lucide-react';
import { useAuth } from '@/auth/AuthProvider';
import { MOBILE_TABS, PROFILE_ITEM, sectionsForRole, type NavItem } from '@/app/navigation';
import { Drawer } from '@/components/ui';
import { cn } from '@/lib/cn';
import { NavItemLink } from './Sidebar';
import { PointsChip } from './UserMenu';

const TAB_CLASS = 'flex flex-1 flex-col items-center justify-center gap-1 text-[10.5px] font-medium';

function MobileTab({ item }: { item: NavItem }) {
  return (
    <NavLink to={item.to} end={item.end} className={({ isActive }) => cn(TAB_CLASS, isActive ? 'text-fg' : 'text-subtle')}>
      <item.icon className="size-5" aria-hidden />
      {item.label}
    </NavLink>
  );
}

/** Barra inferior (celular) com botão central "Registrar" (morador) e menu completo em sheet. */
export function MobileNav() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const sections = sectionsForRole(user?.role);
  const tabs = user ? MOBILE_TABS[user.role] : [];

  return (
    <>
      <nav
        aria-label="Navegação rápida"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/95 pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        <div className="mx-auto flex h-16 max-w-lg items-stretch px-2">
          {tabs.slice(0, 2).map((item) => <MobileTab key={item.to} item={item} />)}
          {user?.role === 'USER' && <div className="flex flex-1 items-center justify-center">
            <Link
              to="/app/descartar"
              aria-label="Registrar descarte"
              className="-mt-6 inline-flex size-13 items-center justify-center rounded-2xl bg-accent text-accent-ink shadow-[0_0_0_4px_var(--color-bg)] transition-transform active:scale-95"
            >
              <Plus className="size-7" strokeWidth={2.5} aria-hidden />
            </Link>
          </div>}
          {tabs.slice(2).map((item) => <MobileTab key={item.to} item={item} />)}
          <button type="button" onClick={() => setOpen(true)} className={cn(TAB_CLASS, 'text-subtle')} aria-haspopup="dialog" aria-expanded={open}>
            <LayoutGrid className="size-5" aria-hidden />
            Menu
          </button>
        </div>
      </nav>

      <Drawer open={open} onClose={() => setOpen(false)} side="bottom" title="Menu">
        {user?.role === 'USER' && <div className="mb-4"><PointsChip className="w-fit" /></div>}
        {sections.map((s) => (
          <div key={s.id} className="mb-4">
            <p className="label-mono mb-1.5 px-1 text-[11px]">{s.label}</p>
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
