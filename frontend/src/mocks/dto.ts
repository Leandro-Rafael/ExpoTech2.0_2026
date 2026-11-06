/** Conversão registro → DTO do contrato (`@/api/types`). Os tipos de retorno garantem a conformidade. */
import type {
  AdminUser, Category, CategoryRef, Challenge, CollectionPoint, CollectionRequest, Disposal, GeoPoint, Household,
  PointTransaction, Redemption, Route, SmartBin, UserMe, UserRef,
} from '@/api/types';
import type {
  RegistroDesafio, RegistroEcoponto, RegistroSolicitacaoColeta, RegistroDescarte, RegistroResidencia, BancoSimulado, RegistroResgate, RegistroRota,
  RegistroLixeira, RegistroTransacao, RegistroUsuario,
} from './db';
import { statusLixeira } from './logic/bins';
import { distanciaHaversineKm } from './logic/geo';
import { progressoDesafio, nivelPara } from './logic/points';
import { prioridade } from './logic/priority';
import { avisosAtivos, infoBloqueioAdmin } from './logic/security';
import { arredondar } from './logic/random';

export function refUsuario(u: RegistroUsuario | undefined | null, comEmail = true): UserRef | null {
  if (!u) return null;
  return comEmail ? { id: u.id, name: u.name, email: u.email } : { id: u.id, name: u.name };
}

export function paraUsuarioLogado(d: BancoSimulado, u: RegistroUsuario): UserMe {
  const h = d.households.find((x) => x.id === u.householdId);
  const organizacao = d.organizations.find((o) => o.id === u.organizationId);
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    points: u.points,
    totalEarned: u.totalEarned,
    level: nivelPara(u.totalEarned),
    securityWarnings: avisosAtivos(u),
    household: h ? { id: h.id, name: h.name, neighborhood: h.neighborhood } : null,
    organization: organizacao ? { ...organizacao } : null,
    createdAt: u.createdAt,
  };
}

function refCategoria(c: Category): CategoryRef {
  return { id: c.id, code: c.code, name: c.name, color: c.color, icon: c.icon };
}

function urlFotoDe(d: BancoSimulado, idFoto: string | null): string | null {
  if (!idFoto) return null;
  const p = d.photos.find((x) => x.id === idFoto);
  // <img> não passa pelo fetch interceptado: devolvemos a própria imagem como data: URL
  return p?.dataUrl ?? null;
}

export function paraDescarte(d: BancoSimulado, x: RegistroDescarte, ehAdmin = false): Disposal {
  const cat = d.categories.find((c) => c.id === x.categoryId)!;
  const cp = d.collectionPoints.find((p) => p.id === x.collectionPointId);
  const dto: Disposal = {
    id: x.id,
    category: refCategoria(cat),
    quantityKg: x.quantityKg,
    status: x.status,
    pointsAwarded: x.pointsAwarded,
    estimatedPoints: Math.max(x.quantityKg > 0 ? 1 : 0, Math.round(x.quantityKg * cat.pointsPerKg)),
    photoUrl: urlFotoDe(d, x.photoId),
    latitude: x.latitude,
    longitude: x.longitude,
    collectionPoint: cp ? { id: cp.id, name: cp.name } : null,
    disposedAt: x.disposedAt,
    createdAt: x.createdAt,
    reviewedAt: x.reviewedAt,
    rejectionReason: x.rejectionReason,
    notes: x.notes,
    // sem IA no servidor no modo demonstração: a sugestão é sempre um palpite do navegador (não verificado)
    ai: x.aiSource || x.aiSuggestedCode ? { suggestedCode: x.aiSuggestedCode, confidence: x.aiConfidence, source: x.aiSource, verified: false } : null,
  };
  if (ehAdmin) {
    const u = d.users.find((k) => k.id === x.userId);
    dto.user = refUsuario(u) ?? { id: x.userId, name: '(removido)' };
    dto.fraud = { score: x.fraudScore, flags: [...x.fraudFlags] };
  }
  return dto;
}

export function paraTransacao(t: RegistroTransacao): PointTransaction {
  return { id: t.id, type: t.type, amount: t.amount, balanceAfter: t.balanceAfter, description: t.description, createdAt: t.createdAt };
}

export function paraDesafio(d: BancoSimulado, c: RegistroDesafio, idUsuario: string | null): Challenge {
  const concluido = !!idUsuario && d.completions.some((k) => k.userId === idUsuario && k.challengeId === c.id);
  return {
    id: c.id, title: c.title, description: c.description, categoryCode: c.categoryCode, metric: c.metric, target: c.target,
    progress: idUsuario ? progressoDesafio(d, idUsuario, c) : 0,
    bonusPoints: c.bonusPoints, startsAt: c.startsAt, endsAt: c.endsAt, active: c.active, completed: concluido,
  };
}

export function paraResgate(d: BancoSimulado, r: RegistroResgate): Redemption {
  const recompensa = d.rewards.find((x) => x.id === r.rewardId);
  return {
    id: r.id,
    reward: { id: r.rewardId, name: recompensa?.name ?? 'Recompensa', icon: recompensa?.icon ?? 'gift' },
    cost: r.cost, code: r.code, status: r.status, createdAt: r.createdAt,
  };
}

