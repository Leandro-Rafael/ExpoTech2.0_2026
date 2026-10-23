import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { CheckCircle2 } from 'lucide-react';
import { Card, EmptyState, PageHeader } from '@/components/ui';

export interface PagePlaceholderProps {
  eyebrow: string;
  title: string;
  description: string;
  icon: LucideIcon;
  emptyTitle: string;
  emptyDescription: string;
  /** Recursos previstos para a tela (mostrados como lista). */
  features?: string[];
  action?: ReactNode;
}

/**
 * Esqueleto visual provisório de uma página (PageHeader + EmptyState).
 * As páginas reais substituem este componente por completo.
 */
export function PagePlaceholder({ eyebrow, title, description, icon, emptyTitle, emptyDescription, features, action }: PagePlaceholderProps) {
  return (
    <>
      <PageHeader eyebrow={eyebrow} title={title} description={description} icon={icon} />
      <Card padding="none" className="overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0 grid-bg opacity-60" />
        <EmptyState icon={icon} title={emptyTitle} description={emptyDescription} action={action}>
          {features && features.length > 0 && (
            <ul className="mx-auto grid max-w-2xl gap-2 text-left sm:grid-cols-2">
              {features.map((f) => (
                <li key={f} className="flex items-start gap-2.5 rounded-xl border border-line bg-bg-deep/40 px-3.5 py-3 text-sm text-fg-soft">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-brand-300" aria-hidden />
                  {f}
                </li>
              ))}
            </ul>
          )}
        </EmptyState>
      </Card>
    </>
  );
}
