import { Users } from 'lucide-react';
import { PagePlaceholder } from '@/components/layout/PagePlaceholder';

/** Placeholder — substitua pelo conteúdo real da página (ver CONVENTIONS.md). */
export default function AdminUsersPage() {
  return (
    <PagePlaceholder
      eyebrow="Administração"
      title="Usuários"
      description="Gerencie perfis de acesso e contas da plataforma."
      icon={Users}
      emptyTitle="A lista de usuários aparece aqui"
      emptyDescription="Busque por nome ou e-mail, altere perfis e habilite ou desabilite contas."
      features={["Busca e filtro por perfil", "Alterar perfil (morador, coletor, admin)", "Habilitar/desabilitar conta", "Último acesso e bloqueios"]}
    />
  );
}
