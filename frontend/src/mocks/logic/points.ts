/**
 * Pontos, níveis, medalhas, desafios e sequência — mesmas regras do back-end:
 * - só descartes APROVADOS geram pontos, e uma única vez;
 * - pontos = arredondar(kg × pontosPorKg), mínimo 1, +10% quando a IA confirmou a categoria com foto;
 * - nível pelo total já ganho (totalEarned), saldo (points) é o disponível para resgates.
 */
import type { BadgeTier, Category, CategoryCode, Level } from '@/api/types';
import type { ChallengeRec, DisposalRec, MockDb, TxRec } from '../db';
import { fail } from '../http';
import { DAY, addDays, localDate } from './dates';
import { round } from './random';

// ---------------------------------------------------------------- níveis

export const LEVELS = [
  { index: 0, name: 'Semente', minPoints: 0 },
  { index: 1, name: 'Broto', minPoints: 200 },
  { index: 2, name: 'Muda', minPoints: 600 },
  { index: 3, name: 'Árvore', minPoints: 1500 },
  { index: 4, name: 'Floresta', minPoints: 3500 },
  { index: 5, name: 'Guardião 2050', minPoints: 8000 },
] as const;

export function levelFor(totalEarned: number): Level {
  let current: (typeof LEVELS)[number] = LEVELS[0];
  for (const l of LEVELS) if (totalEarned >= l.minPoints) current = l;
  const next = LEVELS[current.index + 1] ?? null;
  const progress = next ? Math.min(1, (totalEarned - current.minPoints) / (next.minPoints - current.minPoints)) : 1;
  return {
    index: current.index,
    name: current.name,
    minPoints: current.minPoints,
    nextName: next?.name ?? null,
    nextMinPoints: next?.minPoints ?? null,
    progress: round(progress, 4),
  };
}

// ---------------------------------------------------------------- cálculo

export const AI_CONFIRMED_BONUS = 0.1;
export const AI_MIN_CONFIDENCE = 0.6;

export function computePoints(category: Pick<Category, 'pointsPerKg'>, kg: number, aiConfirmed: boolean): number {
  if (kg <= 0) return 0;
  if (category.pointsPerKg <= 0) return 1;
  let base = Math.round(kg * category.pointsPerKg);
  if (aiConfirmed) base = Math.round(base * (1 + AI_CONFIRMED_BONUS));
  return Math.max(1, base);
}

export function aiConfirmed(d: DisposalRec, category: Category): boolean {
  return !!d.photoId && d.aiSuggestedCode === category.code && (d.aiConfidence ?? 0) >= AI_MIN_CONFIDENCE;
}

// ---------------------------------------------------------------- transações

export function credit(d: MockDb, userId: string, amount: number, type: TxRec['type'], description: string, at: string, disposalId: string | null = null): TxRec {
  const user = d.users.find((u) => u.id === userId);
  if (!user) throw fail.notFound('Usuário não encontrado.');
  user.points += amount;
  if (type === 'EARN' || type === 'BONUS') user.totalEarned += amount;
  const tx: TxRec = { id: crypto.randomUUID(), userId, type, amount, balanceAfter: user.points, description, createdAt: at, disposalId };
  d.transactions.push(tx);
  return tx;
}

export function debit(d: MockDb, userId: string, cost: number, description: string, at: string): TxRec {
  const user = d.users.find((u) => u.id === userId);
  if (!user) throw fail.notFound('Usuário não encontrado.');
  if (user.points < cost) {
    throw fail.insufficientPoints(`Saldo insuficiente: você tem ${user.points} pontos e a recompensa custa ${cost}.`);
  }
  user.points -= cost;
  const tx: TxRec = { id: crypto.randomUUID(), userId, type: 'REDEEM', amount: -cost, balanceAfter: user.points, description, createdAt: at, disposalId: null };
  d.transactions.push(tx);
  return tx;
}

