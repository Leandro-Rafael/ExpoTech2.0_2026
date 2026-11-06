/**
 * Banco em memória do modo demonstração, persistido no localStorage (uma única chave).
 * Os registros espelham as tabelas do back-end; os DTOs do contrato são montados em `dto.ts`.
 */
import type {
  AiSource, AuditEntry, Category, CategoryCode, ChallengeMetric, CollectionPoint, CollectionRequestStatus,
  CollectionSource, DisposalStatus, GeoPoint, Organization, PointTransactionType, RedemptionStatus, Reward, Role,
  RouteStatus, RouteStop, UUID,
} from '@/api/types';
import { semearBanco } from './seed';

const CHAVE_ARMAZENAMENTO = 'lixozero2050.mockdb';
const VERSAO_ESQUEMA = 4;

export interface RegistroUsuario {
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
  /** Avisos de inspeção (0..3) — opcionais para bancos salvos antes desta versão. */
  securityWarnings?: number;
  /** Fim do bloqueio por inspeção (ISO) e último aviso contado (janela de 5 s). */
  securityLockedUntil?: string | null;
  securityLastEventAt?: string | null;
}

export interface RegistroDescarte {
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

export interface RegistroFoto {
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

export interface RegistroTransacao {
  id: UUID;
  userId: UUID;
  type: PointTransactionType;
  amount: number;
  balanceAfter: number;
  description: string;
  createdAt: string;
  disposalId: UUID | null;
}

interface RegistroMedalhaUsuario { userId: UUID; code: string; awardedAt: string }

export interface RegistroDesafio {
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

interface RegistroConclusao { userId: UUID; challengeId: UUID; at: string }

export interface RegistroResgate {
  id: UUID;
  userId: UUID;
  rewardId: UUID;
  cost: number;
  code: string;
  status: RedemptionStatus;
  createdAt: string;
}

export type RegistroEcoponto = Omit<CollectionPoint, 'distanceKm'>;

export interface RegistroSolicitacaoColeta {
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

interface RegistroParadaRota extends RouteStop { collectedKg: number | null }

export interface RegistroRota {
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
  stops: RegistroParadaRota[];
  createdAt: string;
}

export interface RegistroResidencia {
  id: UUID;
  name: string;
  neighborhood: string;
  city: string;
  inviteCode: string;
  ownerId: UUID;
  address: string | null;
  latitude: number;
  longitude: number;
  createdAt: string;
}

interface RegistroLeituraLixeira { fillLevel: number; batteryLevel: number; at: string }

export interface RegistroLixeira {
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
  readings: RegistroLeituraLixeira[];
  createdAt: string;
}

export interface RegistroMeta { id: UUID; year: number; title: string; targetRecyclingRate: number; targetKg: number }

export interface BancoSimulado {
  version: number;
  seededAt: string;
  users: RegistroUsuario[];
  organizations: Organization[];
  categories: Category[];
  disposals: RegistroDescarte[];
  photos: RegistroFoto[];
  transactions: RegistroTransacao[];
  userBadges: RegistroMedalhaUsuario[];
  challenges: RegistroDesafio[];
  completions: RegistroConclusao[];
  rewards: Reward[];
  redemptions: RegistroResgate[];
  collectionPoints: RegistroEcoponto[];
  collectionRequests: RegistroSolicitacaoColeta[];
  routes: RegistroRota[];
  households: RegistroResidencia[];
  bins: RegistroLixeira[];
  goals: RegistroMeta[];
  audit: AuditEntry[];
  /** Idempotency-Key → id do descarte criado (por usuário). */
  idempotency: Record<string, UUID>;
}

let atual: BancoSimulado | null = null;

function lerArmazenamento(): BancoSimulado | null {
  try {
    const bruto = localStorage.getItem(CHAVE_ARMAZENAMENTO);
    if (!bruto) return null;
    const lido = JSON.parse(bruto) as BancoSimulado;
    return lido && lido.version === VERSAO_ESQUEMA ? lido : null;
  } catch {
    return null;
  }
}

/** Banco atual (carrega do localStorage ou semeia na primeira vez). */
export function banco(): BancoSimulado {
  if (!atual) {
    atual = lerArmazenamento();
    if (!atual) {
      atual = semearBanco(VERSAO_ESQUEMA, new Date());
      salvar();
    }
  }
  return atual;
}

const MAX_AUDITORIA = 400;
const MAX_FOTOS_COM_DADOS = 25;

/** Persiste no localStorage. Se a cota estourar, descarta imagens antigas e tenta de novo. */
export function salvar() {
  if (!atual) return;
  if (atual.audit.length > MAX_AUDITORIA) atual.audit.length = MAX_AUDITORIA;
  for (let tentativa = 0; tentativa < 4; tentativa++) {
    try {
      localStorage.setItem(CHAVE_ARMAZENAMENTO, JSON.stringify(atual));
      return;
    } catch {
      const comDados = atual.photos.filter((p) => p.dataUrl && p.ownerId);
      const manter = Math.max(0, Math.floor(Math.min(comDados.length, MAX_FOTOS_COM_DADOS) / 2 ** (tentativa + 1)));
      comDados.slice(0, comDados.length - manter).forEach((p) => { p.dataUrl = null; });
    }
  }
  console.warn('[modo demonstração] não foi possível salvar os dados no localStorage.');
}

/** Apaga o banco e semeia novamente. */
export function resetarBanco() {
  try { localStorage.removeItem(CHAVE_ARMAZENAMENTO); } catch { /* */ }
  atual = semearBanco(VERSAO_ESQUEMA, new Date());
  salvar();
}

export function agoraIso(): string {
  return new Date().toISOString();
}
