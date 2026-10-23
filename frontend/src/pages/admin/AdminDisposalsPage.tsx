import { BadgeCheck } from 'lucide-react';
import { PagePlaceholder } from '@/components/layout/PagePlaceholder';

/** Placeholder — substitua pelo conteúdo real da página (ver CONVENTIONS.md). */
export default function AdminDisposalsPage() {
  return (
    <PagePlaceholder
      eyebrow="Administração"
      title="Moderação de descartes"
      description="Aprove ou recuse descartes, com sinais antifraude e sugestão da IA."
      icon={BadgeCheck}
      emptyTitle="Nenhum descarte aguardando análise"
      emptyDescription="Os descartes enviados pelos moradores aparecem aqui para revisão."
      features={["Fila de pendentes", "Filtro de suspeitos (antifraude)", "Corrigir categoria e quantidade", "Recusa com motivo"]}
    />
  );
}
