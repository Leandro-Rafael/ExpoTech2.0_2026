/**
 * Navegação do app (sidebar, bottom nav e menu mobile). Para adicionar uma página
 * ao menu, inclua um item aqui; `roles` restringe a seção/itens por perfil.
 */
import {
  BadgeCheck, Boxes, ClipboardList, Crown, Gift, Home, LayoutDashboard, Leaf, MapPinned, Medal, Recycle,
  Route, ScanLine, ScrollText, Settings2, ShieldCheck, Trash2, Truck, Users, type LucideIcon,
} from 'lucide-react';
import type { Role } from '@/api/types';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Correspondência exata (para rotas-índice como /app). */
  end?: boolean;
  roles?: Role[];
}
export interface NavSection { id: string; label: string; items: NavItem[]; roles?: Role[] }

export const NAV: NavSection[] = [
  {
    id: 'main', label: 'Principal', items: [
      { to: '/app', label: 'Início', icon: LayoutDashboard, end: true },
      { to: '/app/descartar', label: 'Registrar descarte', icon: ScanLine },
      { to: '/app/descartes', label: 'Meus descartes', icon: Recycle },
      { to: '/app/impacto', label: 'Impacto e simulador', icon: Leaf },
    ],
  },
  {
    id: 'home', label: 'Smart Home', items: [
      { to: '/app/casa', label: 'Minha casa', icon: Home },
      { to: '/app/mapa', label: 'Mapa de ecopontos', icon: MapPinned },
    ],
  },
  {
    id: 'community', label: 'Comunidade', items: [
      { to: '/app/recompensas', label: 'Recompensas', icon: Gift },
      { to: '/app/conquistas', label: 'Conquistas', icon: Medal },
      { to: '/app/ranking', label: 'Ranking', icon: Crown },
    ],
  },
  {
    id: 'collector', label: 'Coletor', roles: ['COLLECTOR', 'ADMIN'], items: [
      { to: '/app/coletor', label: 'Minhas rotas', icon: Truck },
    ],
  },
  {
    id: 'admin', label: 'Administração', roles: ['ADMIN'], items: [
      { to: '/app/admin', label: 'Visão geral', icon: ShieldCheck, end: true },
      { to: '/app/admin/descartes', label: 'Moderação', icon: BadgeCheck },
      { to: '/app/admin/usuarios', label: 'Usuários', icon: Users },
      { to: '/app/admin/coletas', label: 'Coletas e rotas', icon: Route },
      { to: '/app/admin/ecopontos', label: 'Ecopontos', icon: MapPinned },
      { to: '/app/admin/catalogo', label: 'Catálogo', icon: Boxes },
      { to: '/app/admin/lixeiras', label: 'Lixeiras', icon: Trash2 },
      { to: '/app/admin/auditoria', label: 'Auditoria', icon: ScrollText },
    ],
  },
];

/** Itens fixos da barra inferior (celular). O botão central "Registrar" é separado. */
export const MOBILE_TABS: NavItem[] = [
  { to: '/app', label: 'Início', icon: LayoutDashboard, end: true },
  { to: '/app/descartes', label: 'Descartes', icon: ClipboardList },
  { to: '/app/mapa', label: 'Mapa', icon: MapPinned },
];

export const PROFILE_ITEM: NavItem = { to: '/app/perfil', label: 'Meu perfil', icon: Settings2 };

export function sectionsForRole(role: Role | undefined): NavSection[] {
  return NAV.filter((s) => !s.roles || (role && s.roles.includes(role)))
    .map((s) => ({ ...s, items: s.items.filter((i) => !i.roles || (role && i.roles.includes(role))) }));
}

/** Título da página atual (para a top bar). */
export function titleForPath(pathname: string): string | null {
  let best: NavItem | null = null;
  for (const s of NAV) for (const i of s.items) {
    if (pathname === i.to || (!i.end && pathname.startsWith(i.to + '/'))) {
      if (!best || i.to.length > best.to.length) best = i;
    }
  }
  if (pathname.startsWith('/app/perfil')) return PROFILE_ITEM.label;
  return best?.label ?? null;
}
