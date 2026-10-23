import { Route } from 'lucide-react';
import { PagePlaceholder } from '@/components/layout/PagePlaceholder';

/** Placeholder — substitua pelo conteúdo real da página (ver CONVENTIONS.md). */
export default function AdminCollectionsPage() {
  return (
    <PagePlaceholder
      eyebrow="Administração"
      title="Coletas e rotas"
      description="Solicitações de coleta e planejamento de rotas otimizadas para a frota."
      icon={Route}
      emptyTitle="Nenhuma solicitação de coleta em aberto"
      emptyDescription="Selecione solicitações, otimize a rota e atribua a um coletor."
      features={["Solicitações por status e prioridade", "Otimização de rotas com economia", "Atribuição a coletores", "Acompanhamento das rotas"]}
    />
  );
}
