import { useEffect } from 'react';

/** Define o título da aba: "Descartes · Lixo Zero 2050". */
export function useDocumentTitle(title: string | null | undefined) {
  useEffect(() => {
    document.title = title ? `${title} · Lixo Zero 2050` : 'Lixo Zero 2050 · EcoTech Zero';
  }, [title]);
}
