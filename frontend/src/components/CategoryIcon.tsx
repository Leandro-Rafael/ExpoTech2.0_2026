import type { CategoryCode } from '@/api/types';
import { cn } from '@/lib/cn';
import { categoryColor, hexAlpha } from '@/lib/category';
import { categoryFallback } from '@/lib/labels';
import { iconByName } from './icons';

export interface CategoryIconProps {
  /** Category.icon (nome lucide). Se omitido, usa o padrão do código. */
  icon?: string | null;
  code?: CategoryCode | null;
  /** Category.color (hex). */
  color?: string | null;
  /** plain: só o ícone colorido; tile: quadrado tingido; circle: círculo tingido. */
  variant?: 'plain' | 'tile' | 'circle';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  /** Rótulo acessível (ex.: nome da categoria). Sem ele, o ícone é decorativo. */
  label?: string;
}

const box = { sm: 'size-8 [&_svg]:size-4', md: 'size-10 [&_svg]:size-5', lg: 'size-12 [&_svg]:size-6', xl: 'size-16 [&_svg]:size-8' };
const plain = { sm: 'size-4', md: 'size-5', lg: 'size-6', xl: 'size-8' };

/**
 * Ícone da categoria com a cor da categoria.
 *   <CategoryIcon icon={c.icon} color={c.color} code={c.code} variant="tile" />
 */
export function CategoryIcon({ icon, code, color, variant = 'tile', size = 'md', className, label }: CategoryIconProps) {
  const Icon = iconByName(icon ?? (code ? categoryFallback[code].icon : null));
  const hex = categoryColor(code ?? null, color);
  const a11y = label ? { role: 'img' as const, 'aria-label': label } : { 'aria-hidden': true as const };

  if (variant === 'plain') {
    return <Icon {...a11y} className={cn(plain[size], className)} style={{ color: hex }} />;
  }
  return (
    <span
      {...a11y}
      className={cn('inline-flex shrink-0 items-center justify-center border', variant === 'circle' ? 'rounded-full' : 'rounded-xl', box[size], className)}
      style={{ color: hex, backgroundColor: hexAlpha(hex, 0.12), borderColor: hexAlpha(hex, 0.26) }}
    >
      <Icon aria-hidden />
    </span>
  );
}
