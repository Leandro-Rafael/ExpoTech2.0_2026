import { Gift } from 'lucide-react';
import { PagePlaceholder } from '@/components/layout/PagePlaceholder';

/** Placeholder — substitua pelo conteúdo real da página (ver CONVENTIONS.md). */
export default function RewardsPage() {
  return (
    <PagePlaceholder
      eyebrow="Comunidade"
      title="Recompensas"
      description="Troque seus pontos por benefícios de parceiros locais."
      icon={Gift}
      emptyTitle="O catálogo de recompensas aparece aqui"
      emptyDescription="Acumule pontos com descartes aprovados e resgate vouchers exclusivos."
      features={["Catálogo com estoque", "Resgate com confirmação", "Meus vouchers", "Extrato de pontos"]}
    />
  );
}