export function paraEcoponto(p: RegistroEcoponto, origem: GeoPoint | null): CollectionPoint {
  return { ...p, categories: [...p.categories], distanceKm: origem ? arredondar(distanciaHaversineKm(origem, p), 2) : null };
}

export function paraSolicitacaoColeta(d: BancoSimulado, r: RegistroSolicitacaoColeta): CollectionRequest {
  const lixeira = d.bins.find((b) => b.id === r.smartBinId);
  const aberta = r.status === 'REQUESTED' || r.status === 'SCHEDULED' || r.status === 'IN_ROUTE';
  return {
    id: r.id,
    address: r.address,
    latitude: r.latitude,
    longitude: r.longitude,
    categoryCodes: [...r.categoryCodes],
    estimatedKg: r.estimatedKg,
    status: r.status,
    source: r.source,
    priority: aberta ? prioridade(r.estimatedKg, r.createdAt, r.categoryCodes, lixeira ? Math.round(lixeira.fillLevel) : null, r.preferredDate) : 0,
    preferredDate: r.preferredDate,
    scheduledFor: r.scheduledFor,
    routeId: r.routeId,
    notes: r.notes,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    requester: refUsuario(d.users.find((u) => u.id === r.requesterId)),
    smartBin: lixeira ? { id: lixeira.id, name: lixeira.name } : null,
  };
}

export function paraRota(d: BancoSimulado, r: RegistroRota): Route {
  return {
    id: r.id,
    name: r.name,
    status: r.status,
    collector: refUsuario(d.users.find((u) => u.id === r.collectorId)),
    plannedDate: r.plannedDate,
    totalDistanceKm: r.totalDistanceKm,
    naiveDistanceKm: r.naiveDistanceKm,
    estimatedMinutes: r.estimatedMinutes,
    loadKg: r.loadKg,
    depot: { ...r.depot },
    stops: [...r.stops].sort((a, b) => a.sequence - b.sequence).map(({ collectedKg: _ignored, ...s }) => s),
    createdAt: r.createdAt,
  };
}

export function paraResidencia(d: BancoSimulado, h: RegistroResidencia): Household {
  const membros = d.users.filter((u) => u.householdId === h.id);
  const ids = new Set(membros.map((m) => m.id));
  const categoriaPorId = new Map(d.categories.map((c) => [c.id, c]));
  const inicioMes = Date.now() - 30 * 24 * 3600_000;
  let totalKg = 0;
  let kgMes = 0;
  let co2 = 0;
  for (const x of d.disposals) {
    if (x.status !== 'APPROVED' || !ids.has(x.userId)) continue;
    totalKg += x.quantityKg;
    if (Date.parse(x.disposedAt) >= inicioMes) kgMes += x.quantityKg;
    co2 += x.quantityKg * (categoriaPorId.get(x.categoryId)?.co2FactorKg ?? 0);
  }
  return {
    id: h.id,
    name: h.name,
    neighborhood: h.neighborhood,
    city: h.city,
    inviteCode: h.inviteCode,
    members: membros
      .map((m) => ({ id: m.id, name: m.name, points: m.points, isOwner: m.id === h.ownerId }))
      .sort((a, b) => Number(b.isOwner) - Number(a.isOwner) || b.points - a.points),
    stats: {
      totalKg: arredondar(totalKg),
      monthKg: arredondar(kgMes),
      points: membros.reduce((s, m) => s + m.points, 0),
      co2AvoidedKg: arredondar(co2),
    },
  };
}

export function paraLixeira(d: BancoSimulado, b: RegistroLixeira, incluirResidencia = false): SmartBin {
  const cat = d.categories.find((c) => c.id === b.categoryId)!;
  const dto: SmartBin = {
    id: b.id,
    name: b.name,
    category: refCategoria(cat),
    capacityLiters: b.capacityLiters,
    fillLevel: Math.round(b.fillLevel),
    batteryLevel: Math.round(b.batteryLevel),
    status: statusLixeira(b),
    autoRequestThreshold: b.autoRequestThreshold,
    lastReadingAt: b.lastReadingAt,
    history: b.readings.slice(-24).map((r) => ({ fillLevel: r.fillLevel, at: r.at })),
  };
  if (incluirResidencia) {
    const h = d.households.find((x) => x.id === b.householdId);
    if (h) dto.household = { id: h.id, name: h.name, neighborhood: h.neighborhood };
  }
  return dto;
}

export function paraUsuarioAdmin(d: BancoSimulado, u: RegistroUsuario): AdminUser {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    enabled: u.enabled,
    ...infoBloqueioAdmin(u),
    points: u.points,
    totalEarned: u.totalEarned,
    household: d.households.find((h) => h.id === u.householdId)?.name ?? null,
    createdAt: u.createdAt,
    lastLoginAt: u.lastLoginAt,
  };
}

/** Paginação `?page&size` → Page<T>. */
export function paginar<T>(itens: T[], pagina: number, tamanho: number) {
  return {
    content: itens.slice(pagina * tamanho, pagina * tamanho + tamanho),
    page: pagina,
    size: tamanho,
    totalElements: itens.length,
    totalPages: Math.ceil(itens.length / tamanho),
  };
}
