import { registerAdminRoutes } from './admin';
import { registerAuthRoutes } from './auth';
import { registerCollectionRoutes } from './collection';
import { registerDisposalRoutes } from './disposals';
import { registerGamificationRoutes } from './gamification';
import { registerHouseholdRoutes } from './household';
import { registerCollectorRoutes, registerImpactRoutes } from './impact';
import { registerPhotoRoutes } from './photos';
import { registerProfileRoutes } from './profile';

let registered = false;

/** Registra todas as rotas do contrato (docs/API.md). */
export function registerAllRoutes() {
  if (registered) return;
  registered = true;
  registerAuthRoutes();
  registerProfileRoutes();
  registerPhotoRoutes();
  registerDisposalRoutes();
  registerGamificationRoutes();
  registerCollectionRoutes();
  registerHouseholdRoutes();
  registerImpactRoutes();
  registerCollectorRoutes();
  registerAdminRoutes();
}
