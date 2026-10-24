/**
 * Prepara a foto no navegador antes do upload:
 *  - respeita a orientação EXIF (fotos de celular "deitadas");
 *  - reduz para no máx. 1600 px no maior lado e re-codifica em JPEG ~0,85
 *    (remove metadados como GPS embutido e garante < 5 MB).
 */
export const MAX_SIDE = 1600;
export const JPEG_QUALITY = 0.85;
/** Limite do arquivo ORIGINAL (antes da compressão). */
export const MAX_SOURCE_BYTES = 30 * 1024 * 1024;

export interface PreparedPhoto {
  blob: Blob;
  width: number;
  height: number;
  /** URL local (objectURL) para pré-visualização — revogue ao descartar. */
  previewUrl: string;
  /** Canvas reduzido (≤ 448 px) para o classificador local. */
  thumb: HTMLCanvasElement;
}

export class PhotoError extends Error {}

async function decode(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      try { return await createImageBitmap(file); } catch { /* tenta <img> */ }
    }
  }
  // Fallback: <img> (navegadores modernos já aplicam a orientação EXIF por padrão).
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return img;
  } catch {
    throw new PhotoError('Não conseguimos abrir esta imagem. Use uma foto JPEG ou PNG.');
  } finally {
    URL.revokeObjectURL(url);
  }
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new PhotoError('Falha ao processar a foto.'))), type, quality));
}

export async function preparePhoto(file: File): Promise<PreparedPhoto> {
  if (!file.type.startsWith('image/')) throw new PhotoError('Selecione um arquivo de imagem (JPEG ou PNG).');
  if (file.size > MAX_SOURCE_BYTES) throw new PhotoError('Esta imagem é muito grande (máx. 30 MB).');

  const src = await decode(file);
  const w0 = 'naturalWidth' in src ? src.naturalWidth : src.width;
  const h0 = 'naturalHeight' in src ? src.naturalHeight : src.height;
  if (!w0 || !h0) throw new PhotoError('Imagem vazia ou corrompida.');
  if (Math.min(w0, h0) < 120) throw new PhotoError('A foto é pequena demais para identificar o material. Aproxime-se do objeto.');

  const scale = Math.min(1, MAX_SIDE / Math.max(w0, h0));
  const width = Math.round(w0 * scale);
  const height = Math.round(h0 * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new PhotoError('Seu navegador não conseguiu processar a imagem.');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 0, 0, width, height);
  if ('close' in src) src.close();

  const blob = await toBlob(canvas, 'image/jpeg', JPEG_QUALITY);

  const ts = Math.min(1, 448 / Math.max(width, height));
  const thumb = document.createElement('canvas');
  thumb.width = Math.round(width * ts);
  thumb.height = Math.round(height * ts);
  thumb.getContext('2d')!.drawImage(canvas, 0, 0, thumb.width, thumb.height);
  canvas.width = canvas.height = 0; // libera memória

  return { blob, width, height, previewUrl: URL.createObjectURL(blob), thumb };
}
