import { ScanLine } from 'lucide-react';
import { PagePlaceholder } from '@/components/layout/PagePlaceholder';

/** Placeholder — substitua pelo conteúdo real da página (ver CONVENTIONS.md). */
export default function NewDisposalPage() {
  return (
    <PagePlaceholder
      eyebrow="Principal"
      title="Registrar descarte"
      description="Fotografe o resíduo, confirme a categoria sugerida pela IA e informe a quantidade."
      icon={ScanLine}
      emptyTitle="Pronto para registrar seu resíduo"
      emptyDescription="Envie uma foto e a IA sugere a categoria. Você pode corrigir antes de enviar."
      features={["Foto com identificação por IA", "Orientações de descarte correto", "Quantidade em kg e localização", "Proteção contra envio duplicado"]}
    />
  );
}
