/**
 * Classificador LOCAL (no navegador) com TensorFlow.js + MobileNet v2 (α 1,0).
 * Os pesos ficam em /public/models/mobilenet (≈ 14 MB) — funciona OFFLINE na feira.
 * Este módulo é importado dinamicamente: tfjs só baixa quando a IA local é necessária.
 */
import * as tf from '@tensorflow/tfjs';
import * as mobilenet from '@tensorflow-models/mobilenet';
import { mapPredictions, type LocalGuess } from './labelMap';

const MODEL_URL = `${import.meta.env.BASE_URL}models/mobilenet/model.json`;

let modelPromise: Promise<mobilenet.MobileNet> | null = null;
let lastProgress = 0;
const listeners = new Set<(p: number) => void>();

async function pickBackend() {
  try {
    if (await tf.setBackend('webgl')) return;
  } catch { /* sem WebGL */ }
  await tf.setBackend('cpu');
}

export function isModelLoaded() {
  return lastProgress >= 1 && modelPromise != null;
}

/** Carrega (uma vez) o modelo; `onProgress` recebe 0..1 do download dos pesos. */
export function loadModel(onProgress?: (p: number) => void): Promise<mobilenet.MobileNet> {
  if (onProgress) { listeners.add(onProgress); onProgress(lastProgress); }
  if (!modelPromise) {
    modelPromise = (async () => {
      await pickBackend();
      await tf.ready();
      const handler = tf.io.http(MODEL_URL, {
        onProgress: (p: number) => { lastProgress = p; listeners.forEach((l) => l(p)); },
      });
      const model = await mobilenet.load({ version: 2, alpha: 1.0, modelUrl: handler, inputRange: [0, 1] });
      lastProgress = 1;
      listeners.forEach((l) => l(1));
      // Aquecimento: compila os shaders para a 1ª classificação real ser rápida.
      tf.tidy(() => { model.infer(tf.zeros([224, 224, 3]) as tf.Tensor3D); });
      return model;
    })().catch((e) => { modelPromise = null; lastProgress = 0; throw e; });
  }
  const p = modelPromise;
  return onProgress ? p.finally(() => listeners.delete(onProgress)) : p;
}

export async function classify(image: HTMLCanvasElement | HTMLImageElement, onProgress?: (p: number) => void): Promise<LocalGuess> {
  const model = await loadModel(onProgress);
  const preds = await model.classify(image, 5);
  return mapPredictions(preds);
}

export function backendName(): string {
  return tf.getBackend() ?? 'cpu';
}
