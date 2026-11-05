// Contrato da API (fonte da verdade). Espelha os DTOs do back-end Java (pacote ...api.dto).

export type UUID = string;
type ISODateTime = string;
type ISODate = string;

export type Role = 'USER' | 'COLLECTOR' | 'ADMIN';
export type DisposalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type CategoryCode =
  | 'PLASTICO' | 'PAPEL' | 'VIDRO' | 'METAL' | 'ORGANICO' | 'ELETRONICO' | 'REJEITO';
export type AiSource = 'CLAUDE' | 'LOCAL' | 'MANUAL';
export type PointTransactionType = 'EARN' | 'BONUS' | 'REDEEM' | 'ADJUST';
export type RankingScope = 'USER' | 'HOUSEHOLD' | 'NEIGHBORHOOD' | 'ORGANIZATION';
export type RankingPeriod = 'WEEK' | 'MONTH' | 'YEAR' | 'ALL';
export type CollectionRequestStatus = 'REQUESTED' | 'SCHEDULED' | 'IN_ROUTE' | 'COLLECTED' | 'CANCELLED';
export type CollectionSource = 'USER' | 'SMART_BIN';
export type RouteStatus = 'PLANNED' | 'IN_PROGRESS' | 'DONE';
type StopStatus = 'PENDING' | 'DONE';
export type RedemptionStatus = 'ISSUED' | 'USED' | 'CANCELLED';
export type OrganizationType = 'TURMA' | 'EMPRESA' | 'CONDOMINIO' | 'ESCOLA';
export type ChallengeMetric = 'KG' | 'COUNT';
export type BadgeTier = 'BRONZE' | 'PRATA' | 'OURO' | 'DIAMANTE';
export type SmartBinStatus = 'OK' | 'ATTENTION' | 'FULL' | 'OFFLINE';

export interface Page<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface ApiProblem {
  status: number;
  title: string;
  detail?: string;
  code?: string;
  errors?: { field: string; message: string }[];
}

export interface UserRef { id: UUID; name: string; email?: string }

export interface Level {
  index: number;          // 0..n
  name: string;           // "Semente", "Broto", ...
  minPoints: number;
  nextName: string | null;
  nextMinPoints: number | null;
  progress: number;       // 0..1 até o próximo nível
}

export interface UserMe {
  id: UUID;
  name: string;
  email: string;
  role: Role;
  points: number;         // saldo disponível
  totalEarned: number;    // total já ganho (define o nível)
  level: Level;
  household: { id: UUID; name: string; neighborhood: string } | null;
  organization: Organization | null;
  createdAt: ISODateTime;
  securityWarnings: number; // avisos de inspeção (0..3); no 3º o acesso é bloqueado por 30 min
}

export interface Organization { id: UUID; name: string; type: OrganizationType }

export interface Category {
  id: UUID;
  code: CategoryCode;
  name: string;
  description: string;
  guidance: string[];     // orientações de descarte correto
  pointsPerKg: number;
  co2FactorKg: number;    // kg de CO2 evitados por kg reciclado
  recyclable: boolean;
  color: string;          // hex
  icon: string;           // nome de ícone lucide (ex.: "milk", "newspaper")
  maxKgPerDisposal: number;
  active: boolean;
}
export type CategoryRef = Pick<Category, 'id' | 'code' | 'name' | 'color' | 'icon'>;

interface AiSuggestion {
  available: boolean;     // false => IA de servidor indisponível, usar modelo local no navegador
  categoryCode: CategoryCode | null;
  confidence: number | null;  // 0..1
  reasoning: string | null;
  source: AiSource | null;
  verified: boolean;      // true só quando a IA do SERVIDOR classificou (única que conta para o bônus)
}

export interface PhotoUpload {
  id: UUID;
  url: string;              // /api/photos/{id}
  width: number;
  height: number;
  duplicateSuspected: boolean; // hash perceptual parecido com outra foto já enviada
  ai: AiSuggestion;
}

