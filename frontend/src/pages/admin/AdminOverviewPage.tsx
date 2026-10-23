import { ShieldCheck } from 'lucide-react';
import { PagePlaceholder } from '@/components/layout/PagePlaceholder';

/** Placeholder — substitua pelo conteúdo real da página (ver CONVENTIONS.md). */
export default function AdminOverviewPage() {
  return (
    <PagePlaceholder
      eyebrow="Administração"
      title="Visão geral"
      description="Indicadores operacionais da plataforma em tempo real."
      icon={ShieldCheck}
      emptyTitle="O painel administrativo aparece aqui"
      emptyDescription="Usuários ativos, descartes pendentes, suspeitas de fraude, coletas e lixeiras que precisam de atenção."
      features={["KPIs da operação", "Descartes dos últimos 14 dias", "Atividade recente (auditoria)", "Exportar relatório CSV"]}
    />
  );
}