const kgFmt = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Aprova um descarte e credita os pontos UMA vez. Retorna os pontos concedidos. */
export function approveDisposal(d: MockDb, disposal: DisposalRec, at: string): number {
  if (disposal.status === 'APPROVED') return disposal.pointsAwarded; // nunca credita duas vezes
  if (disposal.status === 'REJECTED') throw fail.conflict('Este descarte já foi recusado e não pode ser aprovado.');
  const category = d.categories.find((c) => c.id === disposal.categoryId)!;
  const awarded = computePoints(category, disposal.quantityKg, aiConfirmed(disposal, category));
  disposal.status = 'APPROVED';
  disposal.pointsAwarded = awarded;
  disposal.reviewedAt = at;
  credit(d, disposal.userId, awarded, 'EARN', `Descarte aprovado: ${kgFmt.format(disposal.quantityKg)} kg de ${category.name}`, at, disposal.id);
  evaluateChallenges(d, disposal.userId, at);
  evaluateBadges(d, disposal.userId, at);
  return awarded;
}

// ---------------------------------------------------------------- sequência

/** Dias seguidos (terminando hoje ou ontem) com ao menos um descarte aprovado. */
export function streakDays(d: MockDb, userId: string, at: string): number {
  const days = new Set(
    d.disposals.filter((x) => x.userId === userId && x.status === 'APPROVED').map((x) => localDate(x.disposedAt)),
  );
  let day = localDate(at);
  if (!days.has(day)) day = addDays(day, -1);
  let streak = 0;
  while (days.has(day)) {
    streak++;
    day = addDays(day, -1);
  }
  return streak;
}

// ---------------------------------------------------------------- desafios

export function challengeProgress(d: MockDb, userId: string, c: ChallengeRec): number {
  const end = addDays(c.endsAt, 1);
  let total = 0;
  for (const x of d.disposals) {
    if (x.userId !== userId || x.status !== 'APPROVED') continue;
    const day = localDate(x.disposedAt);
    if (day < c.startsAt || day >= end) continue;
    if (c.categoryCode) {
      const cat = d.categories.find((k) => k.id === x.categoryId);
      if (cat?.code !== c.categoryCode) continue;
    }
    total += c.metric === 'KG' ? x.quantityKg : 1;
  }
  return round(total, 2);
}

/** Conclui desafios atingidos e credita o bônus (uma vez por desafio). */
export function evaluateChallenges(d: MockDb, userId: string, at: string) {
  const today = localDate(at);
  for (const c of d.challenges) {
    if (!c.active || today < c.startsAt || today > c.endsAt) continue;
    if (d.completions.some((k) => k.userId === userId && k.challengeId === c.id)) continue;
    if (challengeProgress(d, userId, c) >= c.target) {
      d.completions.push({ userId, challengeId: c.id, at });
      if (c.bonusPoints > 0) credit(d, userId, c.bonusPoints, 'BONUS', `Desafio concluído: ${c.title}`, at);
    }
  }
}

// ---------------------------------------------------------------- medalhas

export interface BadgeStats {
  approvedCount: number;
  totalKg: number;
  kgByCategory: Partial<Record<CategoryCode, number>>;
  streakDays: number;
  totalEarned: number;
  hasSmartBin: boolean;
}

export interface BadgeDef {
  code: string;
  name: string;
  description: string;
  icon: string;
  tier: BadgeTier;
  earned: (s: BadgeStats) => boolean;
}

const kg = (s: BadgeStats, c: CategoryCode) => s.kgByCategory[c] ?? 0;

