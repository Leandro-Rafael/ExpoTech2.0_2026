import { MapPinned } from 'lucide-react';
import { PagePlaceholder } from '@/components/layout/PagePlaceholder';

/** Placeholder — substitua pelo conteúdo real da página (ver CONVENTIONS.md). */
export default function AdminCollectionPointsPage() {
  return (
    <PagePlaceholder
      eyebrow="Administração"
      title="Ecopontos"
      description="Cadastro e manutenção dos pontos de coleta seletiva."
      icon={MapPinned}
      emptyTitle="Nenhum ecoponto cadastrado"
      emptyDescription="Cadastre locais de coleta com endereço, horário e materiais aceitos."
      features={["Cadastro com mapa", "Materiais aceitos", "Horários de funcionamento", "Ativar/desativar"]}
    />
  );
}
