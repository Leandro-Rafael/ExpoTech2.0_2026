/** Conversão registro → DTO do contrato (`@/api/types`). Os tipos de retorno garantem a conformidade. */
import type {
  AdminUser, Category, CategoryRef, Challenge, CollectionPoint, CollectionRequest, Disposal, GeoPoint, Household,
  PointTransaction, Redemption, Route, SmartBin, UserMe, UserRef,
} from '@/api/types';
import type {
  ChallengeRec, CollectionPointRec, CollectionRequestRec, DisposalRec, HouseholdRec, MockDb, RedemptionRec, RouteRec,
  SmartBinRec, TxRec, UserRec,
} from './db';
import { binStatus } from './logic/bins';
import { haversineKm } from './logic/geo';
import { challengeProgress, levelFor } from './logic/points';
import { priority } from './logic/priority';
import { activeWarnings, adminLockInfo } from './logic/security';
import { round } from './logic/random';

export function userRef(u: UserRec | undefined | null, withEmail = true): UserRef | null {
  if (!u) return null;
  return withEmail ? { id: u.id, name: u.name, email: u.email } : { id: u.id, name: u.name };
}

export function toUserMe(d: MockDb, u: UserRec): UserMe {
  const h = d.households.find((x) => x.id === u.householdId);
  const org = d.organizations.find((o) => o.id === u.organizationId);
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    points: u.points,
    totalEarned: u.totalEarned,
    level: levelFor(u.totalEarned),
    securityWarnings: activeWarnings(u),
    household: h ? { id: h.id, name: h.name, neighborhood: h.neighborhood } : null,
    organization: org ? { ...org } : null,
    createdAt: u.createdAt,
  };
}

function categoryRef(c: Category): CategoryRef {
  return { id: c.id, code: c.code, name: c.name, color: c.color, icon: c.icon };
}

function photoUrlFor(d: MockDb, photoId: string | null): string | null {
  if (!photoId) return null;
  const p = d.photos.find((x) => x.id === photoId);
  // <img> não passa pelo fetch interceptado: devolvemos a própria imagem como data: URL
  return p?.dataUrl ?? null;
}

