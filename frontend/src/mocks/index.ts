/**
 * Modo demonstração: API simulada no navegador (sem back-end nem banco).
 * Ativado só com `npm run dev:mock` (vite --mode mock); em produção este módulo nem entra no bundle.
 *
 * Contas: admin@ecotechzero.com.br / EcoTech@2050 · coletor@ecotechzero.com.br / Coleta@2050 ·
 *         morador@ecotechzero.com.br / Recicla@2050 (moradores fictícios: Recicla@2050).
 * Console: `__mockReset()` recria os dados.
 */
import { montarSelo } from './banner';
import { banco, resetarBanco } from './db';
import { registrarTodasAsRotas } from './handlers';
import { instalarInterceptador } from './server';
import { limparSessao } from './session';

function resetar() {
  resetarBanco();
  limparSessao();
  location.reload();
}

registrarTodasAsRotas();
instalarInterceptador();
banco(); // semeia/carrega já no boot
(window as Window & { __mockReset?: () => void }).__mockReset = resetar;
montarSelo(resetar);
console.info('%c[Lixo Zero 2050] Modo demonstração ativo — API simulada no navegador.', 'color:#84cc16;font-weight:600');
