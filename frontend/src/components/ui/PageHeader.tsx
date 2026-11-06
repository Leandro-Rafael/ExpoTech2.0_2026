import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { ArrowLeft, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useTituloDocumento } from '@/hooks/useDocumentTitle';

export interface PropsCabecalhoPagina {
  title: string;
  description?: ReactNode;
  /** Rótulo mono acima do título (seção), ex.: "Principal". */
  sobretitulo?: ReactNode;
  /** Ícone discreto ao lado do rótulo. */
  icon?: LucideIcon;
  /** Botões à direita (no celular quebram para baixo). Um primário no máximo. */
  acoes?: ReactNode;
  voltar?: { to: string; label?: string };
  /** Define document.title (padrão: true). */
  definirTitulo?: boolean;
  className?: string;
  children?: ReactNode;
}

/** Cabeçalho padrão de página: rótulo mono + título serifado + descrição curta. */
export function CabecalhoPagina({ title, description, sobretitulo, icon: Icone, acoes, voltar, definirTitulo = true, className, children }: PropsCabecalhoPagina) {
  useTituloDocumento(definirTitulo ? title : null);
  return (
    <header className={cn('mb-8 sm:mb-10', className)}>
      {voltar && (
        <Link to={voltar.to} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg">
          <ArrowLeft className="size-4" aria-hidden /> {voltar.label ?? 'Voltar'}
        </Link>
      )}
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          {sobretitulo && (
            <p className="label-mono mb-3 flex items-center gap-2">
              {Icone && <Icone className="size-3.5" aria-hidden />}
              {sobretitulo}
            </p>
          )}
          <h1 className="text-[clamp(2rem,1.55rem+1.5vw,2.75rem)] leading-[1.08] text-fg">{title}</h1>
          {description && <p className="mt-3 max-w-[60ch] text-[15px] leading-relaxed text-muted sm:text-base">{description}</p>}
        </div>
        {acoes && <div className="flex flex-wrap items-center gap-2">{acoes}</div>}
      </div>
      {children && <div className="mt-6">{children}</div>}
    </header>
  );
}
