/** /api/admin — somente ADMIN. */
import type {
  AdminOverview, AdminUser, AuditEntry, Category, CategoryCode, Challenge, ChallengeMetric, CollectionPoint,
  CollectionRequest, CollectionRequestStatus, Disposal, GeoPoint, Goal, Organization, OrganizationType, Page, Reward,
  Role, Route, RouteOptimization, SmartBin, UserRef,
} from '@/api/types';
import { db, nowIso, type ChallengeRec, type CollectionPointRec, type CollectionRequestRec, type GoalRec, type MockDb, type RouteRec } from '../db';
import {
  paginate, toAdminUser, toChallenge, toCollectionPoint, toCollectionRequest, toDisposal, toRoute, toSmartBin, userRef,
} from '../dto';
import { DATE_RE, UUID_RE, Validator, bodyObject, bool, created, enumParam, fail, intParam, noContent, ok, str, type Json } from '../http';
import { audit } from '../logic/audit';
import { OPEN_REQUEST } from '../logic/bins';
import { DAY, addDays, localDate } from '../logic/dates';
import { FLAG_THRESHOLD } from '../logic/fraud';
import { DEFAULT_DEPOT } from '../logic/geo';
import { goalDto } from '../logic/impact';
import { approveDisposal, isRecent } from '../logic/points';
import { round } from '../logic/random';
import { ALGORITHM, DEFAULT_CAPACITY_KG, optimize } from '../logic/routes';
import { ADMIN, route } from '../server';
import { validateCategoryCodes } from './collection';
import { CATEGORY_CODES, DISPOSAL_STATUSES } from './disposals';

const ROLES: Role[] = ['USER', 'COLLECTOR', 'ADMIN'];
const REQUEST_STATUSES: CollectionRequestStatus[] = ['REQUESTED', 'SCHEDULED', 'IN_ROUTE', 'COLLECTED', 'CANCELLED'];
const ORG_TYPES: OrganizationType[] = ['TURMA', 'EMPRESA', 'CONDOMINIO', 'ESCOLA'];
const A = { access: ADMIN };

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// ---------------------------------------------------------------- validação dos inputs

function textField(v: Validator, b: Json, field: string, min: number, max: number, label = 'campo'): string {
  const s = str(b[field]) ?? '';
  v.check(s.length >= min && s.length <= max, field, `${label}: informe de ${min} a ${max} caracteres`);
  return s;
}

function numField(v: Validator, b: Json, field: string, min: number, max: number, integer = false): number {
  const x = b[field];
  v.check(typeof x === 'number' && Number.isFinite(x) && x >= min && x <= max && (!integer || Number.isInteger(x)), field,
    `informe ${integer ? 'um número inteiro ' : ''}entre ${min} e ${max}`);
  return x as number;
}

function boolField(v: Validator, b: Json, field: string): boolean {
  const x = bool(b[field]);
  v.check(x !== null, field, 'informe verdadeiro ou falso');
  return x ?? false;
}

