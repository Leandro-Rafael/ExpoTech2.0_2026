/** Pontos, resumo de gamificação, ranking e recompensas. */
import type { Badge, GamificationSummary, Page, PointTransaction, Ranking, RankingPeriod, RankingScope, Redemption, Reward } from '@/api/types';
import { banco, agoraIso } from '../db';
import { paginar, paraDesafio, paraResgate, paraTransacao } from '../dto';
import { criado, parametroEnum, falha, parametroInteiro, ok } from '../http';
import { registrarAuditoria } from '../logic/audit';
import { dataLocal } from '../logic/dates';
import { MEDALHAS, NIVEIS, debitar, avaliarMedalhas, nivelPara, diasSeguidos } from '../logic/points';
import { codigoAleatorio } from '../logic/random';
import { calcularRanking } from '../logic/ranking';
import { rota } from '../server';

const ESCOPOS: RankingScope[] = ['USER', 'HOUSEHOLD', 'NEIGHBORHOOD', 'ORGANIZATION'];
const PERIODOS: RankingPeriod[] = ['WEEK', 'MONTH', 'YEAR', 'ALL'];

export function registrarRotasGamificacao() {
  rota('GET', '/points/transactions', ({ me, query }) => {
    const pagina = parametroInteiro(query, 'page', 0, 0, 10_000);
    const tamanho = parametroInteiro(query, 'size', 20, 1, 100);
    const lista = banco().transactions
      .filter((t) => t.userId === me.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.balanceAfter - a.balanceAfter);
    const p = paginar(lista, pagina, tamanho);
    return ok<Page<PointTransaction>>({ ...p, content: p.content.map(paraTransacao) });
  });

  rota('GET', '/gamification/summary', ({ me }) => {
    const d = banco();
    const agora = agoraIso();
    avaliarMedalhas(d, me.id, agora); // ex.: medalha "Casa 2050" logo após conectar uma lixeira
    const hoje = dataLocal(agora);
    const ganhos = new Map(d.userBadges.filter((b) => b.userId === me.id).map((b) => [b.code, b.awardedAt]));
    const medalhas: Badge[] = MEDALHAS.map((b) => ({
      code: b.code, name: b.name, description: b.description, icon: b.icon, tier: b.tier,
      earned: ganhos.has(b.code), awardedAt: ganhos.get(b.code) ?? null,
    }));
    const desafios = d.challenges
      .filter((c) => c.active && c.endsAt >= hoje && c.startsAt <= hoje)
      .sort((a, b) => a.endsAt.localeCompare(b.endsAt))
      .map((c) => paraDesafio(d, c, me.id));
    return ok<GamificationSummary>({
      points: me.points,
      totalEarned: me.totalEarned,
      level: nivelPara(me.totalEarned),
      levels: NIVEIS.map((l) => ({ index: l.index, name: l.name, minPoints: l.minPoints })),
      badges: medalhas,
      challenges: desafios,
      streakDays: diasSeguidos(d, me.id, agora),
    });
  });

  rota('GET', '/ranking', ({ me, query }) => {
    const escopo = parametroEnum(query, 'scope', ESCOPOS) ?? 'USER';
    const periodo = parametroEnum(query, 'period', PERIODOS) ?? 'MONTH';
    return ok<Ranking>(calcularRanking(banco(), me, escopo, periodo));
  });

  rota('GET', '/rewards', () =>
    ok<Reward[]>(banco().rewards.filter((r) => r.active).sort((a, b) => a.costPoints - b.costPoints).map((r) => ({ ...r }))));

  rota('POST', '/rewards/:id/redeem', ({ me, params }) => {
    const d = banco();
    const recompensa = d.rewards.find((r) => r.id === params.id && r.active);
    if (!recompensa) throw falha.notFound('Recompensa não encontrada.');
    if (recompensa.stock <= 0) throw falha.outOfStock();
    if (me.points < recompensa.costPoints) {
      throw falha.insufficientPoints(`Saldo insuficiente: você tem ${me.points} pontos e a recompensa custa ${recompensa.costPoints}.`);
    }
    const quando = agoraIso();
    debitar(d, me.id, recompensa.costPoints, `Resgate: ${recompensa.name}`, quando);
    recompensa.stock -= 1;
    const registro = { id: crypto.randomUUID(), userId: me.id, rewardId: recompensa.id, cost: recompensa.costPoints, code: `LZ-${codigoAleatorio(4)}-${codigoAleatorio(4)}`, status: 'ISSUED' as const, createdAt: quando };
    d.redemptions.push(registro);
    registrarAuditoria(d, me, 'REWARD_REDEEMED', 'Reward', recompensa.id, `${recompensa.name} (-${recompensa.costPoints} pontos)`);
    return criado<Redemption>(paraResgate(d, registro));
  });

  rota('GET', '/redemptions', ({ me }) => {
    const d = banco();
    return ok<Redemption[]>(d.redemptions
      .filter((r) => r.userId === me.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((r) => paraResgate(d, r)));
  });
}
