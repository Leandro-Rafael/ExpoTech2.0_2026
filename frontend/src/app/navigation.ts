/**
 * Navegação do app (sidebar, bottom nav e menu mobile). Para adicionar uma página
 * ao menu, inclua um item aqui; `roles` define quais perfis veem a seção.
 */
import {
  BadgeCheck, Boxes, ClipboardList, Gift, Home, LayoutDashboard, MapPinned, Recycle,
  Route, ScanLine, Settings2, ShieldCheck, Truck, type LucideIcon,
} from 'lucide-react';
import type { Role } from '@/api/types';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Correspondência exata (para rotas-índice como /app). */
  end?: boolean;
}
interface NavSection { id: string; label: string; items: NavItem[]; roles: Role[] }

const NAV: NavSection[] = [
  {
    id: 'main', label: 'Principal', roles: ['USER'], items: [
      { to: '/app', label: 'Início', icon: LayoutDashboard, end: true },
      { to: '/app/descartar', label: 'Registrar descarte', icon: ScanLine },
      { to: '/app/descartes', label: 'Meus descartes', icon: Recycle },
    ],
  },
  {
    id: 'home', label: 'Smart Home', roles: ['USER'], items: [
      { to: '/app/casa', label: 'Minha casa', icon: Home },
      { to: '/app/mapa', label: 'Mapa de ecopontos', icon: MapPinned },
    ],
  },
  {
    id: 'community', label: 'Comunidade', roles: ['USER'], items: [
      { to: '/app/recompensas', label: 'Recompensas', icon: Gift },
    ],
  },
  {
    id: 'collector', label: 'Coletor', roles: ['COLLECTOR'], items: [
      { to: '/app/coletor', label: 'Minhas rotas', icon: Truck },
    ],
  },
  {
    id: 'admin', label: 'Administração', roles: ['ADMIN'], items: [
      { to: '/app/admin', label: 'Visão geral', icon: ShieldCheck, end: true },
      { to: '/app/admin/descartes', label: 'Moderação', icon: BadgeCheck },
      { to: '/app/admin/coletas', label: 'Coletas', icon: Route },
      { to: '/app/admin/catalogo', label: 'Catálogo', icon: Boxes },
    ],
  },
];

export const PROFILE_ITEM: NavItem = { to: '/app/perfil', label: 'Meu perfil', icon: Settings2 };

/** Itens fixos da barra inferior (celular). O botão central "Registrar" é só do morador. */
export const MOBILE_TABS: Record<Role, NavItem[]> = {
  USER: [
    { to: '/app', label: 'Início', icon: LayoutDashboard, end: true },
    { to: '/app/descartes', label: 'Descartes', icon: ClipboardList },
    { to: '/app/mapa', label: 'Mapa', icon: MapPinned },
  ],
  COLLECTOR: [
    { to: '/app/coletor', label: 'Rotas', icon: Truck },
    { to: PROFILE_ITEM.to, label: 'Perfil', icon: PROFILE_ITEM.icon },
  ],
  ADMIN: [
    { to: '/app/admin', label: 'Visão geral', icon: ShieldCheck, end: true },
    { to: '/app/admin/descartes', label: 'Moderação', icon: BadgeCheck },
    { to: '/app/admin/coletas', label: 'Coletas', icon: Route },
  ],
};

export function sectionsForRole(role: Role | undefined): NavSection[] {
  return NAV.filter((s) => role && s.roles.includes(role));
}

/** Título da página atual (para a top bar). */
export function titleForPath(pathname: string): string | null {
  const matches = [...NAV.flatMap((s) => s.items), PROFILE_ITEM]
    .filter((i) => pathname === i.to || (!i.end && pathname.startsWith(i.to + '/')))
    .sort((a, b) => b.to.length - a.to.length);
  return matches[0]?.label ?? null;
}
