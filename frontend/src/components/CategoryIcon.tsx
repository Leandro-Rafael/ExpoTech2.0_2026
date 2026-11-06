import type { CategoryCode } from '@/api/types';
import { cn } from '@/lib/cn';
import { corDaCategoria, hexComAlfa } from '@/lib/category';
import { categoriaPadrao } from '@/lib/labels';
import { iconePorNome } from './icons';

export interface PropsIconeCategoria {
  /** Category.icon (nome lucide). Se omitido, usa o padrão do código. */
  icon?: string | null;
  codigo?: CategoryCode | null;
  /** Category.color (hex). */
  cor?: string | null;
  /** plain: só o ícone colorido; tile: quadrado tingido; circle: círculo tingido. */
  variant?: 'plain' | 'tile' | 'circle';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  /** Rótulo acessível (ex.: nome da categoria). Sem ele, o ícone é decorativo. */
  label?: string;
}

const caixa = { sm: 'size-8 [&_svg]:size-4', md: 'size-10 [&_svg]:size-5', lg: 'size-12 [&_svg]:size-6', xl: 'size-16 [&_svg]:size-8' };
const simples = { sm: 'size-4', md: 'size-5', lg: 'size-6', xl: 'size-8' };

/**
 * Ícone da categoria com a cor da categoria.
 *   <CategoryIcon icon={c.icon} color={c.color} code={c.code} variant="tile" />
 */
export function IconeCategoria({ icon, codigo, cor, variant = 'tile', size = 'md', className, label }: PropsIconeCategoria) {
  const Icone = iconePorNome(icon ?? (codigo ? categoriaPadrao[codigo].icon : null));
  const hex = corDaCategoria(codigo ?? null, cor);
  const acessivel = label ? { role: 'img' as const, 'aria-label': label } : { 'aria-hidden': true as const };

  if (variant === 'plain') {
    return <Icone {...acessivel} className={cn(simples[size], className)} style={{ color: hex }} />;
  }
  return (
    <span
      {...acessivel}
      className={cn('inline-flex shrink-0 items-center justify-center border', variant === 'circle' ? 'rounded-full' : 'rounded-xl', caixa[size], className)}
      style={{ color: hex, backgroundColor: hexComAlfa(hex, 0.12), borderColor: hexComAlfa(hex, 0.26) }}
    >
      <Icone aria-hidden />
    </span>
  );
}
