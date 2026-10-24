/**
 * /api/photos — upload multipart (`file`). A imagem é reduzida no navegador e guardada como data: URL.
 * A IA de servidor responde `available=false`, então a UI usa o modelo local (TensorFlow.js).
 */
import type { PhotoUpload } from '@/api/types';
import { db, nowIso, type PhotoRec } from '../db';
import { created, fail } from '../http';
import { similarPhoto } from '../logic/fraud';
import { route } from '../server';

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_SIDE = 800;

async function sniffType(file: Blob): Promise<'image/jpeg' | 'image/png' | null> {
  const head = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return 'image/jpeg';
  if (head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47) return 'image/png';
  return null;
}

async function processImage(file: Blob): Promise<{ dataUrl: string; width: number; height: number; hash: string }> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw fail.invalidImage('Não foi possível ler a imagem. Envie um JPEG ou PNG válido.');
  }
  const { width, height } = bitmap;
  const scale = Math.min(1, MAX_SIDE / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL('image/jpeg', 0.72);

  // aHash 8x8: média de cinza → 64 bits (hex) para detectar fotos repetidas
  const small = document.createElement('canvas');
  small.width = 8;
  small.height = 8;
  const sctx = small.getContext('2d', { willReadFrequently: true })!;
  sctx.drawImage(bitmap, 0, 0, 8, 8);
  const px = sctx.getImageData(0, 0, 8, 8).data;
  const gray: number[] = [];
  for (let i = 0; i < px.length; i += 4) gray.push(0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]);
  const avg = gray.reduce((s, g) => s + g, 0) / gray.length;
  let hash = '';
  for (let i = 0; i < 64; i += 4) {
    let nibble = 0;
    for (let j = 0; j < 4; j++) nibble = (nibble << 1) | (gray[i + j] >= avg ? 1 : 0);
    hash += nibble.toString(16);
  }
  bitmap.close();
  return { dataUrl, width, height, hash };
}

export function registerPhotoRoutes() {
  route('POST', '/photos', async ({ me, form }) => {
    const file = form?.get('file');
    if (!(file instanceof Blob) || file.size === 0) throw fail.field('file', 'envie a foto no campo "file"');
    if (file.size > MAX_BYTES) throw fail.invalidImage('A foto deve ter no máximo 5 MB.');
    const type = await sniffType(file);
    if (!type) throw fail.invalidImage('Formato não suportado. Envie JPEG ou PNG.');
    const img = await processImage(file);
    const d = db();
    const photo: PhotoRec = { id: crypto.randomUUID(), ownerId: me.id, dataUrl: img.dataUrl, mime: 'image/jpeg', width: img.width, height: img.height, hash: img.hash, createdAt: nowIso() };
    const duplicate = similarPhoto(d, photo);
    d.photos.push(photo);
    return created<PhotoUpload>({
      id: photo.id,
      // <img src> não passa pelo fetch interceptado; usamos a própria imagem (data: URL)
      url: img.dataUrl,
      width: img.width,
      height: img.height,
      duplicateSuspected: !!duplicate,
      ai: { available: false, categoryCode: null, confidence: null, reasoning: null, source: null, verified: false },
    });
  });

  route('GET', '/photos/:id', async ({ me, params }) => {
    const p = db().photos.find((x) => x.id === params.id);
    if (!p || !p.dataUrl || (p.ownerId !== me.id && me.role !== 'ADMIN' && p.ownerId !== null)) throw fail.notFound('Foto não encontrada.');
    const blob = await (await fetch(p.dataUrl)).blob();
    return { status: 200, blob, headers: { 'Cache-Control': 'private, max-age=3600' } };
  });
}