export function toDisposal(d: MockDb, x: DisposalRec, admin = false): Disposal {
  const cat = d.categories.find((c) => c.id === x.categoryId)!;
  const cp = d.collectionPoints.find((p) => p.id === x.collectionPointId);
  const dto: Disposal = {
    id: x.id,
    category: categoryRef(cat),
    quantityKg: x.quantityKg,
    status: x.status,
    pointsAwarded: x.pointsAwarded,
    estimatedPoints: Math.max(x.quantityKg > 0 ? 1 : 0, Math.round(x.quantityKg * cat.pointsPerKg)),
    photoUrl: photoUrlFor(d, x.photoId),
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
  if (admin) {
    const u = d.users.find((k) => k.id === x.userId);
    dto.user = userRef(u) ?? { id: x.userId, name: '(removido)' };
    dto.fraud = { score: x.fraudScore, flags: [...x.fraudFlags] };
  }
  return dto;
}

export function toTransaction(t: TxRec): PointTransaction {
  return { id: t.id, type: t.type, amount: t.amount, balanceAfter: t.balanceAfter, description: t.description, createdAt: t.createdAt };
}

export function toChallenge(d: MockDb, c: ChallengeRec, userId: string | null): Challenge {
  const completed = !!userId && d.completions.some((k) => k.userId === userId && k.challengeId === c.id);
  return {
    id: c.id, title: c.title, description: c.description, categoryCode: c.categoryCode, metric: c.metric, target: c.target,
    progress: userId ? challengeProgress(d, userId, c) : 0,
    bonusPoints: c.bonusPoints, startsAt: c.startsAt, endsAt: c.endsAt, active: c.active, completed,
  };
}

export function toRedemption(d: MockDb, r: RedemptionRec): Redemption {
  const reward = d.rewards.find((x) => x.id === r.rewardId);
  return {
    id: r.id,
    reward: { id: r.rewardId, name: reward?.name ?? 'Recompensa', icon: reward?.icon ?? 'gift' },
    cost: r.cost, code: r.code, status: r.status, createdAt: r.createdAt,
  };
}

export function toCollectionPoint(p: CollectionPointRec, from: GeoPoint | null): CollectionPoint {
  return { ...p, categories: [...p.categories], distanceKm: from ? round(haversineKm(from, p), 2) : null };
}

export function toCollectionRequest(d: MockDb, r: CollectionRequestRec): CollectionRequest {
  const bin = d.bins.find((b) => b.id === r.smartBinId);
  const open = r.status === 'REQUESTED' || r.status === 'SCHEDULED' || r.status === 'IN_ROUTE';
  return {
    id: r.id,
    address: r.address,
    latitude: r.latitude,
    longitude: r.longitude,
    categoryCodes: [...r.categoryCodes],
    estimatedKg: r.estimatedKg,
    status: r.status,
    source: r.source,
    priority: open ? priority(r.estimatedKg, r.createdAt, r.categoryCodes, bin ? Math.round(bin.fillLevel) : null, r.preferredDate) : 0,
    preferredDate: r.preferredDate,
    scheduledFor: r.scheduledFor,
    routeId: r.routeId,
    notes: r.notes,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    requester: userRef(d.users.find((u) => u.id === r.requesterId)),
    smartBin: bin ? { id: bin.id, name: bin.name } : null,
  };
}

export function toRoute(d: MockDb, r: RouteRec): Route {
  return {
    id: r.id,
    name: r.name,
    status: r.status,
    collector: userRef(d.users.find((u) => u.id === r.collectorId)),
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

export function toHousehold(d: MockDb, h: HouseholdRec): Household {
  const members = d.users.filter((u) => u.householdId === h.id);
  const ids = new Set(members.map((m) => m.id));
  const catById = new Map(d.categories.map((c) => [c.id, c]));
  const monthStart = Date.now() - 30 * 24 * 3600_000;
  let totalKg = 0;
  let monthKg = 0;
  let co2 = 0;
  for (const x of d.disposals) {
    if (x.status !== 'APPROVED' || !ids.has(x.userId)) continue;
    totalKg += x.quantityKg;
    if (Date.parse(x.disposedAt) >= monthStart) monthKg += x.quantityKg;
    co2 += x.quantityKg * (catById.get(x.categoryId)?.co2FactorKg ?? 0);
  }
  return {
    id: h.id,
    name: h.name,
    neighborhood: h.neighborhood,
    city: h.city,
    inviteCode: h.inviteCode,
    members: members
      .map((m) => ({ id: m.id, name: m.name, points: m.points, isOwner: m.id === h.ownerId }))
      .sort((a, b) => Number(b.isOwner) - Number(a.isOwner) || b.points - a.points),
    stats: {
      totalKg: round(totalKg),
      monthKg: round(monthKg),
      points: members.reduce((s, m) => s + m.points, 0),
      co2AvoidedKg: round(co2),
    },
  };
}

export function toSmartBin(d: MockDb, b: SmartBinRec, includeHousehold = false): SmartBin {
  const cat = d.categories.find((c) => c.id === b.categoryId)!;
  const dto: SmartBin = {
    id: b.id,
    name: b.name,
    category: categoryRef(cat),
    capacityLiters: b.capacityLiters,
    fillLevel: Math.round(b.fillLevel),
    batteryLevel: Math.round(b.batteryLevel),
    status: binStatus(b),
    autoRequestThreshold: b.autoRequestThreshold,
    lastReadingAt: b.lastReadingAt,
    history: b.readings.slice(-24).map((r) => ({ fillLevel: r.fillLevel, at: r.at })),
  };
  if (includeHousehold) {
    const h = d.households.find((x) => x.id === b.householdId);
    if (h) dto.household = { id: h.id, name: h.name, neighborhood: h.neighborhood };
  }
  return dto;
}

export function toAdminUser(d: MockDb, u: UserRec): AdminUser {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    enabled: u.enabled,
    ...adminLockInfo(u),
    points: u.points,
    totalEarned: u.totalEarned,
    household: d.households.find((h) => h.id === u.householdId)?.name ?? null,
    createdAt: u.createdAt,
    lastLoginAt: u.lastLoginAt,
  };
}

/** Paginação `?page&size` → Page<T>. */
export function paginate<T>(items: T[], page: number, size: number) {
  return {
    content: items.slice(page * size, page * size + size),
    page,
    size,
    totalElements: items.length,
    totalPages: Math.ceil(items.length / size),
  };
}
