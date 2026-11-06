/**
 * Navegação do app (sidebar, bottom nav e menu mobile). Para adicionar uma página
 * ao menu, inclua um item aqui; `roles` define quais perfis veem a seção.
 * O menu só esconde o que o perfil não usa; o acesso é barrado pelas rotas e pelo servidor.
 */
import {
  BadgeCheck, Boxes, ClipboardList, Gift, Home, LayoutDashboard, MapPinned, Recycle,
  Route, ScanLine, Settings2, ShieldCheck, Truck, type LucideIcon,
} from 'lucide-react';
import type { Role } from '@/api/types';

export interface ItemMenu {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Correspondência exata (para rotas-índice como /app). */
  end?: boolean;
}
interface SecaoMenu { id: string; label: string; itens: ItemMenu[]; perfis: Role[] }

const MENU: SecaoMenu[] = [
  {
    id: 'main', label: 'Principal', perfis: ['USER'], itens: [
      { to: '/app', label: 'Início', icon: LayoutDashboard, end: true },
      { to: '/app/descartar', label: 'Registrar descarte', icon: ScanLine },
      { to: '/app/descartes', label: 'Meus descartes', icon: Recycle },
    ],
  },
  {
    id: 'home', label: 'Smart Home', perfis: ['USER'], itens: [
      { to: '/app/casa', label: 'Minha casa', icon: Home },
      { to: '/app/mapa', label: 'Mapa de ecopontos', icon: MapPinned },
    ],
  },
  {
    id: 'community', label: 'Comunidade', perfis: ['USER'], itens: [
      { to: '/app/recompensas', label: 'Recompensas', icon: Gift },
    ],
  },
  {
    id: 'collector', label: 'Coletor', perfis: ['COLLECTOR'], itens: [
      { to: '/app/coletor', label: 'Minhas rotas', icon: Truck },
    ],
  },
  {
    id: 'admin', label: 'Administração', perfis: ['ADMIN'], itens: [
      { to: '/app/admin', label: 'Visão geral', icon: ShieldCheck, end: true },
      { to: '/app/admin/descartes', label: 'Moderação', icon: BadgeCheck },
      { to: '/app/admin/coletas', label: 'Coletas', icon: Route },
      { to: '/app/admin/catalogo', label: 'Catálogo', icon: Boxes },
    ],
  },
];

export const ITEM_PERFIL: ItemMenu = { to: '/app/perfil', label: 'Meu perfil', icon: Settings2 };

/** Itens fixos da barra inferior (celular). O botão central "Registrar" é só do morador. */
export const ABAS_CELULAR: Record<Role, ItemMenu[]> = {
  USER: [
    { to: '/app', label: 'Início', icon: LayoutDashboard, end: true },
    { to: '/app/descartes', label: 'Descartes', icon: ClipboardList },
    { to: '/app/mapa', label: 'Mapa', icon: MapPinned },
  ],
  COLLECTOR: [
    { to: '/app/coletor', label: 'Rotas', icon: Truck },
    { to: ITEM_PERFIL.to, label: 'Perfil', icon: ITEM_PERFIL.icon },
  ],
  ADMIN: [
    { to: '/app/admin', label: 'Visão geral', icon: ShieldCheck, end: true },
    { to: '/app/admin/descartes', label: 'Moderação', icon: BadgeCheck },
    { to: '/app/admin/coletas', label: 'Coletas', icon: Route },
  ],
};

export function secoesDoPerfil(perfil: Role | undefined): SecaoMenu[] {
  return MENU.filter((s) => perfil && s.perfis.includes(perfil));
}

/** Título da página atual (para a top bar). */
export function tituloDaRota(caminho: string): string | null {
  const correspondencias = [...MENU.flatMap((s) => s.itens), ITEM_PERFIL]
    .filter((i) => caminho === i.to || (!i.end && caminho.startsWith(i.to + '/')))
    .sort((a, b) => b.to.length - a.to.length);
  return correspondencias[0]?.label ?? null;
}
