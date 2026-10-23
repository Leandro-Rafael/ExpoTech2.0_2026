import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { ArrowLeft, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

export interface PageHeaderProps {
  title: string;
  description?: ReactNode;
  /** Texto pequeno acima do título (seção). */
  eyebrow?: ReactNode;
  icon?: LucideIcon;
  /** Botões à direita (no celular quebram para baixo). */
  actions?: ReactNode;
  /** Link "voltar". */
  back?: { to: string; label?: string };
  /** Define document.title (padrão: true). */
  setTitle?: boolean;
  className?: string;
  children?: ReactNode;
}

/** Cabeçalho padrão de página do app. Também define o título da aba. */
export function PageHeader({ title, description, eyebrow, icon: Icon, actions, back, setTitle = true, className, children }: PageHeaderProps) {
  useDocumentTitle(setTitle ? title : null);
  return (
    <header className={cn('mb-6 sm:mb-8', className)}>
      {back && (
        <Link to={back.to} className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg">
          <ArrowLeft className="size-4" aria-hidden /> {back.label ?? 'Voltar'}
        </Link>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          {Icon && (
            <span className="hidden size-12 shrink-0 items-center justify-center rounded-2xl border border-brand-400/25 bg-gradient-to-br from-brand-500/20 to-lime-300/5 text-brand-300 shadow-glow sm:inline-flex">
              <Icon className="size-6" aria-hidden />
            </span>
          )}
          <div className="min-w-0">
            {eyebrow && <p className="mb-1 text-xs font-semibold tracking-[0.14em] text-brand-300 uppercase">{eyebrow}</p>}
            <h1 className="font-display text-2xl font-semibold tracking-tight text-fg sm:text-[32px] sm:leading-tight">{title}</h1>
            {description && <p className="mt-1.5 max-w-2xl text-[15px] text-muted">{description}</p>}
          </div>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children && <div className="mt-5">{children}</div>}
    </header>
  );
}
