import { Crown } from 'lucide-react';
import { PagePlaceholder } from '@/components/layout/PagePlaceholder';

/** Placeholder — substitua pelo conteúdo real da página (ver CONVENTIONS.md). */
export default function RankingPage() {
  return (
    <PagePlaceholder
      eyebrow="Comunidade"
      title="Ranking"
      description="Compare-se com pessoas, residências, bairros, turmas e empresas."
      icon={Crown}
      emptyTitle="O ranking da comunidade aparece aqui"
      emptyDescription="Veja quem mais recicla na semana, no mês, no ano ou desde sempre."
      features={["Por pessoa, casa, bairro e organização", "Períodos: semana, mês, ano", "Sua posição em destaque", "Pódio animado"]}
    />
  );
}
