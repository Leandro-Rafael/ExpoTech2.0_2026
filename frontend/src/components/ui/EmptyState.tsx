import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Inbox } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { Tom } from '@/lib/labels';

export interface PropsEstadoVazio {
  icon?: LucideIcon;
  title: ReactNode;
  description?: ReactNode;
  /** Botão(ões) de ação. Use no máximo um primário. */
  acao?: ReactNode;
  /** Só danger/warning mudam a cor do ícone; o resto é neutro. */
  tone?: Extract<Tom, 'brand' | 'lime' | 'danger' | 'warning' | 'info' | 'neutral'>;
  /** Versão menor, para dentro de cards. */
  compacto?: boolean;
  /** Itens extras abaixo (ex.: lista do que a tela terá). */
  children?: ReactNode;
  className?: string;
}

const tomIcone: Record<string, string> = { danger: 'text-danger', warning: 'text-warning' };

/** Estado vazio. `<EmptyState icon={Recycle} title="Nenhum descarte ainda" action={<ButtonLink…/>} />` */
export function EstadoVazio({ icon: Icone = Inbox, title, description, acao, tone = 'neutral', compacto, children, className }: PropsEstadoVazio) {
  return (
    <div className={cn('relative flex flex-col items-center text-center', compacto ? 'px-4 py-8' : 'px-6 py-14 sm:py-20', className)}>
      <div className={cn(
        'mb-5 flex items-center justify-center rounded-xl border border-line-strong bg-surface-2',
        compacto ? 'size-11' : 'size-14', tomIcone[tone] ?? 'text-fg-soft',
      )}>
        <Icone className={compacto ? 'size-5' : 'size-6'} aria-hidden strokeWidth={1.6} />
      </div>
      <h3 className={cn('font-semibold tracking-tight text-fg', compacto ? 'text-base' : 'text-xl')}>{title}</h3>
      {description && <p className={cn('mt-2 max-w-[52ch] text-muted', compacto ? 'text-sm' : 'text-[15px] leading-relaxed')}>{description}</p>}
      {acao && <div className="mt-6 flex flex-wrap items-center justify-center gap-3">{acao}</div>}
      {children && <div className="mt-10 w-full">{children}</div>}
    </div>
  );
}
