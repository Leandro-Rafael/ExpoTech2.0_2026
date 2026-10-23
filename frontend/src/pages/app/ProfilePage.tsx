import { Settings2 } from 'lucide-react';
import { PagePlaceholder } from '@/components/layout/PagePlaceholder';

/** Placeholder — substitua pelo conteúdo real da página (ver CONVENTIONS.md). */
export default function ProfilePage() {
  return (
    <PagePlaceholder
      eyebrow="Conta"
      title="Meu perfil"
      description="Seus dados, organização (turma, empresa, escola) e segurança da conta."
      icon={Settings2}
      emptyTitle="Gerencie sua conta"
      emptyDescription="Atualize seu nome, vincule-se a uma organização e altere sua senha com segurança."
      features={["Nome e organização", "Alteração de senha", "Resumo de nível", "Sessões encerradas ao trocar a senha"]}
    />
  );
}