export interface CreateDisposal {
  categoryId: UUID;
  quantityKg: number;       // 0.01 .. category.maxKgPerDisposal
  photoId?: UUID | null;
  latitude?: number | null;
  longitude?: number | null;
  collectionPointId?: UUID | null;
  disposedAt?: ISODateTime | null;  // padrão: agora; não pode ser futuro nem > 7 dias atrás
  aiSuggestedCode?: CategoryCode | null;
  aiConfidence?: number | null;
  aiSource?: AiSource | null;
  notes?: string | null;    // até 500 caracteres
}

export interface Disposal {
  id: UUID;
  category: CategoryRef;
  quantityKg: number;
  status: DisposalStatus;
  pointsAwarded: number;    // 0 enquanto não aprovado
  estimatedPoints: number;
  photoUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  collectionPoint: { id: UUID; name: string } | null;
  disposedAt: ISODateTime;
  createdAt: ISODateTime;
  reviewedAt: ISODateTime | null;
  rejectionReason: string | null;
  notes: string | null;
  // verified=true: classificação feita pelo servidor (vale o bônus de +10%); false: palpite do navegador (só informativo)
  ai: { suggestedCode: CategoryCode | null; confidence: number | null; source: AiSource | null; verified: boolean } | null;
  // Somente para ADMIN:
  user?: UserRef;
  fraud?: { score: number; flags: string[] };
}

export interface PointTransaction {
  id: UUID;
  type: PointTransactionType;
  amount: number;           // positivo = ganho, negativo = uso
  balanceAfter: number;
  description: string;
  createdAt: ISODateTime;
}

export interface Badge {
  code: string;
  name: string;
  description: string;
  icon: string;
  tier: BadgeTier;
  earned: boolean;
  awardedAt: ISODateTime | null;
}

export interface Challenge {
  id: UUID;
  title: string;
  description: string;
  categoryCode: CategoryCode | null;
  metric: ChallengeMetric;
  target: number;
  progress: number;         // valor atual do usuário (somente no summary)
  bonusPoints: number;
  startsAt: ISODate;
  endsAt: ISODate;
  active: boolean;
  completed: boolean;
}

export interface GamificationSummary {
  points: number;
  totalEarned: number;
  level: Level;
  levels: { index: number; name: string; minPoints: number }[];
  badges: Badge[];
  challenges: Challenge[];
  streakDays: number;       // dias seguidos com descarte aprovado
}

export interface RankingEntry {
  position: number;
  id: UUID | string;        // bairro usa o nome como id
  name: string;
  subtitle: string | null;
  points: number;
  kg: number;
  isMe: boolean;
}
export interface Ranking {
  scope: RankingScope;
  period: RankingPeriod;
  entries: RankingEntry[];  // top 50
  me: RankingEntry | null;
}

export interface Reward {
  id: UUID;
  name: string;
  description: string;
  costPoints: number;
  stock: number;
  icon: string;
  partner: string | null;
  active: boolean;
}

export interface Redemption {
  id: UUID;
  reward: { id: UUID; name: string; icon: string };
  cost: number;
  code: string;             // voucher
  status: RedemptionStatus;
  createdAt: ISODateTime;
}

export interface CollectionPoint {
  id: UUID;
  name: string;
  address: string;
  neighborhood: string;
  latitude: number;
  longitude: number;
  openingHours: string;
  categories: CategoryCode[];
  active: boolean;
  distanceKm: number | null;
}

export interface CreateCollectionRequest {
  address: string;
  latitude: number;
  longitude: number;
  categoryCodes: CategoryCode[];
  estimatedKg: number;
  preferredDate?: ISODate | null;
  notes?: string | null;
}