export const BADGES: BadgeDef[] = [
  { code: 'PRIMEIRO_DESCARTE', name: 'Primeiro passo', description: 'Teve o primeiro descarte aprovado.', icon: 'footprints', tier: 'BRONZE', earned: (s) => s.approvedCount >= 1 },
  { code: 'DEZ_DESCARTES', name: 'Reciclador dedicado', description: '10 descartes aprovados.', icon: 'recycle', tier: 'PRATA', earned: (s) => s.approvedCount >= 10 },
  { code: 'CINQUENTA_DESCARTES', name: 'Hábito sustentável', description: '50 descartes aprovados.', icon: 'repeat', tier: 'OURO', earned: (s) => s.approvedCount >= 50 },
  { code: 'CEM_KG', name: '100 kg fora do aterro', description: '100 kg de resíduos destinados corretamente.', icon: 'scale', tier: 'OURO', earned: (s) => s.totalKg >= 100 },
  { code: 'MESTRE_PLASTICO', name: 'Mestre do plástico', description: '25 kg de plástico reciclados.', icon: 'milk', tier: 'PRATA', earned: (s) => kg(s, 'PLASTICO') >= 25 },
  { code: 'AMIGO_DO_PAPEL', name: 'Amigo das árvores', description: '30 kg de papel reciclados.', icon: 'newspaper', tier: 'PRATA', earned: (s) => kg(s, 'PAPEL') >= 30 },
  { code: 'E_LIXO_CONSCIENTE', name: 'E-lixo consciente', description: 'Descartou eletrônicos corretamente.', icon: 'cpu', tier: 'BRONZE', earned: (s) => kg(s, 'ELETRONICO') >= 0.01 },
  { code: 'COMPOSTEIRO', name: 'Composteiro', description: '20 kg de orgânicos compostados.', icon: 'sprout', tier: 'PRATA', earned: (s) => kg(s, 'ORGANICO') >= 20 },
  {
    code: 'ARCO_IRIS', name: 'Arco-íris da reciclagem', description: 'Reciclou ao menos 1 kg de cada categoria reciclável.', icon: 'rainbow', tier: 'OURO',
    earned: (s) => (['PLASTICO', 'PAPEL', 'VIDRO', 'METAL', 'ORGANICO', 'ELETRONICO'] as CategoryCode[]).every((c) => kg(s, c) >= 1),
  },
  { code: 'SEQUENCIA_7', name: 'Uma semana verde', description: '7 dias seguidos com descarte aprovado.', icon: 'flame', tier: 'PRATA', earned: (s) => s.streakDays >= 7 },
  { code: 'CASA_INTELIGENTE', name: 'Casa 2050', description: 'Tem uma lixeira inteligente conectada.', icon: 'house-wifi', tier: 'BRONZE', earned: (s) => s.hasSmartBin },
  { code: 'GUARDIAO_2050', name: 'Guardião 2050', description: 'Alcançou 8.000 pontos acumulados.', icon: 'shield-check', tier: 'DIAMANTE', earned: (s) => s.totalEarned >= 8000 },
];

export function badgeStats(d: MockDb, userId: string, at: string): BadgeStats {
  const user = d.users.find((u) => u.id === userId)!;
  const mine = d.disposals.filter((x) => x.userId === userId && x.status === 'APPROVED');
  const kgByCategory: Partial<Record<CategoryCode, number>> = {};
  let totalKg = 0;
  for (const x of mine) {
    const code = d.categories.find((c) => c.id === x.categoryId)?.code;
    if (!code) continue;
    kgByCategory[code] = (kgByCategory[code] ?? 0) + x.quantityKg;
    totalKg += x.quantityKg;
  }
  const hasSmartBin = !!user.householdId && d.bins.some((b) => b.householdId === user.householdId);
  return { approvedCount: mine.length, totalKg, kgByCategory, streakDays: streakDays(d, userId, at), totalEarned: user.totalEarned, hasSmartBin };
}

/** Concede as medalhas cujas condições passaram a ser verdadeiras. */
export function evaluateBadges(d: MockDb, userId: string, at: string) {
  const stats = badgeStats(d, userId, at);
  for (const b of BADGES) {
    if (d.userBadges.some((x) => x.userId === userId && x.code === b.code)) continue;
    if (b.earned(stats)) d.userBadges.push({ userId, code: b.code, awardedAt: at });
  }
}

/** Usuários ativos nos últimos 30 dias (para o painel). */
export function isRecent(iso: string | null, now: number, days: number): boolean {
  return !!iso && now - Date.parse(iso) <= days * DAY;
}
