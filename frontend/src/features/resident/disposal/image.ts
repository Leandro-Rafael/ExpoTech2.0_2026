/**
 * Prepara a foto no navegador antes do upload:
 *  - respeita a orientação EXIF (fotos de celular "deitadas");
 *  - reduz para no máx. 1600 px no maior lado e re-codifica em JPEG ~0,85
 *    (remove metadados como GPS embutido e garante < 5 MB).
 */
const LADO_MAXIMO = 1600;
const QUALIDADE_JPEG = 0.85;
/** Limite do arquivo ORIGINAL (antes da compressão). */
const BYTES_MAXIMOS_ORIGINAL = 30 * 1024 * 1024;

export interface FotoPreparada {
  blob: Blob;
  width: number;
  height: number;
  /** URL local (objectURL) para pré-visualização — revogue ao descartar. */
  previewUrl: string;
  /** Canvas reduzido (≤ 448 px) para o classificador local. */
  thumb: HTMLCanvasElement;
}

export class ErroFoto extends Error {}

async function decodificar(arquivo: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(arquivo, { imageOrientation: 'from-image' });
    } catch {
      try { return await createImageBitmap(arquivo); } catch { /* tenta <img> */ }
    }
  }
  // Fallback: <img> (navegadores modernos já aplicam a orientação EXIF por padrão).
  const url = URL.createObjectURL(arquivo);
  try {
    const imagem = new Image();
    imagem.decoding = 'async';
    imagem.src = url;
    await imagem.decode();
    return imagem;
  } catch {
    throw new ErroFoto('Não conseguimos abrir esta imagem. Use uma foto JPEG ou PNG.');
  } finally {
    URL.revokeObjectURL(url);
  }
}

function paraBlob(tela: HTMLCanvasElement, tipo: string, qualidade: number): Promise<Blob> {
  return new Promise((resolve, reject) => tela.toBlob((b) => (b ? resolve(b) : reject(new ErroFoto('Falha ao processar a foto.'))), tipo, qualidade));
}

export async function prepararFoto(arquivo: File): Promise<FotoPreparada> {
  if (!arquivo.type.startsWith('image/')) throw new ErroFoto('Selecione um arquivo de imagem (JPEG ou PNG).');
  if (arquivo.size > BYTES_MAXIMOS_ORIGINAL) throw new ErroFoto('Esta imagem é muito grande (máx. 30 MB).');

  const origem = await decodificar(arquivo);
  const larguraOriginal = 'naturalWidth' in origem ? origem.naturalWidth : origem.width;
  const alturaOriginal = 'naturalHeight' in origem ? origem.naturalHeight : origem.height;
  if (!larguraOriginal || !alturaOriginal) throw new ErroFoto('Imagem vazia ou corrompida.');
  if (Math.min(larguraOriginal, alturaOriginal) < 120) throw new ErroFoto('A foto é pequena demais para identificar o material. Aproxime-se do objeto.');

  const escala = Math.min(1, LADO_MAXIMO / Math.max(larguraOriginal, alturaOriginal));
  const largura = Math.round(larguraOriginal * escala);
  const altura = Math.round(alturaOriginal * escala);
  const tela = document.createElement('canvas');
  tela.width = largura;
  tela.height = altura;
  const ctx = tela.getContext('2d');
  if (!ctx) throw new ErroFoto('Seu navegador não conseguiu processar a imagem.');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(origem, 0, 0, largura, altura);
  if ('close' in origem) origem.close();

  const blob = await paraBlob(tela, 'image/jpeg', QUALIDADE_JPEG);

  const escalaMiniatura = Math.min(1, 448 / Math.max(largura, altura));
  const miniatura = document.createElement('canvas');
  miniatura.width = Math.round(largura * escalaMiniatura);
  miniatura.height = Math.round(altura * escalaMiniatura);
  miniatura.getContext('2d')!.drawImage(tela, 0, 0, miniatura.width, miniatura.height);
  tela.width = tela.height = 0; // libera memória

  return { blob, width: largura, height: altura, previewUrl: URL.createObjectURL(blob), thumb: miniatura };
}
