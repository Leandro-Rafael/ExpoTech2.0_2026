import { Trash2 } from 'lucide-react';
import { PagePlaceholder } from '@/components/layout/PagePlaceholder';

/** Placeholder — substitua pelo conteúdo real da página (ver CONVENTIONS.md). */
export default function AdminBinsPage() {
  return (
    <PagePlaceholder
      eyebrow="Administração"
      title="Lixeiras inteligentes"
      description="Monitoramento de todas as lixeiras conectadas das residências."
      icon={Trash2}
      emptyTitle="Nenhuma lixeira conectada"
      emptyDescription="As lixeiras cadastradas pelos moradores aparecem aqui com nível, bateria e status."
      features={["Nível e bateria em tempo real", "Status: normal, atenção, cheia, offline", "Histórico de leituras", "Filtro por residência"]}
    />
  );
}
