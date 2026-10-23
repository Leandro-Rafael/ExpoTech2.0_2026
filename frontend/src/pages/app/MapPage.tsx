import { MapPinned } from 'lucide-react';
import { PagePlaceholder } from '@/components/layout/PagePlaceholder';

/** Placeholder — substitua pelo conteúdo real da página (ver CONVENTIONS.md). */
export default function MapPage() {
  return (
    <PagePlaceholder
      eyebrow="Smart Home"
      title="Mapa de ecopontos"
      description="Encontre locais de coleta seletiva perto de você e solicite coletas."
      icon={MapPinned}
      emptyTitle="O mapa interativo aparece aqui"
      emptyDescription="Ecopontos filtrados por distância e tipo de material, com solicitação de coleta em domicílio."
      features={["Filtro por material e raio", "Ordenação por distância", "Solicitar coleta", "Acompanhar minhas coletas"]}
    />
  );
}
