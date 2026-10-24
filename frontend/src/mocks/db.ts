/**
 * Banco em memória do modo demonstração, persistido no localStorage (uma única chave).
 * Os registros espelham as tabelas do back-end; os DTOs do contrato são montados em `dto.ts`.
 */
import type {
  AiSource, AuditEntry, Category, CategoryCode, ChallengeMetric, CollectionPoint, CollectionRequestStatus,
  CollectionSource, DisposalStatus, GeoPoint, Organization, PointTransactionType, RedemptionStatus, Reward, Role,
  RouteStatus, RouteStop, UUID,
} from '@/api/types';
import { seedDatabase } from './seed';

export const STORAGE_KEY = 'lixozero2050.mockdb';
const SCHEMA_VERSION = 3;

export interface UserRec {
  id: UUID;
  name: string;
  email: string;
  /** Hash de demonstração (não criptográfico) — apenas para o modo mock. */
  passwordHash: string;
  role: Role;
  enabled: boolean;
  failedLogins: number;
  lockedUntil: string | null;
  householdId: UUID | null;
  organizationId: UUID | null;
  points: number;
  totalEarned: number;
  /** Incrementado ao trocar a senha: invalida as demais sessões. */
  sessionEpoch: number;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface DisposalRec {
  id: UUID;
  userId: UUID;
  categoryId: UUID;
  quantityKg: number;
  status: DisposalStatus;
  pointsAwarded: number;
  photoId: UUID | null;
  latitude: number | null;
  longitude: number | null;
  collectionPointId: UUID | null;
  disposedAt: string;
  createdAt: string;
  reviewedAt: string | null;
  rejectionReason: string | null;
  notes: string | null;
  aiSuggestedCode: CategoryCode | null;
  aiConfidence: number | null;
  aiSource: AiSource | null;
  fraudScore: number;
  fraudFlags: string[];
  idempotencyKey: string | null;
}

export interface PhotoRec {
  id: UUID;
  ownerId: UUID | null;
  /** data: URL (imagem reduzida) — servida em /api/photos/{id} e usada como `photoUrl`. */
  dataUrl: string | null;
  mime: string;
  width: number;
  height: number;
  /** Hash perceptual (aHash 8x8, hex) para detectar fotos repetidas. */
  hash: string | null;
  createdAt: string;
}

export interface TxRec {
  id: UUID;
  userId: UUID;
  type: PointTransactionType;
  amount: number;
  balanceAfter: number;
  description: string;
  createdAt: string;
  disposalId: UUID | null;
}

export interface UserBadgeRec { userId: UUID; code: string; awardedAt: string }

export interface ChallengeRec {
  id: UUID;
  title: string;
  description: string;
  categoryCode: CategoryCode | null;
  metric: ChallengeMetric;
  target: number;
  bonusPoints: number;
  startsAt: string;
  endsAt: string;
  active: boolean;
}

export interface CompletionRec { userId: UUID; challengeId: UUID; at: string }

export interface RedemptionRec {
  id: UUID;
  userId: UUID;
  rewardId: UUID;
  cost: number;
  code: string;
  status: RedemptionStatus;
  createdAt: string;
}

export type CollectionPointRec = Omit<CollectionPoint, 'distanceKm'>;

export interface CollectionRequestRec {
  id: UUID;
  address: string;
  latitude: number;
  longitude: number;
  categoryCodes: CategoryCode[];
  estimatedKg: number;
  status: CollectionRequestStatus;
  source: CollectionSource;
  preferredDate: string | null;
  scheduledFor: string | null;
  routeId: UUID | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  requesterId: UUID | null;
  smartBinId: UUID | null;
}

export interface RouteStopRec extends RouteStop { collectedKg: number | null }

export interface RouteRec {
  id: UUID;
  name: string;
  status: RouteStatus;
  collectorId: UUID | null;
  plannedDate: string;
  totalDistanceKm: number;
  naiveDistanceKm: number;
  estimatedMinutes: number;
  loadKg: number;
  depot: GeoPoint;
  stops: RouteStopRec[];
  createdAt: string;
}

export interface HouseholdRec {
  id: UUID;
  name: string;
  neighborhood: string;
  city: string;
  inviteCode: string;
  ownerId: UUID;
  latitude: number;
  longitude: number;
  createdAt: string;
}

export interface BinReadingRec { fillLevel: number; batteryLevel: number; at: string }

export interface SmartBinRec {
  id: UUID;
  householdId: UUID;
  categoryId: UUID;
  name: string;
  capacityLiters: number;
  autoRequestThreshold: number;
  deviceId: UUID;
  /** Guardada só para a demo (o back-end real guarda apenas o hash). */
  deviceKey: string;
  fillLevel: number;
  batteryLevel: number;
  lastReadingAt: string | null;
  /** Velocidade de enchimento simulada (% por hora). 0 = sem simulação (sensor desligado). */
  fillRatePerHour: number;
  readings: BinReadingRec[];
  createdAt: string;
}

export interface GoalRec { id: UUID; year: number; title: string; targetRecyclingRate: number; targetKg: number }

export interface MockDb {
  version: number;
  seededAt: string;
  users: UserRec[];
  organizations: Organization[];
  categories: Category[];
  disposals: DisposalRec[];
  photos: PhotoRec[];
  transactions: TxRec[];
  userBadges: UserBadgeRec[];
  challenges: ChallengeRec[];
  completions: CompletionRec[];
  rewards: Reward[];
  redemptions: RedemptionRec[];
  collectionPoints: CollectionPointRec[];
  collectionRequests: CollectionRequestRec[];
  routes: RouteRec[];
  households: HouseholdRec[];
  bins: SmartBinRec[];
  goals: GoalRec[];
  audit: AuditEntry[];
  /** Idempotency-Key → id do descarte criado (por usuário). */
  idempotency: Record<string, UUID>;
}

let current: MockDb | null = null;

function readStorage(): MockDb | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MockDb;
    return parsed && parsed.version === SCHEMA_VERSION ? parsed : null;
  } catch {
    return null;
  }
}

/** Banco atual (carrega do localStorage ou semeia na primeira vez). */
export function db(): MockDb {
  if (!current) {
    current = readStorage();
    if (!current) {
      current = seedDatabase(SCHEMA_VERSION, new Date());
      save();
    }
  }
  return current;
}

const MAX_AUDIT = 400;
const MAX_PHOTOS_WITH_DATA = 25;

/** Persiste no localStorage. Se a cota estourar, descarta imagens antigas e tenta de novo. */
export function save() {
  if (!current) return;
  if (current.audit.length > MAX_AUDIT) current.audit.length = MAX_AUDIT;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
      return;
    } catch {
      const withData = current.photos.filter((p) => p.dataUrl && p.ownerId);
      const keep = Math.max(0, Math.floor(Math.min(withData.length, MAX_PHOTOS_WITH_DATA) / 2 ** (attempt + 1)));
      withData.slice(0, withData.length - keep).forEach((p) => { p.dataUrl = null; });
    }
  }
  console.warn('[modo demonstração] não foi possível salvar os dados no localStorage.');
}

/** Apaga o banco e semeia novamente. */
export function resetDb() {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* */ }
  current = seedDatabase(SCHEMA_VERSION, new Date());
  save();
}

export function newId(): UUID {
  return crypto.randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString();
}
