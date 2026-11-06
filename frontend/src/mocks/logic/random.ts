/** PRNG determinístico (mulberry32) para gerar o mesmo conjunto de dados a cada semeadura. */
export interface GeradorAleatorio {
  next(): number;
  int(min: number, max: number): number;
  float(min: number, max: number, casas?: number): number;
  pick<T>(itens: readonly T[]): T;
  weighted<T>(itens: readonly (readonly [T, number])[]): T;
  chance(p: number): boolean;
  uuid(): string;
  shuffle<T>(itens: T[]): T[];
}

export function criarGerador(semente: number): GeradorAleatorio {
  let a = semente >>> 0;
  const proximo = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const gerador: GeradorAleatorio = {
    next: proximo,
    int: (min, max) => min + Math.floor(proximo() * (max - min + 1)),
    float: (min, max, casas = 2) => arredondar(min + proximo() * (max - min), casas),
    pick: (itens) => itens[Math.floor(proximo() * itens.length)],
    weighted: (itens) => {
      const total = itens.reduce((s, [, w]) => s + w, 0);
      let r = proximo() * total;
      for (const [item, w] of itens) {
        r -= w;
        if (r <= 0) return item;
      }
      return itens[itens.length - 1][0];
    },
    chance: (p) => proximo() < p,
    uuid: () => {
      const hex = Array.from({ length: 32 }, () => Math.floor(proximo() * 16).toString(16));
      hex[12] = '4';
      hex[16] = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
      const s = hex.join('');
      return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
    },
    shuffle: (itens) => {
      for (let i = itens.length - 1; i > 0; i--) {
        const j = Math.floor(proximo() * (i + 1));
        [itens[i], itens[j]] = [itens[j], itens[i]];
      }
      return itens;
    },
  };
  return gerador;
}

export function arredondar(n: number, casas = 2): number {
  const f = 10 ** casas;
  return Math.round(n * f) / f;
}

/** Atraso artificial (ms) para os estados de carregamento ficarem visíveis. */
export function latenciaMs(): number {
  return 150 + Math.floor(Math.random() * 300);
}

const ALFABETO_CODIGO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function codigoAleatorio(tamanho: number, rnd: () => number = Math.random): string {
  let s = '';
  for (let i = 0; i < tamanho; i++) s += ALFABETO_CODIGO[Math.floor(rnd() * ALFABETO_CODIGO.length)];
  return s;
}
