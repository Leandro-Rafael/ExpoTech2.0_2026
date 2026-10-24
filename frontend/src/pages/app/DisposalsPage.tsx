import { Recycle, ScanLine } from 'lucide-react';
import { PagePlaceholder } from '@/components/layout/PagePlaceholder';
import { ButtonLink } from '@/components/ui';

/** Placeholder — substitua pelo conteúdo real da página (ver CONVENTIONS.md). */
export default function DisposalsPage() {
  return (
    <PagePlaceholder
      eyebrow="Principal"
      title="Meus descartes"
      description="Histórico completo com status de análise e pontos gerados."
      icon={Recycle}
      emptyTitle="Nenhum descarte por aqui ainda"
      emptyDescription="Quando você registrar resíduos, eles aparecem aqui com o status pendente, aprovado ou recusado."
      features={["Filtro por status", "Pontos estimados e creditados", "Detalhes com foto e motivo de recusa", "Paginação"]}
      action={<ButtonLink to="/app/descartar" variant="secondary" leftIcon={ScanLine}>Registrar descarte</ButtonLink>}
    />
  );
}
