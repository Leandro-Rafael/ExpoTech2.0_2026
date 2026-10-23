import { Link, NavLink } from 'react-router';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useAuth } from '@/auth/AuthProvider';
import { sectionsForRole, type NavItem } from '@/app/navigation';
import { ProgressBar } from '@/components/ui';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/cn';
import { Logo } from './Logo';

export function NavItemLink({ item, collapsed, onNavigate }: { item: NavItem; collapsed?: boolean; onNavigate?: () => void }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      title={collapsed ? item.label : undefined}
      className={({ isActive }) => cn(
        'group relative flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors duration-150',
        collapsed && 'justify-center px-0',
        isActive ? 'bg-gradient-to-r from-brand-500/16 to-brand-500/[0.03] text-fg' : 'text-muted hover:bg-white/[0.04] hover:text-fg-soft',
      )}
    >
      {({ isActive }) => (
        <>
          {isActive && <span aria-hidden className="absolute top-2 bottom-2 left-0 w-[3px] rounded-full bg-brand-gradient shadow-[0_0_12px_rgb(52_211_153/0.8)]" />}
          <Icon aria-hidden className={cn('size-[18px] shrink-0 transition-colors', isActive ? 'text-brand-300' : 'text-subtle group-hover:text-fg-soft')} />
          <span className={cn('truncate', collapsed && 'sr-only')}>{item.label}</span>
        </>
      )}
    </NavLink>
  );
}

export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const { user } = useAuth();
  const sections = sectionsForRole(user?.role);
  return (
    <aside
      aria-label="Navegação principal"
      className={cn(
        'fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-line bg-bg-deep/80 backdrop-blur-xl transition-[width] duration-300 ease-[var(--ease-out-expo)] lg:flex',
        collapsed ? 'w-[var(--sidebar-w-collapsed)]' : 'w-[var(--sidebar-w)]',
      )}
    >
      <div className={cn('flex h-[var(--header-h)] shrink-0 items-center', collapsed ? 'justify-center' : 'px-5')}>
        <Link to="/app" aria-label="Lixo Zero 2050 — início" className="rounded-lg">
          <Logo variant={collapsed ? 'mark' : 'compact'} size={collapsed ? 34 : 34} product={!collapsed} />
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pt-2 pb-4" data-lenis-prevent>
        {sections.map((section) => (
          <div key={section.id} className="mb-5">
            {collapsed ? (
              <div aria-hidden className="mx-auto mb-2 h-px w-6 bg-line-strong" />
            ) : (
              <p className="mb-1.5 px-3 text-[11px] font-semibold tracking-[0.14em] text-subtle uppercase">{section.label}</p>
            )}
            <ul className="flex flex-col gap-0.5">
              {section.items.map((item) => (
                <li key={item.to}><NavItemLink item={item} collapsed={collapsed} /></li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {user && !collapsed && (
        <Link to="/app/conquistas" className="mx-3 mb-3 block rounded-2xl border border-line bg-gradient-to-br from-brand-500/10 to-lime-300/[0.03] p-4 transition-colors hover:border-line-strong">
          <div className="mb-2.5 flex items-baseline justify-between">
            <span className="text-xs text-muted">Nível {user.level.index + 1}</span>
            <span className="font-display text-sm font-semibold text-lime-200">{user.level.name}</span>
          </div>
          <ProgressBar value={user.level.progress} size="xs" valueLabel={null} />
          <p className="mt-2 text-[11px] text-muted">
            {user.level.nextName && user.level.nextMinPoints != null
              ? <>Faltam <span className="text-fg-soft tabular">{formatNumber(Math.max(0, user.level.nextMinPoints - user.totalEarned))}</span> pts para {user.level.nextName}</>
              : 'Nível máximo alcançado'}
          </p>
        </Link>
      )}

      <div className={cn('border-t border-line p-3', collapsed && 'flex justify-center')}>
        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
          aria-expanded={!collapsed}
          className={cn('flex h-9 items-center gap-2 rounded-lg px-2.5 text-sm text-muted transition-colors hover:bg-white/5 hover:text-fg', !collapsed && 'w-full')}
        >
          {collapsed ? <PanelLeftOpen className="size-[18px]" aria-hidden /> : <><PanelLeftClose className="size-[18px]" aria-hidden /> Recolher</>}
        </button>
      </div>
    </aside>
  );
}
