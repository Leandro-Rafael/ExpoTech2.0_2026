import { Medal } from 'lucide-react';
import { PagePlaceholder } from '@/components/layout/PagePlaceholder';

/** Placeholder — substitua pelo conteúdo real da página (ver CONVENTIONS.md). */
export default function AchievementsPage() {
  return (
    <PagePlaceholder
      eyebrow="Comunidade"
      title="Conquistas"
      description="Níveis, medalhas e desafios que tornam a reciclagem um hábito."
      icon={Medal}
      emptyTitle="Suas medalhas aparecem aqui"
      emptyDescription="Complete desafios e mantenha sua sequência de descartes para desbloquear conquistas."
      features={["Trilha de níveis", "Medalhas por categoria", "Desafios com progresso", "Sequência de dias"]}
    />
  );
}
