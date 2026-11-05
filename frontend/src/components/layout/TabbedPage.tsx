import { Suspense, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import { PageSkeleton, TabPanel, Tabs } from '@/components/ui';

export interface PageTab {
  value: string;
  label: string;
  count?: number;
  /** Valores antigos de ?aba= que levam a esta aba. */
  aliases?: string[];
  element: ReactNode;
}

/** Troca a aba da página atual (?aba=). */
export function useSetTab() {
  const [, setParams] = useSearchParams();
  return (aba: string) => setParams({ aba }, { replace: true });
}

/** Junta conteúdos relacionados em uma tela só; a aba aberta fica na URL (?aba=). */
export function TabbedPage({ idBase, label, tabs }: { idBase: string; label: string; tabs: PageTab[] }) {
  const [params] = useSearchParams();
  const setTab = useSetTab();
  const aba = params.get('aba') ?? '';
  const current = tabs.find((t) => t.value === aba || t.aliases?.includes(aba)) ?? tabs[0];

  return (
    <>
      <Tabs idBase={idBase} aria-label={label} variant="underline" className="mb-8"
        items={tabs.map(({ value, label, count }) => ({ value, label, count }))} value={current.value} onChange={setTab} />
      <TabPanel idBase={idBase} value={current.value}>
        <Suspense fallback={<PageSkeleton />}>{current.element}</Suspense>
      </TabPanel>
    </>
  );
}
