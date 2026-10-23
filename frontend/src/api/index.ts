/** Ponto de entrada da camada de API. Tipos: import type { ... } from '@/api/types'. */
export * from './client';
export * from './forms';
export * from './queries';
export { profileApi } from './profile';
export { categoriesApi } from './catalog';
export { photosApi, MAX_PHOTO_BYTES, ACCEPTED_PHOTO_TYPES } from './photos';
export { disposalsApi } from './disposals';
export { gamificationApi } from './gamification';
export { rewardsApi } from './rewards';
export { collectionApi } from './collection';
export { householdApi } from './household';
export { impactApi } from './impact';
export { collectorApi } from './collector';
export { adminApi } from './admin';
