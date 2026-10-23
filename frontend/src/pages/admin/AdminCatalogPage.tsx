import { Boxes } from 'lucide-react';
import { PagePlaceholder } from '@/components/layout/PagePlaceholder';

/** Placeholder — substitua pelo conteúdo real da página (ver CONVENTIONS.md). */
export default function AdminCatalogPage() {
  return (
    <PagePlaceholder
      eyebrow="Administração"
      title="Catálogo"
      description="Categorias de resíduo, recompensas, desafios, organizações e metas."
      icon={Boxes}
      emptyTitle="O catálogo aparece aqui"
      emptyDescription="Configure pontos por kg, fatores de CO₂, recompensas e desafios da comunidade."
      features={["Categorias e orientações", "Recompensas e estoque", "Desafios e bônus", "Organizações e metas anuais"]}
    />
  );
}
