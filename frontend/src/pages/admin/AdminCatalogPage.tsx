import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { PageHeader, TabPanel, Tabs } from '@/components/ui';
import { CategoriesTab } from '@/features/admin/catalog/CategoriesTab';
import { RewardsTab } from '@/features/admin/catalog/RewardsTab';
import { ChallengesTab } from '@/features/admin/catalog/ChallengesTab';
import { GoalsTab, OrganizationsTab } from '@/features/admin/catalog/OrgsGoalsTabs';

const TABS = [
  { value: 'categorias', label: 'Categorias' },
  { value: 'recompensas', label: 'Recompensas' },
  { value: 'desafios', label: 'Desafios' },
  { value: 'organizacoes', label: 'Organizações' },
  { value: 'metas', label: 'Metas' },
] as const;
type TabValue = (typeof TABS)[number]['value'];

export default function AdminCatalogPage() {
  const [params, setParams] = useSearchParams();
  const initial = (TABS.find((t) => t.value === params.get('aba'))?.value ?? 'categorias') as TabValue;
  const [tab, setTab] = useState<TabValue>(initial);
  const change = (v: TabValue) => { setTab(v); setParams({ aba: v }, { replace: true }); };

  return (
    <>
      <PageHeader eyebrow="Administração" title="Catálogo" description="Materiais, recompensas, desafios, organizações e metas de reciclagem da plataforma." />
      <Tabs<TabValue> idBase="cat" variant="underline" items={[...TABS]} value={tab} onChange={change} className="mb-6" aria-label="Seções do catálogo" />
      <TabPanel idBase="cat" value={tab}>
        {tab === 'categorias' && <CategoriesTab />}
        {tab === 'recompensas' && <RewardsTab />}
        {tab === 'desafios' && <ChallengesTab />}
        {tab === 'organizacoes' && <OrganizationsTab />}
        {tab === 'metas' && <GoalsTab />}
      </TabPanel>
    </>
  );
}
