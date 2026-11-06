/**
 * Mapa curado: rótulos do ImageNet (MobileNet) → categorias do Lixo Zero.
 * Comparação por PALAVRA inteira em cada sinônimo do rótulo ("water bottle", "can opener, tin opener"),
 * para evitar falsos positivos como "can" em "candle".
 */
import type { CategoryCode } from '@/api/types';

const PALAVRAS_POR_CATEGORIA: Record<Exclude<CategoryCode, 'REJEITO'>, string[]> = {
  PLASTICO: [
    'water bottle', 'pop bottle', 'soda bottle', 'plastic bag', 'water jug', 'pill bottle', 'lotion', 'sunscreen',
    'packet', 'bucket', 'pail', 'shower cap', 'syringe', 'bubble', 'balloon', 'toothbrush', 'plunger', 'lighter',
    'crate', 'band aid', 'diaper', 'plastic',
  ],
  PAPEL: [
    'carton', 'envelope', 'newspaper', 'paper towel', 'toilet tissue', 'book jacket', 'comic book', 'menu',
    'binder', 'crossword puzzle', 'paper', 'book', 'mailbag', 'tissue', 'cardboard', 'notepad', 'jigsaw puzzle',
  ],
  VIDRO: [
    'wine bottle', 'beer bottle', 'beer glass', 'goblet', 'red wine', 'whiskey jug', 'jar', 'vase', 'perfume',
    'beaker', 'measuring cup', 'pitcher', 'carafe', 'decanter', 'glass', 'mirror',
  ],
  METAL: [
    'can', 'tin', 'milk can', 'hair spray', 'frying pan', 'wok', 'caldron', 'cauldron', 'dutch oven', 'ladle',
    'spatula', 'strainer', 'nail', 'screw', 'padlock', 'chain', 'safety pin', 'thimble', 'coffeepot', 'teapot', 'tin can',
    'can opener', 'corkscrew', 'chain mail', 'steel', 'aluminium', 'aluminum', 'foil', 'cocktail shaker', 'spoon',
  ],
  ORGANICO: [
    'banana', 'orange', 'lemon', 'granny smith', 'apple', 'pineapple', 'strawberry', 'fig', 'pomegranate', 'custard apple',
    'jackfruit', 'corn', 'ear', 'mushroom', 'broccoli', 'cauliflower', 'cucumber', 'zucchini', 'squash', 'acorn squash',
    'butternut squash', 'spaghetti squash', 'bell pepper', 'artichoke', 'head cabbage', 'potato', 'mashed potato',
    'pizza', 'hotdog', 'cheeseburger', 'bagel', 'pretzel', 'french loaf', 'loaf', 'meat loaf', 'burrito', 'guacamole',
    'trifle', 'ice cream', 'acorn', 'hay', 'egg', 'plate', 'consomme', 'hot pot', 'carbonara', 'espresso', 'eggnog',
    'daisy', 'buckeye', 'hip', 'rapeseed', 'coral fungus', 'agaric', 'bolete', 'dough', 'chocolate sauce', 'potpie',
  ],
  ELETRONICO: [
    'cellular telephone', 'cellular phone', 'cellphone', 'mobile phone', 'cell', 'phone', 'dial telephone',
    'laptop', 'notebook', 'notebook computer', 'desktop computer', 'computer keyboard', 'keypad', 'mouse',
    'computer mouse', 'remote control', 'remote', 'monitor', 'screen', 'crt screen', 'television', 'ipod',
    'hand-held computer', 'modem', 'joystick', 'printer', 'loudspeaker', 'hard disc', 'hard disk', 'power drill',
    'electric fan', 'hair drier', 'hand blower', 'toaster', 'microwave', 'radio', 'tape player', 'cassette player',
    'cd player', 'digital clock', 'digital watch', 'calculator', 'switch', 'projector', 'space bar', 'iron',
    'electric guitar', 'polaroid camera', 'reflex camera', 'camera', 'headphone', 'earphone', 'vacuum',
    'washer', 'dishwasher', 'refrigerator', 'stove', 'spotlight', 'lamp', 'table lamp', 'game console', 'oscilloscope',
  ],
};

export interface PalpiteLocal {
  code: CategoryCode;
  confidence: number;
  reasoning: string;
  /** Rótulos brutos (para exibir em "o que a IA viu"). */
  labels: { className: string; probability: number }[];
}

const escaparRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const COMPILADAS = Object.entries(PALAVRAS_POR_CATEGORIA).map(([code, palavras]) => ({
  code: code as CategoryCode,
  re: new RegExp(`(^|[^a-z])(${palavras.map(escaparRegex).join('|')})([^a-z]|$)`, 'i'),
}));

const NOMES_CATEGORIAS: Record<CategoryCode, string> = {
  PLASTICO: 'Plástico', PAPEL: 'Papel', VIDRO: 'Vidro', METAL: 'Metal', ORGANICO: 'Orgânico', ELETRONICO: 'Eletrônico', REJEITO: 'Rejeito',
};

function acharCategoria(rotulo: string): CategoryCode | null {
  const sinonimos = rotulo.toLowerCase().split(/,\s*/);
  for (const sinonimo of sinonimos) {
    for (const { code, re } of COMPILADAS) if (re.test(sinonimo)) return code;
  }
  return null;
}

const porcentagem = (p: number) => `${Math.round(p * 100)}%`;

/** Agrega as probabilidades do top-k por categoria e explica a decisão em português. */
export function mapearPrevisoes(previsoes: { className: string; probability: number }[]): PalpiteLocal {
  // 1. Soma as probabilidades dos rótulos que caem na mesma categoria (ex.: "jar" + "beer bottle" = Vidro).
  const totais = new Map<CategoryCode, { sum: number; best: { className: string; probability: number } }>();
  for (const p of previsoes) {
    const codigo = acharCategoria(p.className);
    if (!codigo) continue;
    const atual = totais.get(codigo);
    if (!atual) totais.set(codigo, { sum: p.probability, best: p });
    else atual.sum += p.probability;
  }
  const ordenadas = [...totais.entries()].sort((a, b) => b[1].sum - a[1].sum);
  const primeira = previsoes[0];
  // 2. Nenhum rótulo reconhecido: sugere Rejeito com confiança baixa, para o morador corrigir.
  if (!ordenadas.length) {
    return {
      code: 'REJEITO',
      confidence: Math.min(0.3, primeira?.probability ?? 0.2),
      reasoning: primeira
        ? `O modelo viu algo parecido com “${primeira.className.split(',')[0]}” (${porcentagem(primeira.probability)}), que não corresponde a um material reciclável conhecido. Sugerimos Rejeito — corrija se souber o material.`
        : 'Não foi possível reconhecer o objeto. Escolha a categoria manualmente.',
      labels: previsoes,
    };
  }
  // 3. Fica com a categoria de maior soma.
  const [codigo, dados] = ordenadas[0];
  // Confiança: probabilidade agregada, com teto para não parecer certeza absoluta.
  const confianca = Math.max(0.05, Math.min(0.97, dados.sum));
  const rotulo = dados.best.className.split(',')[0];
  return {
    code: codigo,
    confidence: confianca,
    reasoning: `Reconhecido como “${rotulo}” (${porcentagem(dados.best.probability)}), um item típico de ${NOMES_CATEGORIAS[codigo].toLowerCase()}.${ordenadas.length > 1 ? ` Também considerado: ${NOMES_CATEGORIAS[ordenadas[1][0]].toLowerCase()} (${porcentagem(ordenadas[1][1].sum)}).` : ''}`,
    labels: previsoes,
  };
}
