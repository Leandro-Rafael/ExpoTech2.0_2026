import type { ReactNode } from 'react';
import { TabbedPage } from '@/components/layout/TabbedPage';
import { PageHeader } from '@/components/ui';
import { CategoriesTab } from '@/features/admin/catalog/CategoriesTab';
import { RewardsTab } from '@/features/admin/catalog/RewardsTab';
import { ChallengesTab } from '@/features/admin/catalog/ChallengesTab';
import { GoalsTab, OrganizationsTab } from '@/features/admin/catalog/OrgsGoalsTabs';
import { SectionHeading } from '@/features/resident/shared';

function Block({ title, children }: { title: string; children: ReactNode }) {
  return <section aria-label={title}><SectionHeading title={title} />{children}</section>;
}

export default function AdminCatalogPage() {
  return (
    <>
      <PageHeader eyebrow="Administração" title="Catálogo" description="Materiais, recompensas, desafios, organizações e metas de reciclagem da plataforma." />
      <TabbedPage idBase="cat" label="Seções do catálogo" tabs={[
        { value: 'categorias', label: 'Categorias', element: <CategoriesTab /> },
        {
          value: 'recompensas', label: 'Recompensas e desafios', aliases: ['desafios'],
          element: <div className="space-y-12"><Block title="Recompensas"><RewardsTab /></Block><Block title="Desafios"><ChallengesTab /></Block></div>,
        },
        {
          value: 'organizacoes', label: 'Organizações e metas', aliases: ['metas'],
          element: <div className="space-y-12"><Block title="Organizações"><OrganizationsTab /></Block><Block title="Metas"><GoalsTab /></Block></div>,
        },
      ]} />
    </>
  );
}
