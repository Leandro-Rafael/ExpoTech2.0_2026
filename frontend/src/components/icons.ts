/**
 * Mapa estático nome-lucide → componente (para ícones que vêm da API: Category.icon,
 * Reward.icon, Badge.icon). Estático para não carregar os ~1500 ícones do lucide.
 * Precisa de um ícone novo? Importe e adicione aqui.
 */
import {
  Apple, Award, Battery, BatteryCharging, Beer, Bike, BookOpen, Box, Bus, Coffee, Cpu, Crown, Cylinder,
  Droplet, Droplets, Flame, Flower2, Gem, Gift, GlassWater, GraduationCap, Heart, Home, Leaf, Lightbulb, Medal,
  Milk, Monitor, Newspaper, Package, Recycle, Rocket, Shirt, ShoppingBag, Smartphone, Sparkles, Sprout, Star,
  Store, Sun, Target, Ticket, Trash2, TreePine, Trees, Trophy, Truck, Utensils, Wine, Zap, Flag, Shield, Wrench,
  Car, Popcorn, Pizza, IceCreamCone, Film, Music, Tv, Plug, Footprints, type LucideIcon,
} from 'lucide-react';

export const ICONS: Record<string, LucideIcon> = {
  apple: Apple, award: Award, battery: Battery, 'battery-charging': BatteryCharging, beer: Beer, bike: Bike,
  'book-open': BookOpen, 'bottle-wine': Wine, box: Box, bus: Bus, coffee: Coffee, cpu: Cpu, crown: Crown, cylinder: Cylinder,
  droplet: Droplet, droplets: Droplets, flame: Flame, flower: Flower2, 'flower-2': Flower2, gem: Gem, gift: Gift,
  'glass-water': GlassWater, 'graduation-cap': GraduationCap, heart: Heart, home: Home, house: Home, leaf: Leaf,
  lightbulb: Lightbulb, medal: Medal, milk: Milk, monitor: Monitor, newspaper: Newspaper, package: Package,
  recycle: Recycle, rocket: Rocket, shirt: Shirt, 'shopping-bag': ShoppingBag, smartphone: Smartphone,
  sparkles: Sparkles, sprout: Sprout, star: Star, store: Store, sun: Sun, target: Target, ticket: Ticket,
  trash: Trash2, 'trash-2': Trash2, 'tree-pine': TreePine, trees: Trees, trophy: Trophy, truck: Truck,
  utensils: Utensils, wine: Wine, zap: Zap, flag: Flag, shield: Shield, wrench: Wrench, car: Car, popcorn: Popcorn,
  pizza: Pizza, 'ice-cream-cone': IceCreamCone, film: Film, music: Music, tv: Tv, plug: Plug, footprints: Footprints,
};

/** Resolve nome lucide (kebab-case ou PascalCase) → componente; fallback ♻. */
export function iconByName(name: string | null | undefined, fallback: LucideIcon = Recycle): LucideIcon {
  if (!name) return fallback;
  const key = name.trim().replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
  return ICONS[key] ?? ICONS[key.replace(/-\d+$/, '')] ?? fallback;
}
