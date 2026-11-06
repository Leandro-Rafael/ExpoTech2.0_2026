import { Link, NavLink } from 'react-router';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useAutenticacao } from '@/auth/AuthProvider';
import { secoesDoPerfil, type ItemMenu } from '@/app/navigation';
import { BarraProgresso } from '@/components/ui';
import { formatarNumero } from '@/lib/format';
import { cn } from '@/lib/cn';
import { Logo } from './Logo';

export function LinkItemMenu({ item, recolhido, aoNavegar }: { item: ItemMenu; recolhido?: boolean; aoNavegar?: () => void }) {
  const Icone = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={aoNavegar}
      title={recolhido ? item.label : undefined}
      className={({ isActive }) => cn(
        'group relative flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors duration-150',
        recolhido && 'justify-center px-0',
        isActive ? 'bg-white/[0.06] text-fg' : 'text-muted hover:bg-white/[0.03] hover:text-fg',
      )}
    >
      {({ isActive }) => (
        <>
          <Icone aria-hidden className={cn('size-[18px] shrink-0 transition-colors', isActive ? 'text-fg' : 'text-subtle group-hover:text-fg-soft')} />
          <span className={cn('truncate', recolhido && 'sr-only')}>{item.label}</span>
        </>
      )}
    </NavLink>
  );
}

export function MenuLateral({ recolhido, aoAlternar }: { recolhido: boolean; aoAlternar: () => void }) {
  const { user: usuario } = useAutenticacao();
  const secoes = secoesDoPerfil(usuario?.role);
  return (
    <aside
      aria-label="Navegação principal"
      className={cn(
        'fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-line bg-bg transition-[width] duration-300 ease-[var(--ease-out-expo)] lg:flex',
        recolhido ? 'w-[var(--sidebar-w-collapsed)]' : 'w-[var(--sidebar-w)]',
      )}
    >
      <div className={cn('flex h-[var(--header-h)] shrink-0 items-center', recolhido ? 'justify-center' : 'px-5')}>
        <Link to="/app" aria-label="Lixo Zero 2050 — início" className="rounded-lg">
          <Logo variant={recolhido ? 'mark' : 'compact'} size={recolhido ? 34 : 34} produto={!recolhido} />
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pt-2 pb-4" data-lenis-prevent>
        {secoes.map((secao) => (
          <div key={secao.id} className="mb-5">
            {recolhido ? (
              <div aria-hidden className="mx-auto mb-2 h-px w-6 bg-line-strong" />
            ) : (
              <p className="label-mono mb-1.5 px-3 text-[11px]">{secao.label}</p>
            )}
            <ul className="flex flex-col gap-0.5">
              {secao.itens.map((item) => (
                <li key={item.to}><LinkItemMenu item={item} recolhido={recolhido} /></li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {usuario?.role === 'USER' && !recolhido && (
        <Link to="/app/recompensas?aba=progresso" className="mx-3 mb-3 block rounded-xl border border-line p-4 transition-colors hover:border-line-strong hover:bg-white/[0.02]">
          <div className="mb-2.5 flex items-baseline justify-between">
            <span className="label-mono">Nível {usuario.level.index + 1}</span>
            <span className="text-sm font-medium text-fg">{usuario.level.name}</span>
          </div>
          <BarraProgresso value={usuario.level.progress} size="xs" rotuloValor={null} />
          <p className="mt-2 text-[11px] text-muted">
            {usuario.level.nextName && usuario.level.nextMinPoints != null
              ? <>Faltam <span className="text-fg-soft tabular">{formatarNumero(Math.max(0, usuario.level.nextMinPoints - usuario.totalEarned))}</span> pts para {usuario.level.nextName}</>
              : 'Nível máximo alcançado'}
          </p>
        </Link>
      )}

      <div className={cn('border-t border-line p-3', recolhido && 'flex justify-center')}>
        <button
          type="button"
          onClick={aoAlternar}
          aria-label={recolhido ? 'Expandir menu' : 'Recolher menu'}
          aria-expanded={!recolhido}
          className={cn('flex h-9 items-center gap-2 rounded-lg px-2.5 text-sm text-muted transition-colors hover:bg-white/5 hover:text-fg', !recolhido && 'w-full')}
        >
          {recolhido ? <PanelLeftOpen className="size-[18px]" aria-hidden /> : <><PanelLeftClose className="size-[18px]" aria-hidden /> Recolher</>}
        </button>
      </div>
    </aside>
  );
}