export interface CollectionRequest {
  id: UUID;
  address: string;
  latitude: number;
  longitude: number;
  categoryCodes: CategoryCode[];
  estimatedKg: number;
  status: CollectionRequestStatus;
  source: CollectionSource;
  priority: number;         // 0..100 (maior = mais urgente)
  preferredDate: ISODate | null;
  scheduledFor: ISODate | null;
  routeId: UUID | null;
  notes: string | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  requester: UserRef | null;
  smartBin: { id: UUID; name: string } | null;
}

export interface GeoPoint { latitude: number; longitude: number }

export interface RouteStop {
  id: UUID;
  sequence: number;
  requestId: UUID;
  address: string;
  latitude: number;
  longitude: number;
  estimatedKg: number;
  status: StopStatus;
  completedAt: ISODateTime | null;
}

export interface Route {
  id: UUID;
  name: string;
  status: RouteStatus;
  collector: UserRef | null;
  plannedDate: ISODate;
  totalDistanceKm: number;
  naiveDistanceKm: number;
  estimatedMinutes: number;
  loadKg: number;
  depot: GeoPoint;
  stops: RouteStop[];
  createdAt: ISODateTime;
}

export interface RouteOptimization {
  algorithm: string;        // ex.: "Vizinho mais próximo + 2-opt (com capacidade)"
  routes: {
    stops: { requestId: UUID; sequence: number; latitude: number; longitude: number; address: string; estimatedKg: number }[];
    distanceKm: number;
    naiveDistanceKm: number;
    estimatedMinutes: number;
    loadKg: number;
  }[];
  totalDistanceKm: number;
  naiveTotalDistanceKm: number;
  savingsPercent: number;
  depot: GeoPoint;
}

interface HouseholdMember { id: UUID; name: string; points: number; isOwner: boolean }
export interface Household {
  id: UUID;
  name: string;
  neighborhood: string;
  city: string;
  inviteCode: string;
  members: HouseholdMember[];
  stats: { totalKg: number; monthKg: number; points: number; co2AvoidedKg: number };
}

export interface SmartBin {
  id: UUID;
  name: string;
  category: CategoryRef;
  capacityLiters: number;
  fillLevel: number;        // 0..100
  batteryLevel: number;     // 0..100
  status: SmartBinStatus;
  autoRequestThreshold: number; // 50..100
  lastReadingAt: ISODateTime | null;
  history: { fillLevel: number; at: ISODateTime }[]; // últimas leituras (antigas → recentes)
  household?: { id: UUID; name: string; neighborhood: string }; // só no admin
}
export interface SmartBinCreated { bin: SmartBin; deviceId: UUID; deviceKey: string } // deviceKey exibida uma única vez

export interface PublicStats {
  totalKg: number;
  recycledKg: number;
  co2AvoidedKg: number;
  treesEquivalent: number;
  users: number;
  households: number;
  disposals: number;
  collectionPoints: number;
}

export interface Goal {
  id: UUID;
  year: number;
  title: string;
  targetRecyclingRate: number; // 0..1
  targetKg: number;
  currentRate: number;
  currentKg: number;
  progress: number;            // 0..1
}

export interface ImpactSummary {
  scope: 'ME' | 'COMMUNITY';
  totalKg: number;
  recycledKg: number;
  recyclingRate: number;       // 0..1
  co2AvoidedKg: number;
  treesEquivalent: number;
  energySavedKwh: number;
  waterSavedLiters: number;
  disposalsCount: number;
  byCategory: { code: CategoryCode; name: string; color: string; kg: number; percent: number }[];
  byMonth: { month: string; kg: number; recycledKg: number; co2AvoidedKg: number }[]; // "2026-01"
  goals: Goal[];
}

