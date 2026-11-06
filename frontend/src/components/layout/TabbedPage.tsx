// Tela com abas usada pelos hubs (app/hubs.tsx). A aba aberta fica na URL (?aba=), então o link pode ser compartilhado.
import { Suspense, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import { EsqueletoPagina, PainelAba, Abas } from '@/components/ui';

export interface AbaPagina {
  value: string;
  label: string;
  count?: number;
  /** Valores antigos de ?aba= que levam a esta aba. */
  apelidos?: string[];
  elemento: ReactNode;
}

/** Troca a aba da página atual (?aba=). */
export function useTrocarAba() {
  const [, setParametros] = useSearchParams();
  return (aba: string) => setParametros({ aba }, { replace: true });
}

/** Junta conteúdos relacionados em uma tela só; a aba aberta fica na URL (?aba=). */
export function PaginaComAbas({ idBase, label, abas }: { idBase: string; label: string; abas: AbaPagina[] }) {
  // 1. Lê o ?aba= da URL.
  const [parametros] = useSearchParams();
  const trocarAba = useTrocarAba();
  const aba = parametros.get('aba') ?? '';
  // 2. Acha a aba (aceita nomes antigos em `aliases`); se não achar, abre a primeira.
  const abaAtual = abas.find((t) => t.value === aba || t.apelidos?.includes(aba)) ?? abas[0];

  // 3. Clicar numa aba só muda a URL; a página redesenha com a nova aba (carregada sob demanda).
  return (
    <>
      <Abas idBase={idBase} aria-label={label} variant="underline" className="mb-8"
        itens={abas.map(({ value, label, count }) => ({ value, label, count }))} value={abaAtual.value} onChange={trocarAba} />
      <PainelAba idBase={idBase} value={abaAtual.value}>
        <Suspense fallback={<EsqueletoPagina />}>{abaAtual.elemento}</Suspense>
      </PainelAba>
    </>
  );
}
