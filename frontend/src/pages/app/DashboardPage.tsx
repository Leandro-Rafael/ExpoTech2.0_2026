import { LayoutDashboard, ScanLine } from 'lucide-react';
import { PagePlaceholder } from '@/components/layout/PagePlaceholder';
import { ButtonLink } from '@/components/ui';

/** Placeholder — substitua pelo conteúdo real da página (ver CONVENTIONS.md). */
export default function DashboardPage() {
  return (
    <PagePlaceholder
      eyebrow="Principal"
      title="Olá! Este é o seu painel"
      description="Seus pontos, nível, descartes recentes e o impacto da sua casa em um só lugar."
      icon={LayoutDashboard}
      emptyTitle="Seu painel ganha vida com o primeiro descarte"
      emptyDescription="Registre um resíduo para começar a acumular pontos e acompanhar seu impacto ambiental."
      features={["Resumo de pontos e nível", "Descartes recentes com status", "Desafios ativos e sequência", "Impacto do mês: kg e CO₂ evitado"]}
      action={<ButtonLink to="/app/descartar" leftIcon={ScanLine}>Registrar descarte</ButtonLink>}
    />
  );
}
