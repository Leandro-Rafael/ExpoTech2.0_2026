/** Prioridade (0..100) de uma solicitação de coleta aberta — mesma fórmula do PriorityCalculator do back-end. */
import type { CategoryCode } from '@/api/types';
import { DAY, localDate } from './dates';

export function priority(
  estimatedKg: number,
  createdAt: string,
  categories: CategoryCode[],
  binFillLevel: number | null,
  preferredDate: string | null,
  now = Date.now(),
): number {
  let score = 20;
  score += Math.min(30, (Math.max(0, estimatedKg) / 100) * 30);
  const ageDays = Math.max(0, Math.floor((now - Date.parse(createdAt)) / DAY));
  score += Math.min(25, ageDays * 5);
  if (categories.includes('ELETRONICO')) score += 15;
  if (binFillLevel !== null) score += Math.max(0, Math.min(25, (binFillLevel - 50) / 2));
  if (preferredDate && preferredDate <= localDate(new Date(now))) score += 10;
  return Math.round(Math.max(0, Math.min(100, score)));
}
