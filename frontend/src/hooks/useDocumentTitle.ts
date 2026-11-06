import { useEffect } from 'react';

/** Define o título da aba: "Descartes · Lixo Zero 2050". */
export function useTituloDocumento(titulo: string | null | undefined) {
  useEffect(() => {
    document.title = titulo ? `${titulo} · Lixo Zero 2050` : 'Lixo Zero 2050 · EcoTech Zero';
  }, [titulo]);
}
