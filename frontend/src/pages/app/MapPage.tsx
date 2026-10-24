import { useState } from 'react';
import { useMyCollectionRequests } from '@/api/queries';
import { PageHeader, TabPanel, Tabs } from '@/components/ui';
import { Ecopoints } from '@/features/resident/map/Ecopoints';
import { MyRequests, RequestForm } from '@/features/resident/map/Requests';

type View = 'points' | 'request' | 'mine';

export default function MapPage() {
  const [view, setView] = useState<View>('points');
  const requests = useMyCollectionRequests();
  const open = requests.data?.filter((r) => r.status !== 'COLLECTED' && r.status !== 'CANCELLED').length ?? 0;
  return (
    <>
      <PageHeader eyebrow="Mapa inteligente" title="Ecopontos e coletas"
        description="Encontre onde descartar cada material, veja horários e rotas — ou peça uma coleta na sua porta." />
      <Tabs idBase="mp" aria-label="Seções do mapa" variant="underline" value={view} onChange={setView} className="mb-6"
        items={[
          { value: 'points', label: 'Ecopontos' },
          { value: 'request', label: 'Solicitar coleta' },
          { value: 'mine', label: 'Minhas solicitações', count: open || undefined },
        ]} />
      <TabPanel idBase="mp" value={view}>
        {view === 'points' && <Ecopoints />}
        {view === 'request' && <RequestForm onCreated={() => setView('mine')} />}
        {view === 'mine' && <MyRequests onNew={() => setView('request')} />}
      </TabPanel>
    </>
  );
}
