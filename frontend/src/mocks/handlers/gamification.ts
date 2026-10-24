/** Pontos, resumo de gamificação, ranking e recompensas. */
import type { Badge, GamificationSummary, Page, PointTransaction, Ranking, RankingPeriod, RankingScope, Redemption, Reward } from '@/api/types';
import { db, nowIso } from '../db';
import { paginate, toChallenge, toRedemption, toTransaction } from '../dto';
import { created, enumParam, fail, intParam, ok } from '../http';
import { audit } from '../logic/audit';
import { localDate } from '../logic/dates';
import { BADGES, LEVELS, debit, evaluateBadges, levelFor, streakDays } from '../logic/points';
import { randomCode } from '../logic/random';
import { computeRanking } from '../logic/ranking';
import { route } from '../server';

const SCOPES: RankingScope[] = ['USER', 'HOUSEHOLD', 'NEIGHBORHOOD', 'ORGANIZATION'];
const PERIODS: RankingPeriod[] = ['WEEK', 'MONTH', 'YEAR', 'ALL'];

export function registerGamificationRoutes() {
  route('GET', '/points/transactions', ({ me, query }) => {
    const page = intParam(query, 'page', 0, 0, 10_000);
    const size = intParam(query, 'size', 20, 1, 100);
    const list = db().transactions
      .filter((t) => t.userId === me.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.balanceAfter - a.balanceAfter);
    const p = paginate(list, page, size);
    return ok<Page<PointTransaction>>({ ...p, content: p.content.map(toTransaction) });
  });

  route('GET', '/gamification/summary', ({ me }) => {
    const d = db();
    const now = nowIso();
    evaluateBadges(d, me.id, now); // ex.: medalha "Casa 2050" logo após conectar uma lixeira
    const today = localDate(now);
    const earned = new Map(d.userBadges.filter((b) => b.userId === me.id).map((b) => [b.code, b.awardedAt]));
    const badges: Badge[] = BADGES.map((b) => ({
      code: b.code, name: b.name, description: b.description, icon: b.icon, tier: b.tier,
      earned: earned.has(b.code), awardedAt: earned.get(b.code) ?? null,
    }));
    const challenges = d.challenges
      .filter((c) => c.active && c.endsAt >= today && c.startsAt <= today)
      .sort((a, b) => a.endsAt.localeCompare(b.endsAt))
      .map((c) => toChallenge(d, c, me.id));
    return ok<GamificationSummary>({
      points: me.points,
      totalEarned: me.totalEarned,
      level: levelFor(me.totalEarned),
      levels: LEVELS.map((l) => ({ index: l.index, name: l.name, minPoints: l.minPoints })),
      badges,
      challenges,
      streakDays: streakDays(d, me.id, now),
    });
  });

  route('GET', '/ranking', ({ me, query }) => {
    const scope = enumParam(query, 'scope', SCOPES) ?? 'USER';
    const period = enumParam(query, 'period', PERIODS) ?? 'MONTH';
    return ok<Ranking>(computeRanking(db(), me, scope, period));
  });

  route('GET', '/rewards', () =>
    ok<Reward[]>(db().rewards.filter((r) => r.active).sort((a, b) => a.costPoints - b.costPoints).map((r) => ({ ...r }))));

  route('POST', '/rewards/:id/redeem', ({ me, params }) => {
    const d = db();
    const reward = d.rewards.find((r) => r.id === params.id && r.active);
    if (!reward) throw fail.notFound('Recompensa não encontrada.');
    if (reward.stock <= 0) throw fail.outOfStock();
    if (me.points < reward.costPoints) {
      throw fail.insufficientPoints(`Saldo insuficiente: você tem ${me.points} pontos e a recompensa custa ${reward.costPoints}.`);
    }
    const at = nowIso();
    debit(d, me.id, reward.costPoints, `Resgate: ${reward.name}`, at);
    reward.stock -= 1;
    const rec = { id: crypto.randomUUID(), userId: me.id, rewardId: reward.id, cost: reward.costPoints, code: `LZ-${randomCode(4)}-${randomCode(4)}`, status: 'ISSUED' as const, createdAt: at };
    d.redemptions.push(rec);
    audit(d, me, 'REWARD_REDEEMED', 'Reward', reward.id, `${reward.name} (-${reward.costPoints} pontos)`);
    return created<Redemption>(toRedemption(d, rec));
  });

  route('GET', '/redemptions', ({ me }) => {
    const d = db();
    return ok<Redemption[]>(d.redemptions
      .filter((r) => r.userId === me.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((r) => toRedemption(d, r)));
  });
}
