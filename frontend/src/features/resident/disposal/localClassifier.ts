/**
 * Classificador LOCAL (no navegador) com TensorFlow.js + MobileNet v2 (α 1,0).
 * Os pesos ficam em /public/models/mobilenet (≈ 14 MB) — funciona OFFLINE na feira.
 * Este módulo é importado dinamicamente: tfjs só baixa quando a IA local é necessária.
 */
import * as tf from '@tensorflow/tfjs';
import * as mobilenet from '@tensorflow-models/mobilenet';
import { mapearPrevisoes, type PalpiteLocal } from './labelMap';

const URL_MODELO = `${import.meta.env.BASE_URL}models/mobilenet/model.json`;

let promessaModelo: Promise<mobilenet.MobileNet> | null = null;
let ultimoProgresso = 0;
const ouvintes = new Set<(p: number) => void>();

// Usa a placa de vídeo (WebGL) quando existe; senão roda no processador, mais devagar.
async function escolherBackend() {
  try {
    if (await tf.setBackend('webgl')) return;
  } catch { /* sem WebGL */ }
  await tf.setBackend('cpu');
}

export function modeloCarregado() {
  return ultimoProgresso >= 1 && promessaModelo != null;
}

/** Carrega (uma vez) o modelo; `onProgress` recebe 0..1 do download dos pesos. */
function carregarModelo(aoProgredir?: (p: number) => void): Promise<mobilenet.MobileNet> {
  if (aoProgredir) { ouvintes.add(aoProgredir); aoProgredir(ultimoProgresso); }
  if (!promessaModelo) {
    promessaModelo = (async () => {
      await escolherBackend();
      await tf.ready();
      const manipulador = tf.io.http(URL_MODELO, {
        onProgress: (p: number) => { ultimoProgresso = p; ouvintes.forEach((l) => l(p)); },
      });
      const modelo = await mobilenet.load({ version: 2, alpha: 1.0, modelUrl: manipulador, inputRange: [0, 1] });
      ultimoProgresso = 1;
      ouvintes.forEach((l) => l(1));
      // Aquecimento: compila os shaders para a 1ª classificação real ser rápida.
      tf.tidy(() => { modelo.infer(tf.zeros([224, 224, 3]) as tf.Tensor3D); });
      return modelo;
    })().catch((e) => { promessaModelo = null; ultimoProgresso = 0; throw e; });
  }
  const p = promessaModelo;
  return aoProgredir ? p.finally(() => ouvintes.delete(aoProgredir)) : p;
}

export async function classificar(imagem: HTMLCanvasElement | HTMLImageElement, aoProgredir?: (p: number) => void): Promise<PalpiteLocal> {
  // 1. Carrega o modelo (só baixa na primeira vez; depois fica em memória).
  const modelo = await carregarModelo(aoProgredir);
  // 2. O MobileNet devolve os 5 objetos do ImageNet mais prováveis (ex.: "water bottle", 62%).
  const previsoes = await modelo.classify(imagem, 5);
  // 3. Traduz esses rótulos para uma categoria nossa (Plástico, Vidro...) com confiança e explicação.
  return mapearPrevisoes(previsoes);
}