function categoryInput(d: MockDb, body: unknown, currentId: string | null): Omit<Category, 'id'> {
  const b = bodyObject(body);
  const v = new Validator();
  const code = b.code as CategoryCode;
  if (!CATEGORY_CODES.includes(code)) v.add('code', 'código inválido');
  else if (d.categories.some((c) => c.code === code && c.id !== currentId)) v.add('code', 'já existe uma categoria com este código');
  const name = textField(v, b, 'name', 2, 60, 'nome');
  const description = textField(v, b, 'description', 0, 500, 'descrição');
  const guidance = Array.isArray(b.guidance) ? b.guidance.map((g) => String(g).trim()).filter(Boolean) : null;
  if (!guidance) v.add('guidance', 'informe a lista de orientações');
  else v.check(guidance.length <= 12 && guidance.every((g) => g.length <= 300), 'guidance', 'até 12 orientações de até 300 caracteres');
  const pointsPerKg = numField(v, b, 'pointsPerKg', 0, 1000, true);
  const co2FactorKg = numField(v, b, 'co2FactorKg', 0, 50);
  const recyclable = boolField(v, b, 'recyclable');
  const color = str(b.color) ?? '';
  v.check(/^#[0-9A-Fa-f]{6}$/.test(color), 'color', 'use uma cor hexadecimal (#RRGGBB)');
  const icon = textField(v, b, 'icon', 1, 40, 'ícone');
  const maxKgPerDisposal = numField(v, b, 'maxKgPerDisposal', 0.1, 1000);
  const active = boolField(v, b, 'active');
  v.throwIfAny();
  return { code, name, description, guidance: guidance!, pointsPerKg, co2FactorKg, recyclable, color: color.toUpperCase(), icon, maxKgPerDisposal, active };
}

function collectionPointInput(body: unknown): Omit<CollectionPointRec, 'id'> {
  const b = bodyObject(body);
  const v = new Validator();
  const out = {
    name: textField(v, b, 'name', 3, 120, 'nome'),
    address: textField(v, b, 'address', 5, 200, 'endereço'),
    neighborhood: textField(v, b, 'neighborhood', 2, 80, 'bairro'),
    latitude: numField(v, b, 'latitude', -90, 90),
    longitude: numField(v, b, 'longitude', -180, 180),
    openingHours: textField(v, b, 'openingHours', 3, 120, 'horário'),
    categories: validateCategoryCodes(v, 'categories', b.categories),
    active: boolField(v, b, 'active'),
  };
  v.throwIfAny();
  return out;
}

function rewardInput(body: unknown): Omit<Reward, 'id'> {
  const b = bodyObject(body);
  const v = new Validator();
  const partner = b.partner === null || b.partner === undefined ? null : str(b.partner);
  if (partner && partner.length > 120) v.add('partner', 'máximo de 120 caracteres');
  const out = {
    name: textField(v, b, 'name', 2, 80, 'nome'),
    description: textField(v, b, 'description', 0, 500, 'descrição'),
    costPoints: numField(v, b, 'costPoints', 1, 1_000_000, true),
    stock: numField(v, b, 'stock', 0, 1_000_000, true),
    icon: textField(v, b, 'icon', 1, 40, 'ícone'),
    partner: partner || null,
    active: boolField(v, b, 'active'),
  };
  v.throwIfAny();
  return out;
}

function challengeInput(body: unknown): Omit<ChallengeRec, 'id'> {
  const b = bodyObject(body);
  const v = new Validator();
  const categoryCode = b.categoryCode ?? null;
  if (categoryCode !== null && !CATEGORY_CODES.includes(categoryCode as CategoryCode)) v.add('categoryCode', 'categoria inválida');
  const metric = b.metric as ChallengeMetric;
  v.check(metric === 'KG' || metric === 'COUNT', 'metric', 'use KG ou COUNT');
  const startsAt = str(b.startsAt) ?? '';
  const endsAt = str(b.endsAt) ?? '';
  v.check(DATE_RE.test(startsAt), 'startsAt', 'data inválida (AAAA-MM-DD)');
  if (v.check(DATE_RE.test(endsAt), 'endsAt', 'data inválida (AAAA-MM-DD)') && DATE_RE.test(startsAt)) {
    v.check(endsAt >= startsAt, 'endsAt', 'o fim deve ser depois do início');
  }
  const out = {
    title: textField(v, b, 'title', 3, 100, 'título'),
    description: textField(v, b, 'description', 0, 500, 'descrição'),
    categoryCode: categoryCode as CategoryCode | null,
    metric,
    target: numField(v, b, 'target', 0.1, 100_000),
    bonusPoints: numField(v, b, 'bonusPoints', 0, 100_000, true),
    startsAt,
    endsAt,
    active: boolField(v, b, 'active'),
  };
  v.throwIfAny();
  return out;
}

function goalInput(body: unknown): Omit<GoalRec, 'id'> {
  const b = bodyObject(body);
  const v = new Validator();
  const out = {
    year: numField(v, b, 'year', 2024, 2100, true),
    title: textField(v, b, 'title', 3, 120, 'título'),
    targetRecyclingRate: numField(v, b, 'targetRecyclingRate', 0, 1),
    targetKg: numField(v, b, 'targetKg', 0, 1_000_000_000),
  };
  v.throwIfAny();
  return out;
}

// ---------------------------------------------------------------- rotas (otimização)

interface PlanStop { id: string; latitude: number; longitude: number; kg: number; address: string }

function routeBody(d: MockDb, body: unknown, forCreate: boolean) {
  const b = bodyObject(body);
  const v = new Validator();
  const ids = Array.isArray(b.requestIds) ? (b.requestIds as unknown[]) : null;
  if (!ids || !ids.length) v.add('requestIds', 'selecione ao menos uma solicitação');
  else if (ids.length > 100) v.add('requestIds', 'no máximo 100 solicitações por vez');
  else if (ids.some((x) => typeof x !== 'string' || !UUID_RE.test(x))) v.add('requestIds', 'id inválido');
  let depot: GeoPoint = DEFAULT_DEPOT;
  if (b.depot !== undefined && b.depot !== null) {
    const dp = b.depot as Json;
    const ok2 = typeof dp.latitude === 'number' && typeof dp.longitude === 'number' && Math.abs(dp.latitude) <= 90 && Math.abs(dp.longitude) <= 180;
    if (v.check(ok2, 'depot', 'garagem inválida')) depot = { latitude: dp.latitude as number, longitude: dp.longitude as number };
  }
  let capacity = DEFAULT_CAPACITY_KG;
  if (b.vehicleCapacityKg !== undefined && b.vehicleCapacityKg !== null) capacity = numField(v, b, 'vehicleCapacityKg', 10, 50_000);
  v.throwIfAny();
  const requests: CollectionRequestRec[] = [];
  for (const id of new Set(ids as string[])) {
    const r = d.collectionRequests.find((x) => x.id === id);
    if (!r) throw fail.field('requestIds', 'solicitação não encontrada');
    if (forCreate ? r.status !== 'REQUESTED' : !OPEN_REQUEST.includes(r.status)) {
      throw fail.business(forCreate ? 'Só é possível roteirizar solicitações com status "Solicitada".' : 'Há solicitações que não estão em aberto.');
    }
    requests.push(r);
  }
  requests.sort((a, c) => a.createdAt.localeCompare(c.createdAt));
  const stops: PlanStop[] = requests.map((r) => ({ id: r.id, latitude: r.latitude, longitude: r.longitude, kg: r.estimatedKg, address: r.address }));
  return { b, depot, capacity, plan: optimize(depot, stops, capacity) };
}

// ---------------------------------------------------------------- CSV

function csvCell(value: string): string {
  let v = value;
  if (/^[=+\-@\t\r]/.test(v)) v = `'${v}`; // proteção contra CSV/Formula Injection
  if (/[;"\n\r]/.test(v)) v = `"${v.replace(/"/g, '""')}"`;
  return v;
}

const dateTimeFmt = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const fmtDt = (iso: string) => dateTimeFmt.format(new Date(iso)).replace(',', '');

// ---------------------------------------------------------------- registro

export function registerAdminRoutes() {
  route('GET', '/admin/overview', () => {
    const d = db();
    const now = Date.now();
    const catById = new Map(d.categories.map((c) => [c.id, c]));
    const approved = d.disposals.filter((x) => x.status === 'APPROVED');
    const days: AdminOverview['disposalsLast14Days'] = [];
    const today = localDate(new Date(now));
    for (let i = 13; i >= 0; i--) days.push({ date: addDays(today, -i), count: 0, kg: 0 });
    const byDay = new Map(days.map((x) => [x.date, x]));
    for (const x of d.disposals) {
      const e = byDay.get(localDate(x.createdAt));
      if (e) { e.count++; e.kg = round(e.kg + x.quantityKg); }
    }
    const activeIds = new Set(d.disposals.filter((x) => now - Date.parse(x.createdAt) <= 30 * DAY).map((x) => x.userId));
    d.users.forEach((u) => { if (isRecent(u.lastLoginAt, now, 30)) activeIds.add(u.id); });
    return ok<AdminOverview>({
      users: d.users.length,
      activeUsers30d: activeIds.size,
      pendingDisposals: d.disposals.filter((x) => x.status === 'PENDING').length,
      flaggedDisposals: d.disposals.filter((x) => x.status === 'PENDING' && x.fraudScore >= FLAG_THRESHOLD).length,
      openCollectionRequests: d.collectionRequests.filter((r) => OPEN_REQUEST.includes(r.status)).length,
      binsNeedingCollection: d.bins.filter((b) => b.fillLevel >= b.autoRequestThreshold).length,
      totalKg: round(approved.reduce((s, x) => s + x.quantityKg, 0)),
      recycledKg: round(approved.reduce((s, x) => s + (catById.get(x.categoryId)?.recyclable ? x.quantityKg : 0), 0)),
      pointsIssued: d.transactions.filter((t) => t.amount > 0 && (t.type === 'EARN' || t.type === 'BONUS')).reduce((s, t) => s + t.amount, 0),
      redemptions: d.redemptions.length,
      disposalsLast14Days: days,
      recentAudit: d.audit.slice(0, 10).map((e) => ({ ...e })),
    });
  }, A);

  // ---------- usuários
  route('GET', '/admin/users', ({ query }) => {
    const d = db();
    const q = fold(query.get('q')?.trim() ?? '');
    const role = enumParam(query, 'role', ROLES);
    const page = intParam(query, 'page', 0, 0, 10_000);
    const size = intParam(query, 'size', 20, 1, 100);
    const list = d.users
      .filter((u) => (!role || u.role === role) && (!q || fold(u.name).includes(q) || u.email.includes(q)))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    const p = paginate(list, page, size);
    return ok<Page<AdminUser>>({ ...p, content: p.content.map((u) => toAdminUser(d, u)) });
  }, A);

  route('PATCH', '/admin/users/:id', ({ me, params, body }) => {
    const d = db();
    const u = d.users.find((x) => x.id === params.id);
    if (!u) throw fail.notFound('Usuário não encontrado.');
    const b = bodyObject(body);
    const v = new Validator();
    if (b.role !== undefined && !ROLES.includes(b.role as Role)) v.add('role', 'perfil inválido');
    if (b.enabled !== undefined && typeof b.enabled !== 'boolean') v.add('enabled', 'informe verdadeiro ou falso');
    v.throwIfAny();
    if (u.id === me.id && ((b.role !== undefined && b.role !== me.role) || b.enabled === false)) {
      throw fail.business('Você não pode alterar o próprio perfil nem desativar a própria conta.');
    }
    const changes: string[] = [];
    if (b.role !== undefined && b.role !== u.role) { changes.push(`perfil ${u.role} → ${b.role}`); u.role = b.role as Role; }
    if (typeof b.enabled === 'boolean' && b.enabled !== u.enabled) {
      changes.push(b.enabled ? 'reativado' : 'desativado');
      u.enabled = b.enabled;
      if (!u.enabled) u.sessionEpoch++; // encerra as sessões
      else { u.lockedUntil = null; u.failedLogins = 0; }
    }
    if (changes.length) audit(d, me, 'USER_UPDATED', 'User', u.id, changes.join(', '));
    return ok<AdminUser>(toAdminUser(d, u));
  }, A);

  // ---------- descartes
  route('GET', '/admin/disposals', ({ query }) => {
    const d = db();
    const status = enumParam(query, 'status', DISPOSAL_STATUSES);
    const flagged = query.get('flagged') === 'true';
    const page = intParam(query, 'page', 0, 0, 10_000);
    const size = intParam(query, 'size', 20, 1, 100);
    const list = d.disposals
      .filter((x) => (!status || x.status === status) && (!flagged || x.fraudScore >= FLAG_THRESHOLD))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const p = paginate(list, page, size);
    return ok<Page<Disposal>>({ ...p, content: p.content.map((x) => toDisposal(d, x, true)) });
  }, A);

  route('POST', '/admin/disposals/:id/approve', ({ me, params, body }) => {
    const d = db();
    const x = d.disposals.find((k) => k.id === params.id);
    if (!x) throw fail.notFound('Descarte não encontrado.');
    if (x.status === 'REJECTED') throw fail.conflict('Este descarte já foi recusado e não pode ser aprovado.');
    if (x.status === 'APPROVED') return ok<Disposal>(toDisposal(d, x, true)); // pontos só uma vez
    if (x.userId === me.id) throw fail.business('Você não pode aprovar o seu próprio descarte.');
    const b = bodyObject(body);
    let note = '';
    if (b.categoryId !== undefined || b.quantityKg !== undefined) {
      const before = d.categories.find((c) => c.id === x.categoryId)!;
      const category = b.categoryId === undefined || b.categoryId === null ? before : d.categories.find((c) => c.id === b.categoryId);
      if (!category) throw fail.field('categoryId', 'categoria não encontrada');
      let kg = x.quantityKg;
      if (b.quantityKg !== undefined && b.quantityKg !== null) {
        if (typeof b.quantityKg !== 'number' || b.quantityKg < 0.01) throw fail.field('quantityKg', 'a quantidade mínima é 0,01 kg');
        kg = round(b.quantityKg, 3);
      }
      if (kg > category.maxKgPerDisposal) throw fail.field('quantityKg', `máximo de ${category.maxKgPerDisposal} kg para ${category.name}`);
      if (category.id !== before.id || kg !== x.quantityKg) {
        note = ` (corrigido: ${before.code} ${x.quantityKg} kg -> ${category.code} ${kg} kg)`;
        x.categoryId = category.id;
        x.quantityKg = kg;
      }
    }
    const awarded = approveDisposal(d, x, nowIso());
    audit(d, me, 'DISPOSAL_APPROVED', 'Disposal', x.id, `+${awarded} pontos${note}`);
    return ok<Disposal>(toDisposal(d, x, true));
  }, A);

  route('POST', '/admin/disposals/:id/reject', ({ me, params, body }) => {
    const d = db();
    const x = d.disposals.find((k) => k.id === params.id);
    if (!x) throw fail.notFound('Descarte não encontrado.');
    if (x.status === 'APPROVED') throw fail.conflict('Este descarte já foi aprovado e não pode ser recusado.');
    const reason = str(bodyObject(body).reason) ?? '';
    if (reason.length < 3) throw fail.field('reason', 'informe o motivo da recusa');
    if (reason.length > 300) throw fail.field('reason', 'máximo de 300 caracteres');
    if (x.status === 'PENDING') {
      x.status = 'REJECTED';
      x.reviewedAt = nowIso();
      x.rejectionReason = reason;
      audit(d, me, 'DISPOSAL_REJECTED', 'Disposal', x.id, reason);
    }
    return ok<Disposal>(toDisposal(d, x, true));
  }, A);

  // ---------- categorias
  route('POST', '/admin/categories', ({ me, body }) => {
    const d = db();
    const c: Category = { id: crypto.randomUUID(), ...categoryInput(d, body, null) };
    d.categories.push(c);
    audit(d, me, 'CATEGORY_CREATED', 'Category', c.id, c.name);
    return created<Category>({ ...c });
  }, A);

  route('PUT', '/admin/categories/:id', ({ me, params, body }) => {
    const d = db();
    const c = d.categories.find((x) => x.id === params.id);
    if (!c) throw fail.notFound('Categoria não encontrada.');
    Object.assign(c, categoryInput(d, body, c.id));
    audit(d, me, 'CATEGORY_UPDATED', 'Category', c.id, c.name);
    return ok<Category>({ ...c });
  }, A);

  // ---------- ecopontos
  route('POST', '/admin/collection-points', ({ me, body }) => {
    const d = db();
    const p: CollectionPointRec = { id: crypto.randomUUID(), ...collectionPointInput(body) };
    d.collectionPoints.push(p);
    audit(d, me, 'COLLECTION_POINT_CREATED', 'CollectionPoint', p.id, p.name);
    return created<CollectionPoint>(toCollectionPoint(p, null));
  }, A);

  route('PUT', '/admin/collection-points/:id', ({ me, params, body }) => {
    const d = db();
    const p = d.collectionPoints.find((x) => x.id === params.id);
    if (!p) throw fail.notFound('Ecoponto não encontrado.');
    Object.assign(p, collectionPointInput(body));
    audit(d, me, 'COLLECTION_POINT_UPDATED', 'CollectionPoint', p.id, p.name);
    return ok<CollectionPoint>(toCollectionPoint(p, null));
  }, A);

  route('DELETE', '/admin/collection-points/:id', ({ me, params }) => {
    const d = db();
    const p = d.collectionPoints.find((x) => x.id === params.id);
    if (!p) throw fail.notFound('Ecoponto não encontrado.');
    if (d.disposals.some((x) => x.collectionPointId === p.id)) {
      p.active = false; // há histórico vinculado: desativa em vez de apagar
    } else {
      d.collectionPoints = d.collectionPoints.filter((x) => x.id !== p.id);
    }
    audit(d, me, 'COLLECTION_POINT_DELETED', 'CollectionPoint', p.id, p.name);
    return noContent();
  }, A);

  // ---------- recompensas
  route('GET', '/admin/rewards', () =>
    ok<Reward[]>(db().rewards.slice().sort((a, b) => a.costPoints - b.costPoints).map((r) => ({ ...r }))), A);

  route('POST', '/admin/rewards', ({ me, body }) => {
    const d = db();
    const r: Reward = { id: crypto.randomUUID(), ...rewardInput(body) };
    d.rewards.push(r);
    audit(d, me, 'REWARD_CREATED', 'Reward', r.id, r.name);
    return created<Reward>({ ...r });
  }, A);

  route('PUT', '/admin/rewards/:id', ({ me, params, body }) => {
    const d = db();
    const r = d.rewards.find((x) => x.id === params.id);
    if (!r) throw fail.notFound('Recompensa não encontrada.');
    Object.assign(r, rewardInput(body));
    audit(d, me, 'REWARD_UPDATED', 'Reward', r.id, r.name);
    return ok<Reward>({ ...r });
  }, A);

  // ---------- desafios
  route('GET', '/admin/challenges', () => {
    const d = db();
    return ok<Challenge[]>([...d.challenges].sort((a, b) => b.startsAt.localeCompare(a.startsAt)).map((c) => toChallenge(d, c, null)));
  }, A);

  route('POST', '/admin/challenges', ({ me, body }) => {
    const d = db();
    const c: ChallengeRec = { id: crypto.randomUUID(), ...challengeInput(body) };
    d.challenges.push(c);
    audit(d, me, 'CHALLENGE_CREATED', 'Challenge', c.id, c.title);
    return created<Challenge>(toChallenge(d, c, null));
  }, A);

  route('PUT', '/admin/challenges/:id', ({ me, params, body }) => {
    const d = db();
    const c = d.challenges.find((x) => x.id === params.id);
    if (!c) throw fail.notFound('Desafio não encontrado.');
    Object.assign(c, challengeInput(body));
    audit(d, me, 'CHALLENGE_UPDATED', 'Challenge', c.id, c.title);
    return ok<Challenge>(toChallenge(d, c, null));
  }, A);

  // ---------- organizações
  route('GET', '/admin/organizations', () =>
    ok<Organization[]>([...db().organizations].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')).map((o) => ({ ...o }))), A);

  route('POST', '/admin/organizations', ({ me, body }) => {
    const d = db();
    const b = bodyObject(body);
    const v = new Validator();
    const name = textField(v, b, 'name', 2, 120, 'nome');
    const type = b.type as OrganizationType;
    v.check(ORG_TYPES.includes(type), 'type', 'tipo inválido');
    if (!v.has('name') && d.organizations.some((o) => fold(o.name) === fold(name))) v.add('name', 'já existe uma organização com este nome');
    v.throwIfAny();
    const o: Organization = { id: crypto.randomUUID(), name, type };
    d.organizations.push(o);
    audit(d, me, 'ORGANIZATION_CREATED', 'Organization', o.id, name);
    return created<Organization>({ ...o });
  }, A);

  // ---------- metas
  route('GET', '/admin/goals', () => {
    const d = db();
    return ok<Goal[]>([...d.goals].sort((a, b) => a.year - b.year).map((g) => goalDto(d, g)));
  }, A);

  route('POST', '/admin/goals', ({ me, body }) => {
    const d = db();
    const g: GoalRec = { id: crypto.randomUUID(), ...goalInput(body) };
    d.goals.push(g);
    audit(d, me, 'GOAL_CREATED', 'Goal', g.id, `${g.year} - ${g.title}`);
    return created<Goal>(goalDto(d, g));
  }, A);

  route('PUT', '/admin/goals/:id', ({ me, params, body }) => {
    const d = db();
    const g = d.goals.find((x) => x.id === params.id);
    if (!g) throw fail.notFound('Meta não encontrada.');
    Object.assign(g, goalInput(body));
    audit(d, me, 'GOAL_UPDATED', 'Goal', g.id, `${g.year} - ${g.title}`);
    return ok<Goal>(goalDto(d, g));
  }, A);

  // ---------- coletas e rotas
  route('GET', '/admin/collection-requests', ({ query }) => {
    const d = db();
    const status = enumParam(query, 'status', REQUEST_STATUSES);
    return ok<CollectionRequest[]>(d.collectionRequests
      .filter((r) => !status || r.status === status)
      .map((r) => toCollectionRequest(d, r))
      .sort((a, b) => b.priority - a.priority || b.createdAt.localeCompare(a.createdAt)));
  }, A);

  route('GET', '/admin/collectors', () =>
    ok<UserRef[]>(db().users.filter((u) => u.enabled && (u.role === 'COLLECTOR' || u.role === 'ADMIN'))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')).map((u) => userRef(u)!)), A);

  route('POST', '/admin/routes/optimize', ({ body }) => {
    const d = db();
    const { depot, plan } = routeBody(d, body, false);
    return ok<RouteOptimization>({
      algorithm: ALGORITHM,
      routes: plan.trips.map((t) => ({
        stops: t.stops.map((s, i) => ({ requestId: s.id, sequence: i + 1, latitude: s.latitude, longitude: s.longitude, address: s.address, estimatedKg: s.kg })),
        distanceKm: t.distanceKm, naiveDistanceKm: t.naiveDistanceKm, estimatedMinutes: t.estimatedMinutes, loadKg: t.loadKg,
      })),
      totalDistanceKm: plan.totalDistanceKm,
      naiveTotalDistanceKm: plan.naiveTotalDistanceKm,
      savingsPercent: plan.savingsPercent,
      depot,
    });
  }, A);

  route('POST', '/admin/routes', ({ me, body }) => {
    const d = db();
    const { b, depot, plan } = routeBody(d, body, true);
    const v = new Validator();
    const name = textField(v, b, 'name', 3, 80, 'nome');
    const plannedDate = str(b.plannedDate) ?? '';
    if (v.check(DATE_RE.test(plannedDate), 'plannedDate', 'data inválida (AAAA-MM-DD)')) {
      v.check(plannedDate >= localDate(new Date()), 'plannedDate', 'a data não pode estar no passado');
    }
    const collectorId = b.collectorId ?? null;
    if (collectorId !== null && !d.users.some((u) => u.id === collectorId && u.enabled && (u.role === 'COLLECTOR' || u.role === 'ADMIN'))) {
      v.add('collectorId', 'coletor não encontrado');
    }
    v.throwIfAny();
    const at = nowIso();
    const createdRoutes: RouteRec[] = plan.trips.map((t, i) => {
      const rec: RouteRec = {
        id: crypto.randomUUID(),
        name: plan.trips.length > 1 ? `${name} (${i + 1}/${plan.trips.length})` : name,
        status: 'PLANNED',
        collectorId: collectorId as string | null,
        plannedDate,
        totalDistanceKm: t.distanceKm,
        naiveDistanceKm: t.naiveDistanceKm,
        estimatedMinutes: t.estimatedMinutes,
        loadKg: t.loadKg,
        depot,
        stops: t.stops.map((s, k) => ({
          id: crypto.randomUUID(), sequence: k + 1, requestId: s.id, address: s.address, latitude: s.latitude, longitude: s.longitude,
          estimatedKg: s.kg, status: 'PENDING', completedAt: null, collectedKg: null,
        })),
        createdAt: at,
      };
      for (const s of rec.stops) {
        const r = d.collectionRequests.find((x) => x.id === s.requestId)!;
        r.status = 'SCHEDULED';
        r.routeId = rec.id;
        r.scheduledFor = plannedDate;
        r.updatedAt = at;
      }
      d.routes.push(rec);
      audit(d, me, 'ROUTE_CREATED', 'Route', rec.id, `${rec.name} — ${rec.stops.length} paradas, ${rec.totalDistanceKm} km`);
      return rec;
    });
    return created<Route[]>(createdRoutes.map((r) => toRoute(d, r)));
  }, A);

  route('GET', '/admin/routes', () => {
    const d = db();
    return ok<Route[]>([...d.routes].sort((a, b) => b.plannedDate.localeCompare(a.plannedDate) || b.createdAt.localeCompare(a.createdAt)).map((r) => toRoute(d, r)));
  }, A);

  // ---------- lixeiras, auditoria e relatório
  route('GET', '/admin/bins', () => {
    const d = db();
    return ok<SmartBin[]>([...d.bins].sort((a, b) => b.fillLevel - a.fillLevel).map((b) => toSmartBin(d, b, true)));
  }, A);

  route('GET', '/admin/audit', ({ query }) => {
    const page = intParam(query, 'page', 0, 0, 10_000);
    const size = intParam(query, 'size', 20, 1, 100);
    const actions = query.getAll('action').flatMap((a) => a.split(',')).map((a) => a.trim()).filter(Boolean);
    const v = new Validator();
    v.check(actions.length <= 50, 'action', 'no máximo 50 ações por filtro');
    v.check(actions.every((a) => /^[A-Z][A-Z0-9_]{0,59}$/.test(a)), 'action', 'ação inválida');
    v.throwIfAny();
    const text = (query.get('q') ?? '').trim().slice(0, 100).toLowerCase();
    const rows = db().audit.filter((e) => (!actions.length || actions.includes(e.action))
      && (!text || [e.actor, e.details, e.entity, e.ip].some((x) => x?.toLowerCase().includes(text))));
    const p = paginate(rows, page, size);
    return ok<Page<AuditEntry>>({ ...p, content: p.content.map((e) => ({ ...e })) });
  }, A);

  route('GET', '/admin/reports/disposals.csv', ({ me, query }) => {
    const d = db();
    const today = localDate(new Date());
    const from = query.get('from') || addDays(today, -30);
    const to = query.get('to') || today;
    const v = new Validator();
    v.check(DATE_RE.test(from), 'from', 'data inválida (AAAA-MM-DD)');
    v.check(DATE_RE.test(to), 'to', 'data inválida (AAAA-MM-DD)');
    v.throwIfAny();
    if (from > to) throw fail.field('from', 'a data inicial deve ser anterior à final');
    if (Date.parse(to) - Date.parse(from) > 366 * DAY) throw fail.field('to', 'o período máximo é de 366 dias');
    const rows = d.disposals
      .filter((x) => { const day = localDate(x.disposedAt); return day >= from && day <= to; })
      .sort((a, b) => a.disposedAt.localeCompare(b.disposedAt));
    const kgFmt = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3, useGrouping: false });
    let csv = '﻿id;data;usuario;email;categoria;kg;status;pontos;risco_fraude;sinalizado;revisado_em;motivo_recusa\n';
    for (const x of rows) {
      const u = d.users.find((k) => k.id === x.userId);
      const c = d.categories.find((k) => k.id === x.categoryId);
      csv += [
        x.id, fmtDt(x.disposedAt), u?.name ?? '', u?.email ?? '', c?.name ?? '', kgFmt.format(x.quantityKg), x.status,
        String(x.pointsAwarded), String(x.fraudScore), x.fraudScore >= FLAG_THRESHOLD ? 'sim' : 'nao',
        x.reviewedAt ? fmtDt(x.reviewedAt) : '', x.rejectionReason ?? '',
      ].map(csvCell).join(';') + '\n';
    }
    audit(d, me, 'REPORT_EXPORTED', 'Report', 'disposals.csv', `${from} a ${to} (${rows.length} linhas)`);
    return {
      status: 200,
      blob: new Blob([csv], { type: 'text/csv;charset=utf-8' }),
      headers: { 'Content-Disposition': `attachment; filename="descartes_${from}_${to}.csv"` },
    };
  }, A);
}
