import { Truck } from 'lucide-react';
import { PagePlaceholder } from '@/components/layout/PagePlaceholder';

/** Placeholder — substitua pelo conteúdo real da página (ver CONVENTIONS.md). */
export default function CollectorRoutesPage() {
  return (
    <PagePlaceholder
      eyebrow="Coletor"
      title="Minhas rotas"
      description="Rotas otimizadas do dia, com paradas em sequência e registro do que foi coletado."
      icon={Truck}
      emptyTitle="Nenhuma rota atribuída"
      emptyDescription="Quando a administração planejar uma rota para você, ela aparece aqui com o trajeto otimizado."
      features={["Rotas planejadas e em andamento", "Mapa com sequência de paradas", "Concluir parada com kg coletado", "Economia de distância da otimização"]}
    />
  );
}
