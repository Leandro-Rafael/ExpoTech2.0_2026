/**
 * /api/photos — upload multipart (`file`). A imagem é reduzida no navegador e guardada como data: URL.
 * A IA de servidor responde `available=false`, então a UI usa o modelo local (TensorFlow.js).
 */
import type { PhotoUpload } from '@/api/types';
import { banco, agoraIso, type RegistroFoto } from '../db';
import { criado, falha } from '../http';
import { fotoParecida } from '../logic/fraud';
import { rota } from '../server';

const MAX_BYTES = 5 * 1024 * 1024;
const LADO_MAX = 800;

async function detectarTipo(arquivo: Blob): Promise<'image/jpeg' | 'image/png' | null> {
  const inicio = new Uint8Array(await arquivo.slice(0, 8).arrayBuffer());
  if (inicio[0] === 0xff && inicio[1] === 0xd8 && inicio[2] === 0xff) return 'image/jpeg';
  if (inicio[0] === 0x89 && inicio[1] === 0x50 && inicio[2] === 0x4e && inicio[3] === 0x47) return 'image/png';
  return null;
}

async function processarImagem(arquivo: Blob): Promise<{ dataUrl: string; width: number; height: number; hash: string }> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(arquivo);
  } catch {
    throw falha.invalidImage('Não foi possível ler a imagem. Envie um JPEG ou PNG válido.');
  }
  const { width: largura, height: altura } = bitmap;
  const escala = Math.min(1, LADO_MAX / Math.max(largura, altura));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(largura * escala));
  canvas.height = Math.max(1, Math.round(altura * escala));
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL('image/jpeg', 0.72);

  // aHash 8x8: média de cinza → 64 bits (hex) para detectar fotos repetidas
  const pequena = document.createElement('canvas');
  pequena.width = 8;
  pequena.height = 8;
  const sctx = pequena.getContext('2d', { willReadFrequently: true })!;
  sctx.drawImage(bitmap, 0, 0, 8, 8);
  const px = sctx.getImageData(0, 0, 8, 8).data;
  const cinza: number[] = [];
  for (let i = 0; i < px.length; i += 4) cinza.push(0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]);
  const media = cinza.reduce((s, g) => s + g, 0) / cinza.length;
  let hash = '';
  for (let i = 0; i < 64; i += 4) {
    let nibble = 0;
    for (let j = 0; j < 4; j++) nibble = (nibble << 1) | (cinza[i + j] >= media ? 1 : 0);
    hash += nibble.toString(16);
  }
  bitmap.close();
  return { dataUrl, width: largura, height: altura, hash };
}

export function registrarRotasFoto() {
  rota('POST', '/photos', async ({ me, form }) => {
    const arquivo = form?.get('file');
    if (!(arquivo instanceof Blob) || arquivo.size === 0) throw falha.campo('file', 'envie a foto no campo "file"');
    if (arquivo.size > MAX_BYTES) throw falha.invalidImage('A foto deve ter no máximo 5 MB.');
    const tipo = await detectarTipo(arquivo);
    if (!tipo) throw falha.invalidImage('Formato não suportado. Envie JPEG ou PNG.');
    const imagem = await processarImagem(arquivo);
    const d = banco();
    const foto: RegistroFoto = { id: crypto.randomUUID(), ownerId: me.id, dataUrl: imagem.dataUrl, mime: 'image/jpeg', width: imagem.width, height: imagem.height, hash: imagem.hash, createdAt: agoraIso() };
    const duplicada = fotoParecida(d, foto);
    d.photos.push(foto);
    return criado<PhotoUpload>({
      id: foto.id,
      // <img src> não passa pelo fetch interceptado; usamos a própria imagem (data: URL)
      url: imagem.dataUrl,
      width: imagem.width,
      height: imagem.height,
      duplicateSuspected: !!duplicada,
      ai: { available: false, categoryCode: null, confidence: null, reasoning: null, source: null, verified: false },
    });
  });

  rota('GET', '/photos/:id', async ({ me, params }) => {
    const p = banco().photos.find((x) => x.id === params.id);
    if (!p || !p.dataUrl || (p.ownerId !== me.id && me.role !== 'ADMIN' && p.ownerId !== null)) throw falha.notFound('Foto não encontrada.');
    const blob = await (await fetch(p.dataUrl)).blob();
    return { status: 200, blob, headers: { 'Cache-Control': 'private, max-age=3600' } };
  });
}