export interface SimulationInput {
  population: number;            // 1 .. 50.000.000
  kgPerCapitaDay: number;        // 0.1 .. 5
  currentRecyclingRate: number;  // 0..1
  targetRecyclingRate: number;   // 0..1
  targetYear: number;            // 2027..2050
  annualGrowthRate: number;      // -0.05 .. 0.10 (crescimento da geração de lixo)
}
export interface SimulationYear {
  year: number;
  generatedTons: number;
  recyclingRate: number;
  recycledTonsBaseline: number;
  recycledTonsScenario: number;
  landfillTonsBaseline: number;
  landfillTonsScenario: number;
  co2AvoidedTonsScenario: number;
}
export interface SimulationResult {
  years: SimulationYear[];
  totals: {
    landfillAvoidedTons: number;
    co2AvoidedTons: number;
    treesEquivalent: number;
    truckloadsAvoided: number;
    jobsCreated: number;
  };
}

export interface AdminOverview {
  users: number;
  activeUsers30d: number;
  pendingDisposals: number;
  flaggedDisposals: number;
  openCollectionRequests: number;
  binsNeedingCollection: number;
  totalKg: number;
  recycledKg: number;
  pointsIssued: number;
  redemptions: number;
  disposalsLast14Days: { date: ISODate; count: number; kg: number }[];
  recentAudit: AuditEntry[];
}

export interface AdminUser {
  id: UUID;
  name: string;
  email: string;
  role: Role;
  enabled: boolean;
  locked: boolean;          // bloqueio ativo (senha errada ou inspeção)
  lockReason: AccountLockReason | null;
  lockedUntil: ISODateTime | null;
  securityWarnings: number; // avisos de inspeção acumulados (0..3)
  points: number;
  totalEarned: number;
  household: string | null;
  createdAt: ISODateTime;
  lastLoginAt: ISODateTime | null;
}

export interface AuditEntry {
  id: UUID;
  actor: string | null;     // nome/e-mail ou "sistema"
  action: string;           // ex.: "DISPOSAL_APPROVED"
  entity: string | null;
  entityId: string | null;
  details: string | null;
  ip: string | null;
  createdAt: ISODateTime;
}

// Inputs de administração
export interface CategoryInput {
  code: CategoryCode; name: string; description: string; guidance: string[];
  pointsPerKg: number; co2FactorKg: number; recyclable: boolean; color: string; icon: string;
  maxKgPerDisposal: number; active: boolean;
}
export interface CollectionPointInput {
  name: string; address: string; neighborhood: string; latitude: number; longitude: number;
  openingHours: string; categories: CategoryCode[]; active: boolean;
}
export interface RewardInput {
  name: string; description: string; costPoints: number; stock: number; icon: string;
  partner: string | null; active: boolean;
}
export interface ChallengeInput {
  title: string; description: string; categoryCode: CategoryCode | null; metric: ChallengeMetric;
  target: number; bonusPoints: number; startsAt: ISODate; endsAt: ISODate; active: boolean;
}
export interface GoalInput { year: number; title: string; targetRecyclingRate: number; targetKg: number }

// ---------- Segurança: dissuasão de inspeção e integridade dos dados ----------
export type AccountLockReason = 'PASSWORD' | 'INSPECTION';
export type InspectionTrigger =
  | 'F12' | 'CTRL_SHIFT_I' | 'CTRL_SHIFT_J' | 'CTRL_SHIFT_C' | 'CTRL_U' | 'CONTEXT_MENU' | 'DEVTOOLS_OPEN';

/** POST /api/security/inspection-events */
export interface InspectionEventResult {
  warnings: number;         // avisos acumulados (eventos em até 5 s contam como um só)
  maxWarnings: number;      // 3
  locked: boolean;          // true no 3º aviso: sessões encerradas, acesso bloqueado
  lockedUntil: ISODateTime | null;
}

export interface IntegrityBreak {
  table: 'point_transactions' | 'audit_log' | 'users';
  id: UUID;
  userId: UUID | null;
}

/** GET /api/admin/integrity */
export interface IntegrityReport {
  checkedAt: ISODateTime;
  ledger: { ok: boolean; rowsChecked: number; brokenAt: IntegrityBreak | null };
  audit: { ok: boolean; rowsChecked: number; brokenAt: IntegrityBreak | null };
  balances: { ok: boolean; mismatches: number };
}
