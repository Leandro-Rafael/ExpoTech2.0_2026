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

async function pickBackend() {
  try {
    if (await tf.setBackend('webgl')) return;
  } catch { /* sem WebGL */ }
  await tf.setBackend('cpu');
}

/** Carrega (uma vez) o modelo. Chamadas seguintes reutilizam a mesma promessa. */
export function loadModel(): Promise<mobilenet.MobileNet> {
  if (!modelPromise) {
    modelPromise = (async () => {
      await pickBackend();
      await tf.ready();
      const model = await mobilenet.load({ version: 2, alpha: 1.0, modelUrl: MODEL_URL, inputRange: [0, 1] });
      // Aquecimento: compila os shaders para a 1ª classificação real ser rápida.
      tf.tidy(() => { model.infer(tf.zeros([224, 224, 3]) as tf.Tensor3D); });
      return model;
    })().catch((e) => { modelPromise = null; throw e; });
  }
  return modelPromise;
}

export async function classify(image: HTMLCanvasElement | HTMLImageElement): Promise<LocalGuess> {
  const model = await loadModel();
  const preds = await model.classify(image, 5);
  return mapPredictions(preds);
}

export function backendName(): string {
  return tf.getBackend() ?? 'cpu';
}
