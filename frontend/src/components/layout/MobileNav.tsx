import { useState } from 'react';
import { Link, NavLink } from 'react-router';
import { LayoutGrid, Plus } from 'lucide-react';
import { useAutenticacao } from '@/auth/AuthProvider';
import { ABAS_CELULAR, ITEM_PERFIL, secoesDoPerfil, type ItemMenu } from '@/app/navigation';
import { Gaveta } from '@/components/ui';
import { cn } from '@/lib/cn';
import { LinkItemMenu } from './Sidebar';
import { ChipPontos } from './UserMenu';

const CLASSE_ABA = 'flex flex-1 flex-col items-center justify-center gap-1 text-[10.5px] font-medium';

function AbaCelular({ item }: { item: ItemMenu }) {
  return (
    <NavLink to={item.to} end={item.end} className={({ isActive }) => cn(CLASSE_ABA, isActive ? 'text-fg' : 'text-subtle')}>
      <item.icon className="size-5" aria-hidden />
      {item.label}
    </NavLink>
  );
}

/** Barra inferior (celular) com botão central "Registrar" (morador) e menu completo em sheet. */
export function MenuCelular() {
  const { user: usuario } = useAutenticacao();
  const [aberto, setAberto] = useState(false);
  const secoes = secoesDoPerfil(usuario?.role);
  const abas = usuario ? ABAS_CELULAR[usuario.role] : [];

  return (
    <>
      <nav
        aria-label="Navegação rápida"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/95 pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        <div className="mx-auto flex h-16 max-w-lg items-stretch px-2">
          {abas.slice(0, 2).map((item) => <AbaCelular key={item.to} item={item} />)}
          {usuario?.role === 'USER' && <div className="flex flex-1 items-center justify-center">
            <Link
              to="/app/descartar"
              aria-label="Registrar descarte"
              className="-mt-6 inline-flex size-13 items-center justify-center rounded-2xl bg-accent text-accent-ink shadow-[0_0_0_4px_var(--color-bg)] transition-transform active:scale-95"
            >
              <Plus className="size-7" strokeWidth={2.5} aria-hidden />
            </Link>
          </div>}
          {abas.slice(2).map((item) => <AbaCelular key={item.to} item={item} />)}
          <button type="button" onClick={() => setAberto(true)} className={cn(CLASSE_ABA, 'text-subtle')} aria-haspopup="dialog" aria-expanded={aberto}>
            <LayoutGrid className="size-5" aria-hidden />
            Menu
          </button>
        </div>
      </nav>

      <Gaveta open={aberto} onClose={() => setAberto(false)} lado="bottom" title="Menu">
        {usuario?.role === 'USER' && <div className="mb-4"><ChipPontos className="w-fit" /></div>}
        {secoes.map((s) => (
          <div key={s.id} className="mb-4">
            <p className="label-mono mb-1.5 px-1 text-[11px]">{s.label}</p>
            <ul className="grid grid-cols-1 gap-0.5">
              {s.itens.map((item) => <li key={item.to}><LinkItemMenu item={item} aoNavegar={() => setAberto(false)} /></li>)}
            </ul>
          </div>
        ))}
        <div className="border-t border-line pt-3">
          <LinkItemMenu item={ITEM_PERFIL} aoNavegar={() => setAberto(false)} />
        </div>
      </Gaveta>
    </>
  );
}
