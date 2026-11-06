/**
 * Pontos, níveis, medalhas, desafios e sequência — mesmas regras do back-end:
 * - só descartes APROVADOS geram pontos, e uma única vez;
 * - pontos = arredondar(kg × pontosPorKg), mínimo 1, +10% só quando a IA DO SERVIDOR confirmou a categoria
 *   (o modo demonstração não tem IA no servidor: palpites do navegador nunca valem bônus);
 * - nível pelo total já ganho (totalEarned), saldo (points) é o disponível para resgates.
 */
import type { BadgeTier, Category, CategoryCode, Level } from '@/api/types';
import type { RegistroDesafio, RegistroDescarte, BancoSimulado, RegistroTransacao } from '../db';
import { falha } from '../http';
import { DIA, somarDias, dataLocal } from './dates';
import { arredondar } from './random';

// ---------------------------------------------------------------- níveis

export const NIVEIS = [
  { index: 0, name: 'Semente', minPoints: 0 },
  { index: 1, name: 'Broto', minPoints: 200 },
  { index: 2, name: 'Muda', minPoints: 600 },
  { index: 3, name: 'Árvore', minPoints: 1500 },
  { index: 4, name: 'Floresta', minPoints: 3500 },
  { index: 5, name: 'Guardião 2050', minPoints: 8000 },
] as const;

export function nivelPara(totalGanho: number): Level {
  let atual: (typeof NIVEIS)[number] = NIVEIS[0];
  for (const l of NIVEIS) if (totalGanho >= l.minPoints) atual = l;
  const proximo = NIVEIS[atual.index + 1] ?? null;
  const progresso = proximo ? Math.min(1, (totalGanho - atual.minPoints) / (proximo.minPoints - atual.minPoints)) : 1;
  return {
    index: atual.index,
    name: atual.name,
    minPoints: atual.minPoints,
    nextName: proximo?.name ?? null,
    nextMinPoints: proximo?.minPoints ?? null,
    progress: arredondar(progresso, 4),
  };
}

// ---------------------------------------------------------------- cálculo

const BONUS_IA_CONFIRMADA = 0.1;
// Bônus de 10% só quando a IA do servidor confirma a categoria; o palpite do navegador poderia ser forjado.
function calcularPontos(categoria: Pick<Category, 'pointsPerKg'>, kg: number, iaConfirmada: boolean): number {
  if (kg <= 0) return 0;
  if (categoria.pointsPerKg <= 0) return 1;
  let base = Math.round(kg * categoria.pointsPerKg);
  if (iaConfirmada) base = Math.round(base * (1 + BONUS_IA_CONFIRMADA));
  return Math.max(1, base);
}

/** Sempre false no modo demonstração: a sugestão enviada pelo cliente é só um palpite e não pode gerar bônus. */
function iaConfirmou(_d: RegistroDescarte, _category: Category): boolean {
  return false;
}

// ---------------------------------------------------------------- transações

function creditar(d: BancoSimulado, idUsuario: string, valor: number, tipo: RegistroTransacao['type'], descricao: string, quando: string, idDescarte: string | null = null): RegistroTransacao {
  const usuario = d.users.find((u) => u.id === idUsuario);
  if (!usuario) throw falha.notFound('Usuário não encontrado.');
  usuario.points += valor;
  if (tipo === 'EARN' || tipo === 'BONUS') usuario.totalEarned += valor;
  const tx: RegistroTransacao = { id: crypto.randomUUID(), userId: idUsuario, type: tipo, amount: valor, balanceAfter: usuario.points, description: descricao, createdAt: quando, disposalId: idDescarte };
  d.transactions.push(tx);
  return tx;
}

export function debitar(d: BancoSimulado, idUsuario: string, custo: number, descricao: string, quando: string): RegistroTransacao {
  const usuario = d.users.find((u) => u.id === idUsuario);
  if (!usuario) throw falha.notFound('Usuário não encontrado.');
  // Resgate só com saldo suficiente. O nível usa totalEarned, então gastar pontos não faz a pessoa cair de nível.
  if (usuario.points < custo) {
    throw falha.insufficientPoints(`Saldo insuficiente: você tem ${usuario.points} pontos e a recompensa custa ${custo}.`);
  }
  usuario.points -= custo;
  const tx: RegistroTransacao = { id: crypto.randomUUID(), userId: idUsuario, type: 'REDEEM', amount: -custo, balanceAfter: usuario.points, description: descricao, createdAt: quando, disposalId: null };
  d.transactions.push(tx);
  return tx;
}

const formatoKg = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Aprova um descarte e credita os pontos UMA vez. Retorna os pontos concedidos. */
export function aprovarDescarte(d: BancoSimulado, descarte: RegistroDescarte, quando: string): number {
  // 1. Já aprovado não credita de novo; recusado não pode virar aprovado.
  if (descarte.status === 'APPROVED') return descarte.pointsAwarded; // nunca credita duas vezes
  if (descarte.status === 'REJECTED') throw falha.conflict('Este descarte já foi recusado e não pode ser aprovado.');
  // 2. Pontos = kg × pontos por kg da categoria (mínimo 1).
  const categoria = d.categories.find((c) => c.id === descarte.categoryId)!;
  const concedidos = calcularPontos(categoria, descarte.quantityKg, iaConfirmou(descarte, categoria));
  // 3. Marca como aprovado e lança a transação no extrato do morador.
  descarte.status = 'APPROVED';
  descarte.pointsAwarded = concedidos;
  descarte.reviewedAt = quando;
  creditar(d, descarte.userId, concedidos, 'EARN', `Descarte aprovado: ${formatoKg.format(descarte.quantityKg)} kg de ${categoria.name}`, quando, descarte.id);
  // 4. Confere se o descarte completou algum desafio ou liberou medalha.
  avaliarDesafios(d, descarte.userId, quando);
  avaliarMedalhas(d, descarte.userId, quando);
  return concedidos;
}

