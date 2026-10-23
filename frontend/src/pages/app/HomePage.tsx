import { Home } from 'lucide-react';
import { PagePlaceholder } from '@/components/layout/PagePlaceholder';

/** Placeholder — substitua pelo conteúdo real da página (ver CONVENTIONS.md). */
export default function HomePage() {
  return (
    <PagePlaceholder
      eyebrow="Smart Home"
      title="Minha casa"
      description="Sua residência conectada: membros, lixeiras inteligentes e coleta automática."
      icon={Home}
      emptyTitle="Conecte sua casa ao Lixo Zero 2050"
      emptyDescription="Crie uma residência ou entre com um código de convite para somar pontos em família."
      features={["Membros e código de convite", "Lixeiras com sensor de nível", "Coleta automática ao atingir o limite", "Estatísticas da residência"]}
    />
  );
}
