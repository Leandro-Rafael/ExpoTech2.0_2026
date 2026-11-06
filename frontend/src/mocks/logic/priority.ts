/** Prioridade (0..100) de uma solicitação de coleta aberta — mesma fórmula do PriorityCalculator do back-end. */
import type { CategoryCode } from '@/api/types';
import { DIA, dataLocal } from './dates';

export function prioridade(
  kgEstimado: number,
  criadoEm: string,
  categorias: CategoryCode[],
  nivelLixeira: number | null,
  dataPreferida: string | null,
  agora = Date.now(),
): number {
  let pontuacao = 20;
  pontuacao += Math.min(30, (Math.max(0, kgEstimado) / 100) * 30);
  const idadeDias = Math.max(0, Math.floor((agora - Date.parse(criadoEm)) / DIA));
  pontuacao += Math.min(25, idadeDias * 5);
  if (categorias.includes('ELETRONICO')) pontuacao += 15;
  if (nivelLixeira !== null) pontuacao += Math.max(0, Math.min(25, (nivelLixeira - 50) / 2));
  if (dataPreferida && dataPreferida <= dataLocal(new Date(agora))) pontuacao += 10;
  return Math.round(Math.max(0, Math.min(100, pontuacao)));
}