// ---------------------------------------------------------------- sequência

/** Dias seguidos (terminando hoje ou ontem) com ao menos um descarte aprovado. */
export function diasSeguidos(d: BancoSimulado, idUsuario: string, quando: string): number {
  const dias = new Set(
    d.disposals.filter((x) => x.userId === idUsuario && x.status === 'APPROVED').map((x) => dataLocal(x.disposedAt)),
  );
  let dia = dataLocal(quando);
  if (!dias.has(dia)) dia = somarDias(dia, -1);
  let sequencia = 0;
  while (dias.has(dia)) {
    sequencia++;
    dia = somarDias(dia, -1);
  }
  return sequencia;
}

// ---------------------------------------------------------------- desafios

export function progressoDesafio(d: BancoSimulado, idUsuario: string, c: RegistroDesafio): number {
  const fim = somarDias(c.endsAt, 1);
  let total = 0;
  for (const x of d.disposals) {
    if (x.userId !== idUsuario || x.status !== 'APPROVED') continue;
    const dia = dataLocal(x.disposedAt);
    if (dia < c.startsAt || dia >= fim) continue;
    if (c.categoryCode) {
      const cat = d.categories.find((k) => k.id === x.categoryId);
      if (cat?.code !== c.categoryCode) continue;
    }
    total += c.metric === 'KG' ? x.quantityKg : 1;
  }
  return arredondar(total, 2);
}

/** Conclui desafios atingidos e credita o bônus (uma vez por desafio). */
function avaliarDesafios(d: BancoSimulado, idUsuario: string, quando: string) {
  const hoje = dataLocal(quando);
  for (const c of d.challenges) {
    if (!c.active || hoje < c.startsAt || hoje > c.endsAt) continue;
    if (d.completions.some((k) => k.userId === idUsuario && k.challengeId === c.id)) continue;
    if (progressoDesafio(d, idUsuario, c) >= c.target) {
      d.completions.push({ userId: idUsuario, challengeId: c.id, at: quando });
      if (c.bonusPoints > 0) creditar(d, idUsuario, c.bonusPoints, 'BONUS', `Desafio concluído: ${c.title}`, quando);
    }
  }
}

// ---------------------------------------------------------------- medalhas

export interface EstatisticasMedalhas {
  approvedCount: number;
  totalKg: number;
  kgByCategory: Partial<Record<CategoryCode, number>>;
  streakDays: number;
  totalEarned: number;
  hasSmartBin: boolean;
}

export interface DefinicaoMedalha {
  code: string;
  name: string;
  description: string;
  icon: string;
  tier: BadgeTier;
  earned: (s: EstatisticasMedalhas) => boolean;
}

const kg = (s: EstatisticasMedalhas, c: CategoryCode) => s.kgByCategory[c] ?? 0;

export const MEDALHAS: DefinicaoMedalha[] = [
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

function estatisticasMedalhas(d: BancoSimulado, idUsuario: string, quando: string): EstatisticasMedalhas {
  const usuario = d.users.find((u) => u.id === idUsuario)!;
  const meus = d.disposals.filter((x) => x.userId === idUsuario && x.status === 'APPROVED');
  const kgPorCategoria: Partial<Record<CategoryCode, number>> = {};
  let totalKg = 0;
  for (const x of meus) {
    const codigo = d.categories.find((c) => c.id === x.categoryId)?.code;
    if (!codigo) continue;
    kgPorCategoria[codigo] = (kgPorCategoria[codigo] ?? 0) + x.quantityKg;
    totalKg += x.quantityKg;
  }
  const temLixeira = !!usuario.householdId && d.bins.some((b) => b.householdId === usuario.householdId);
  return { approvedCount: meus.length, totalKg, kgByCategory: kgPorCategoria, streakDays: diasSeguidos(d, idUsuario, quando), totalEarned: usuario.totalEarned, hasSmartBin: temLixeira };
}

/** Concede as medalhas cujas condições passaram a ser verdadeiras. */
export function avaliarMedalhas(d: BancoSimulado, idUsuario: string, quando: string) {
  const estatisticas = estatisticasMedalhas(d, idUsuario, quando);
  for (const b of MEDALHAS) {
    if (d.userBadges.some((x) => x.userId === idUsuario && x.code === b.code)) continue;
    if (b.earned(estatisticas)) d.userBadges.push({ userId: idUsuario, code: b.code, awardedAt: quando });
  }
}

/** Usuários ativos nos últimos 30 dias (para o painel). */
export function ehRecente(iso: string | null, agora: number, dias: number): boolean {
  return !!iso && agora - Date.parse(iso) <= dias * DIA;
}
