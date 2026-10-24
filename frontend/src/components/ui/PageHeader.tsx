import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { ArrowLeft, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

export interface PageHeaderProps {
  title: string;
  description?: ReactNode;
  /** Rótulo mono acima do título (seção), ex.: "Principal". */
  eyebrow?: ReactNode;
  /** Ícone discreto ao lado do rótulo. */
  icon?: LucideIcon;
  /** Botões à direita (no celular quebram para baixo). Um primário no máximo. */
  actions?: ReactNode;
  back?: { to: string; label?: string };
  /** Define document.title (padrão: true). */
  setTitle?: boolean;
  className?: string;
  children?: ReactNode;
}

/** Cabeçalho padrão de página: rótulo mono + título serifado + descrição curta. */
export function PageHeader({ title, description, eyebrow, icon: Icon, actions, back, setTitle = true, className, children }: PageHeaderProps) {
  useDocumentTitle(setTitle ? title : null);
  return (
    <header className={cn('mb-8 sm:mb-10', className)}>
      {back && (
        <Link to={back.to} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg">
          <ArrowLeft className="size-4" aria-hidden /> {back.label ?? 'Voltar'}
        </Link>
      )}
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          {eyebrow && (
            <p className="label-mono mb-3 flex items-center gap-2">
              {Icon && <Icon className="size-3.5" aria-hidden />}
              {eyebrow}
            </p>
          )}
          <h1 className="text-[clamp(2rem,1.55rem+1.5vw,2.75rem)] leading-[1.08] text-fg">{title}</h1>
          {description && <p className="mt-3 max-w-[60ch] text-[15px] leading-relaxed text-muted sm:text-base">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children && <div className="mt-6">{children}</div>}
    </header>
  );
}
