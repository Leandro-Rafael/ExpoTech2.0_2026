import type { ReactNode } from 'react';
import { PaginaComAbas } from '@/components/layout/TabbedPage';
import { CabecalhoPagina } from '@/components/ui';
import { AbaCategorias } from '@/features/admin/catalog/CategoriesTab';
import { AbaRecompensas } from '@/features/admin/catalog/RewardsTab';
import { AbaDesafios } from '@/features/admin/catalog/ChallengesTab';
import { AbaMetas, AbaOrganizacoes } from '@/features/admin/catalog/OrgsGoalsTabs';
import { TituloSecao } from '@/features/resident/shared';

function Bloco({ title, children }: { title: string; children: ReactNode }) {
  return <section aria-label={title}><TituloSecao title={title} />{children}</section>;
}

export default function PaginaCatalogo() {
  return (
    <>
      <CabecalhoPagina sobretitulo="Administração" title="Catálogo" description="Materiais, recompensas, desafios, organizações e metas de reciclagem da plataforma." />
      <PaginaComAbas idBase="cat" label="Seções do catálogo" abas={[
        { value: 'categorias', label: 'Categorias', elemento: <AbaCategorias /> },
        {
          value: 'recompensas', label: 'Recompensas e desafios', apelidos: ['desafios'],
          elemento: <div className="space-y-12"><Bloco title="Recompensas"><AbaRecompensas /></Bloco><Bloco title="Desafios"><AbaDesafios /></Bloco></div>,
        },
        {
          value: 'organizacoes', label: 'Organizações e metas', apelidos: ['metas'],
          elemento: <div className="space-y-12"><Bloco title="Organizações"><AbaOrganizacoes /></Bloco><Bloco title="Metas"><AbaMetas /></Bloco></div>,
        },
      ]} />
    </>
  );
}
