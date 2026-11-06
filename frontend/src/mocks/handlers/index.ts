// Modo demo: junta as rotas falsas de cada assunto (auth, descartes, admin...) no roteador de mocks/server.ts.
import { registrarRotasAdmin } from './admin';
import { registrarRotasAuth } from './auth';
import { registrarRotasColeta } from './collection';
import { registrarRotasDescarte } from './disposals';
import { registrarRotasGamificacao } from './gamification';
import { registrarRotasResidencia } from './household';
import { registrarRotasColetor, registrarRotasImpacto } from './impact';
import { registrarRotasFoto } from './photos';
import { registrarRotasPerfil } from './profile';
import { registrarRotasSeguranca } from './security';

let registrado = false;

/** Registra todas as rotas do contrato (docs/API.md). */
export function registrarTodasAsRotas() {
  if (registrado) return;
  registrado = true;
  registrarRotasAuth();
  registrarRotasPerfil();
  registrarRotasFoto();
  registrarRotasDescarte();
  registrarRotasGamificacao();
  registrarRotasColeta();
  registrarRotasResidencia();
  registrarRotasImpacto();
  registrarRotasColetor();
  registrarRotasAdmin();
  registrarRotasSeguranca();
}
