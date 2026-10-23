import { Leaf } from 'lucide-react';
import { PagePlaceholder } from '@/components/layout/PagePlaceholder';

/** Placeholder — substitua pelo conteúdo real da página (ver CONVENTIONS.md). */
export default function ImpactPage() {
  return (
    <PagePlaceholder
      eyebrow="Principal"
      title="Impacto e simulador 2050"
      description="Indicadores ambientais calculados a partir dos seus descartes e da comunidade."
      icon={Leaf}
      emptyTitle="Seus indicadores de impacto aparecem aqui"
      emptyDescription="Acompanhe kg reciclados, CO₂ evitado, metas e simule cenários até 2050."
      features={["Gráficos por categoria e mês", "Metas de reciclagem", "Comparativo pessoal × comunidade", "Simulador de cenários até 2050"]}
    />
  );
}
