/**
 * Modo demonstração: API simulada no navegador (sem back-end nem banco).
 * Ativado só com `npm run dev:mock` (vite --mode mock); em produção este módulo nem entra no bundle.
 *
 * Contas: admin@ecotechzero.com.br / EcoTech@2050 · coletor@ecotechzero.com.br / Coletor@2050 ·
 *         morador@ecotechzero.com.br / Morador@2050 (moradores fictícios: Reciclar@2050).
 * Console: `__mockReset()` recria os dados.
 */
import { mountBanner } from './banner';
import { db, resetDb } from './db';
import { registerAllRoutes } from './handlers';
import { installInterceptor } from './server';
import { clearSession } from './session';

function reset() {
  resetDb();
  clearSession();
  location.reload();
}

registerAllRoutes();
installInterceptor();
db(); // semeia/carrega já no boot
(window as Window & { __mockReset?: () => void }).__mockReset = reset;
mountBanner(reset);
console.info('%c[Lixo Zero 2050] Modo demonstração ativo — API simulada no navegador.', 'color:#84cc16;font-weight:600');
