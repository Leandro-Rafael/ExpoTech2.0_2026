import { api, photoUrl } from './client';
import type { PhotoUpload, UUID } from './types';

/** /api/photos — upload multipart (campo `file`) com sugestão de IA. */
export const photosApi = {
  upload: (file: File | Blob, signal?: AbortSignal) => api.upload<PhotoUpload>('/photos', { file }, { signal }),
  /** URL para <img src>. A imagem é servida com cookie (mesma origem). */
  url: (id: UUID) => photoUrl(id),
};
