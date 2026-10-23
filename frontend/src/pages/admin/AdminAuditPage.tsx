import { ScrollText } from 'lucide-react';
import { PagePlaceholder } from '@/components/layout/PagePlaceholder';

/** Placeholder — substitua pelo conteúdo real da página (ver CONVENTIONS.md). */
export default function AdminAuditPage() {
  return (
    <PagePlaceholder
      eyebrow="Administração"
      title="Auditoria"
      description="Registro imutável de ações sensíveis na plataforma."
      icon={ScrollText}
      emptyTitle="Nenhum evento registrado"
      emptyDescription="Logins, aprovações, resgates e alterações administrativas ficam registrados aqui."
      features={["Quem fez, o quê e quando", "Endereço IP", "Detalhes da entidade", "Paginação"]}
    />
  );
}
