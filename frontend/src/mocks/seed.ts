/**
 * Semeadura determinística (PRNG com semente fixa). As datas são relativas ao momento da semeadura,
 * para que a demo sempre pareça "viva": ~12 meses de histórico, desafios do mês atual, rotas de hoje.
 *
 * Os pontos não são inventados: os descartes são criados PENDENTES e depois "aprovados" em ordem
 * cronológica pela mesma regra do servidor (approveDisposal), o que gera transações, desafios
 * concluídos, bônus e medalhas de forma consistente.
 */
import type { Category, CategoryCode, GeoPoint, Organization } from '@/api/types';
import type {
  ChallengeRec, CollectionPointRec, CollectionRequestRec, DisposalRec, GoalRec, HouseholdRec, MockDb, PhotoRec, RouteRec,
  SmartBinRec, UserRec,
} from './db';
import { audit } from './logic/audit';
import { openAutomaticRequest } from './logic/bins';
import { DAY, HOUR, addDays, localDate } from './logic/dates';
import { DEFAULT_DEPOT, haversineKm, neighborhoodPoint } from './logic/geo';
import { demoHash } from './logic/password';
import { approveDisposal, debit, evaluateBadges } from './logic/points';
import { createRng, randomCode, round, type Rng } from './logic/random';
import { optimize } from './logic/routes';
import {
  CATEGORIES, COLLECTION_POINTS, DISPOSAL_NOTES, HOUSEHOLDS, ORGANIZATIONS, REJECTION_REASONS, RESIDENT_PASSWORD, REWARDS, STREETS,
} from './seedData';

const KG_RANGE: Record<CategoryCode, [number, number]> = {
  PLASTICO: [0.3, 3], PAPEL: [0.5, 5], VIDRO: [0.5, 4], METAL: [0.2, 2], ORGANICO: [0.5, 6], ELETRONICO: [0.2, 3], REJEITO: [0.3, 3],
};
const CATEGORY_WEIGHTS: [CategoryCode, number][] = [
  ['PLASTICO', 28], ['PAPEL', 24], ['VIDRO', 12], ['METAL', 10], ['ORGANICO', 16], ['ELETRONICO', 3], ['REJEITO', 7],
];

function placeholderPhoto(c: Category): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480" viewBox="0 0 640 480">`
    + `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c.color}" stop-opacity=".9"/>`
    + `<stop offset="1" stop-color="#0b3d2e"/></linearGradient></defs><rect width="640" height="480" fill="url(#g)"/>`
    + `<circle cx="320" cy="200" r="90" fill="#fff" fill-opacity=".18"/>`
    + `<text x="320" y="215" font-family="sans-serif" font-size="44" font-weight="700" fill="#fff" text-anchor="middle">${c.name}</text>`
    + `<text x="320" y="400" font-family="sans-serif" font-size="22" fill="#fff" fill-opacity=".8" text-anchor="middle">Foto ilustrativa — modo demonstração</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function jitter(rng: Rng, p: GeoPoint, amount = 0.004): GeoPoint {
  return { latitude: round(p.latitude + (rng.next() - 0.5) * amount, 6), longitude: round(p.longitude + (rng.next() - 0.5) * amount, 6) };
}

export function seedDatabase(version: number, nowDate: Date): MockDb {
  const rng = createRng(20502026);
  const now = nowDate.getTime();
  const iso = (t: number) => new Date(t).toISOString();
  const today = localDate(nowDate);
  const monthStart = `${today.slice(0, 8)}01`;
  const nextMonth = new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)), 1));
  const monthEnd = addDays(nextMonth.toISOString().slice(0, 10), -1);

  const d: MockDb = {
    version, seededAt: iso(now), users: [], organizations: [], categories: [], disposals: [], photos: [], transactions: [],
    userBadges: [], challenges: [], completions: [], rewards: [], redemptions: [], collectionPoints: [], collectionRequests: [],
    routes: [], households: [], bins: [], goals: [], audit: [], idempotency: {},
  };

  // ---------------------------------------------------------------- referência
  d.categories = CATEGORIES.map((c) => ({ id: rng.uuid(), ...c, guidance: [...c.guidance], active: true }));
  const cat = (code: CategoryCode) => d.categories.find((c) => c.code === code)!;
  const orgByKey = new Map<string, Organization>();
  for (const o of ORGANIZATIONS) {
    const org: Organization = { id: rng.uuid(), name: o.name, type: o.type };
    d.organizations.push(org);
    orgByKey.set(o.key, org);
  }
  d.collectionPoints = COLLECTION_POINTS.map((p): CollectionPointRec => ({ id: rng.uuid(), ...p, categories: [...p.categories], active: true }));
  d.rewards = REWARDS.map((r) => ({ id: rng.uuid(), ...r, active: true }));
  const seedPhotos = new Map<CategoryCode, PhotoRec>();
  for (const c of d.categories) {
    const p: PhotoRec = { id: rng.uuid(), ownerId: null, dataUrl: placeholderPhoto(c), mime: 'image/svg+xml', width: 640, height: 480, hash: null, createdAt: iso(now - 400 * DAY) };
    d.photos.push(p);
    seedPhotos.set(c.code, p);
  }

  // ---------------------------------------------------------------- usuários
  const mkUser = (name: string, email: string, password: string, role: UserRec['role'], createdDaysAgo: number, extra: Partial<UserRec> = {}): UserRec => {
    const u: UserRec = {
      id: rng.uuid(), name, email, passwordHash: demoHash(password, randomCode(8, rng.next)), role, enabled: true, failedLogins: 0,
      lockedUntil: null, householdId: null, organizationId: null, points: 0, totalEarned: 0, sessionEpoch: 0,
      createdAt: iso(now - createdDaysAgo * DAY - rng.int(0, 20) * HOUR), lastLoginAt: iso(now - rng.int(1, 72) * HOUR), ...extra,
    };
    d.users.push(u);
    return u;
  };
  const admin = mkUser('Ana Ribeiro', 'admin@ecotechzero.com.br', 'EcoTech@2050', 'ADMIN', 400);
  const collector = mkUser('Carlos Henrique Lima', 'coletor@ecotechzero.com.br', 'Coleta@2050', 'COLLECTOR', 390);
  const collector2 = mkUser('Juliana Matos', 'juliana.matos@ecotechzero.com.br', RESIDENT_PASSWORD, 'COLLECTOR', 200);
  const morador = mkUser('Mariana Alves', 'morador@ecotechzero.com.br', 'Recicla@2050', 'USER', 370, { organizationId: orgByKey.get('CC4')!.id });

  const activity = new Map<string, number>([[morador.id, 1.6]]);
  for (const hs of HOUSEHOLDS) {
    const base = neighborhoodPoint(hs.neighborhood);
    const loc = jitter(rng, base, 0.006);
    const members = hs.members.map((m) => {
      const u = mkUser(m.name, m.email, RESIDENT_PASSWORD, 'USER', m.joinedDaysAgo, { organizationId: m.org ? orgByKey.get(m.org)!.id : null });
      activity.set(u.id, m.activity);
      return u;
    });
    if (hs.key === 'MARIANA') members.unshift(morador);
    const h: HouseholdRec = {
      id: rng.uuid(), name: hs.name, neighborhood: hs.neighborhood, city: hs.neighborhood === 'Vila Sônia' ? 'São Paulo' : 'Taboão da Serra',
      inviteCode: randomCode(8, rng.next), ownerId: members[0].id, address: hs.address, latitude: loc.latitude, longitude: loc.longitude,
      createdAt: members[0].createdAt,
    };
    d.households.push(h);
    members.forEach((u) => { u.householdId = h.id; });
  }
  // um morador desativado e um sem residência, para a tela de usuários
  const lone = mkUser('Diego Almeida', 'diego.almeida@exemplo.com.br', RESIDENT_PASSWORD, 'USER', 60);
  activity.set(lone.id, 0.5);
  mkUser('Conta Suspensa (teste)', 'suspensa@exemplo.com.br', RESIDENT_PASSWORD, 'USER', 90, { enabled: false, lastLoginAt: iso(now - 40 * DAY) });

  const householdOf = (u: UserRec) => d.households.find((h) => h.id === u.householdId) ?? null;

  // ---------------------------------------------------------------- desafios e metas
  const ch = (c: Omit<ChallengeRec, 'id'>): ChallengeRec => { const r = { id: rng.uuid(), ...c }; d.challenges.push(r); return r; };
  const monthName = new Intl.DateTimeFormat('pt-BR', { month: 'long', timeZone: 'America/Sao_Paulo' }).format(nowDate);
  ch({ title: `Plástico em dia (${monthName})`, description: 'Recicle 8 kg de plástico neste mês.', categoryCode: 'PLASTICO', metric: 'KG', target: 8, bonusPoints: 80, startsAt: monthStart, endsAt: monthEnd, active: true });
  ch({ title: '10 descartes no mês', description: 'Registre 10 descartes aprovados neste mês.', categoryCode: null, metric: 'COUNT', target: 10, bonusPoints: 100, startsAt: monthStart, endsAt: monthEnd, active: true });
  ch({ title: 'Semana do vidro', description: 'Leve 3 kg de vidro a um ecoponto nesta semana.', categoryCode: 'VIDRO', metric: 'KG', target: 3, bonusPoints: 40, startsAt: addDays(today, -3), endsAt: addDays(today, 4), active: true });
  ch({ title: 'E-lixo zero', description: 'Descarte corretamente 2 kg de eletrônicos, pilhas ou cabos.', categoryCode: 'ELETRONICO', metric: 'KG', target: 2, bonusPoints: 120, startsAt: addDays(today, -20), endsAt: addDays(today, 40), active: true });
  ch({ title: 'Compostagem em casa', description: 'Composte 10 kg de orgânicos.', categoryCode: 'ORGANICO', metric: 'KG', target: 10, bonusPoints: 90, startsAt: addDays(monthStart, -31).slice(0, 8) + '01', endsAt: addDays(monthStart, -1), active: true });
  ch({ title: 'Maratona da reciclagem', description: '25 descartes aprovados em dois meses.', categoryCode: null, metric: 'COUNT', target: 25, bonusPoints: 200, startsAt: addDays(today, -110), endsAt: addDays(today, -50), active: true });
  ch({ title: 'Natal sem desperdício', description: 'Recicle 15 kg de papel e papelão das embalagens de fim de ano.', categoryCode: 'PAPEL', metric: 'KG', target: 15, bonusPoints: 150, startsAt: `${today.slice(0, 4)}-12-01`, endsAt: `${today.slice(0, 4)}-12-31`, active: true });

  const year = Number(today.slice(0, 4));
  const goals: Omit<GoalRec, 'id'>[] = [
    { year, title: `Meta ${year} — Taboão Recicla`, targetRecyclingRate: 0.85, targetKg: 4500 },
    { year: 2030, title: 'Meta 2030 — metade do caminho', targetRecyclingRate: 0.9, targetKg: 12000 },
    { year: 2050, title: 'Lixo Zero 2050', targetRecyclingRate: 0.98, targetKg: 30000 },
  ];
  d.goals = goals.map((g) => ({ id: rng.uuid(), ...g }));

  // ---------------------------------------------------------------- descartes (12 meses)
  const residents = d.users.filter((u) => u.role === 'USER' && u.enabled);
  const finalStatus = new Map<string, 'APPROVED' | 'REJECTED' | 'PENDING'>();
  for (const u of residents) {
    const a = activity.get(u.id) ?? 0.8;
    const start = Math.max(Date.parse(u.createdAt), now - 365 * DAY);
    const firstDay = Math.ceil((now - start) / DAY);
    const h = householdOf(u);
    const home = h ? { latitude: h.latitude, longitude: h.longitude } : neighborhoodPoint('Centro');
    for (let ago = firstDay; ago >= 0; ago--) {
      const growth = 0.45 + 0.55 * (1 - ago / 365); // programa cresce ao longo do ano
      let chance = a * 0.2 * growth;
      // a moradora de demonstração mantém uma sequência nos últimos dias
      const forced = u.id === morador.id && ago <= 8 && ago !== 0;
      if (u.id === morador.id) chance = 0.34;
      if (!forced && !rng.chance(chance)) continue;
      const code = forced && ago % 3 === 0 ? 'VIDRO' : rng.weighted(CATEGORY_WEIGHTS);
      const c = cat(code);
      const [lo, hi] = KG_RANGE[code];
      const kg = rng.float(lo, hi, 2);
      const t = now - ago * DAY - rng.int(0, 13) * HOUR - rng.int(0, 59) * 60_000 - (ago === 0 ? 2 * HOUR : 0);
      const disposedAt = Math.min(t, now - 30 * 60_000);
      const createdAt = disposedAt + rng.int(1, 40) * 60_000;
      const hasPhoto = rng.chance(0.7);
      const aiOk = hasPhoto && rng.chance(0.85);
      const usePoint = rng.chance(0.55);
      const points = d.collectionPoints.filter((p) => p.categories.includes(code));
      const cp = usePoint && points.length
        ? [...points].sort((x, y) => haversineKm(home, x) - haversineKm(home, y))[rng.int(0, Math.min(2, points.length - 1))]
        : null;
      const loc = cp ? jitter(rng, cp, 0.0008) : jitter(rng, home, 0.0015);
      const otherCode = rng.pick(CATEGORIES.filter((k) => k.code !== code)).code;
      const rec: DisposalRec = {
        id: rng.uuid(), userId: u.id, categoryId: c.id, quantityKg: kg, status: 'PENDING', pointsAwarded: 0,
        photoId: hasPhoto ? seedPhotos.get(code)!.id : null, latitude: loc.latitude, longitude: loc.longitude,
        collectionPointId: cp?.id ?? null, disposedAt: iso(disposedAt), createdAt: iso(createdAt), reviewedAt: null,
        rejectionReason: null, notes: rng.pick(DISPOSAL_NOTES), aiSuggestedCode: hasPhoto ? (aiOk ? code : otherCode) : null,
        aiConfidence: hasPhoto ? rng.float(aiOk ? 0.62 : 0.4, aiOk ? 0.97 : 0.68, 2) : null, aiSource: hasPhoto ? 'LOCAL' : 'MANUAL',
        fraudScore: rng.chance(0.15) ? rng.int(5, 25) : 0, fraudFlags: [], idempotencyKey: null,
      };
      if (rec.fraudScore > 0) rec.fraudFlags = ['Quantidade acima da média da categoria.'];
      const ageDays = (now - createdAt) / DAY;
      let status: 'APPROVED' | 'REJECTED' | 'PENDING';
      if (forced) status = 'APPROVED';
      else if (ageDays <= 2) status = rng.weighted([['PENDING', 55], ['APPROVED', 40], ['REJECTED', 5]] as const);
      else if (ageDays <= 7) status = rng.weighted([['PENDING', 18], ['APPROVED', 75], ['REJECTED', 7]] as const);
      else status = rng.weighted([['APPROVED', 93], ['REJECTED', 7]] as const);
      const reviewAt = createdAt + (forced ? HOUR : rng.int(2, 30) * HOUR);
      if (status !== 'PENDING' && reviewAt > now) status = 'PENDING';
      if (status === 'REJECTED') {
        rec.status = 'REJECTED';
        rec.reviewedAt = iso(reviewAt);
        rec.rejectionReason = rng.pick(REJECTION_REASONS);
      } else if (status === 'APPROVED') {
        rec.reviewedAt = iso(Math.min(reviewAt, now - 5 * 60_000)); // aprovado na reprodução abaixo
      }
      finalStatus.set(rec.id, status);
      d.disposals.push(rec);
    }
  }

  // descartes suspeitos (pendentes e sinalizados) para a fila do admin
  const suspicious: [number, string[], number][] = [
    [72, ['Descarte acima de 5 kg sem foto de comprovação.', 'Total de 46,0 kg no mesmo dia (limite de referência: 40 kg).'], 18.5],
    [58, ['Foto muito parecida com uma enviada por outro usuário.', 'A IA sugeriu REJEITO com 81% de confiança, mas foi informado PLASTICO.'], 4.2],
    [45, ['6 descartes registrados em menos de 1 hora.'], 2.1],
    [64, ['Localização muito distante do descarte anterior em poucos minutos.', 'Descarte acima de 5 kg sem foto de comprovação.'], 12],
    [41, ['Quantidade muito acima do seu histórico (mediana 1,2 kg).'], 9.8],
    [85, ['A mesma foto já foi enviada anteriormente.', 'Foto muito parecida com outra que você já enviou.', '7 descartes registrados em menos de 1 hora.'], 6.5],
  ];
  const flaggable = residents.filter((u) => u.id !== morador.id);
  suspicious.forEach(([score, flags, kg], i) => {
    const u = flaggable[(i * 5 + 3) % flaggable.length];
    const code: CategoryCode = i === 1 ? 'PLASTICO' : i === 3 ? 'METAL' : rng.pick(['PAPEL', 'PLASTICO', 'VIDRO'] as const);
    const c = cat(code);
    const t = now - rng.int(2, 40) * HOUR;
    const noPhoto = flags.some((f) => f.includes('sem foto'));
    const h = householdOf(u);
    d.disposals.push({
      id: rng.uuid(), userId: u.id, categoryId: c.id, quantityKg: Math.min(kg, c.maxKgPerDisposal), status: 'PENDING', pointsAwarded: 0,
      photoId: noPhoto ? null : seedPhotos.get(code)!.id, latitude: h?.latitude ?? null, longitude: h?.longitude ?? null,
      collectionPointId: null, disposedAt: iso(t), createdAt: iso(t + 5 * 60_000), reviewedAt: null, rejectionReason: null,
      notes: null, aiSuggestedCode: noPhoto ? null : i === 1 ? 'REJEITO' : code, aiConfidence: noPhoto ? null : 0.81,
      aiSource: noPhoto ? 'MANUAL' : 'LOCAL', fraudScore: score, fraudFlags: flags, idempotencyKey: null,
    });
  });
  // dois recusados por fraude
  for (let i = 0; i < 2; i++) {
    const u = flaggable[(i * 7 + 1) % flaggable.length];
    const c = cat('METAL');
    const t = now - (10 + i * 9) * DAY;
    d.disposals.push({
      id: rng.uuid(), userId: u.id, categoryId: c.id, quantityKg: 15, status: 'REJECTED', pointsAwarded: 0, photoId: seedPhotos.get('METAL')!.id,
      latitude: null, longitude: null, collectionPointId: null, disposedAt: iso(t), createdAt: iso(t + 60_000), reviewedAt: iso(t + 6 * HOUR),
      rejectionReason: 'Descarte duplicado (mesma foto de outro registro).', notes: null, aiSuggestedCode: 'METAL', aiConfidence: 0.9,
      aiSource: 'LOCAL', fraudScore: 70, fraudFlags: ['A mesma foto já foi enviada anteriormente.', 'Quantidade muito acima do seu histórico (mediana 0,8 kg).'], idempotencyKey: null,
    });
  }

  // ---------------------------------------------------------------- reprodução cronológica (pontos, desafios, medalhas, resgates)
  type Ev = { at: number; kind: 'approve'; disposal: DisposalRec } | { at: number; kind: 'redeem'; userId: string; rewardName: string };
  const events: Ev[] = d.disposals
    .filter((x) => finalStatus.get(x.id) === 'APPROVED')
    .map((x) => ({ at: Date.parse(x.reviewedAt!), kind: 'approve' as const, disposal: x }));
  events.push({ at: now - 62 * DAY, kind: 'redeem', userId: morador.id, rewardName: 'Café na cantina' });
  events.push({ at: now - 21 * DAY, kind: 'redeem', userId: morador.id, rewardName: 'Muda de árvore nativa' });
  for (const u of residents) {
    if (u.id === morador.id) continue;
    const n = rng.int(0, 3);
    for (let i = 0; i < n; i++) events.push({ at: now - rng.int(3, 300) * DAY, kind: 'redeem', userId: u.id, rewardName: rng.pick(REWARDS.slice(0, 7)).name });
  }
  events.sort((a, b) => a.at - b.at);
  for (const ev of events) {
    const at = iso(ev.at);
    if (ev.kind === 'approve') {
      ev.disposal.status = 'PENDING';
      approveDisposal(d, ev.disposal, at);
      if (now - ev.at < 20 * DAY) audit(d, admin, 'DISPOSAL_APPROVED', 'Disposal', ev.disposal.id, `+${ev.disposal.pointsAwarded} pontos`, at);
    } else {
      const reward = d.rewards.find((r) => r.name === ev.rewardName)!;
      const user = d.users.find((u) => u.id === ev.userId)!;
      if (user.points < reward.costPoints || Date.parse(user.createdAt) > ev.at) continue;
      debit(d, user.id, reward.costPoints, `Resgate: ${reward.name}`, at);
      reward.stock = Math.max(0, reward.stock - 1);
      d.redemptions.push({
        id: rng.uuid(), userId: user.id, rewardId: reward.id, cost: reward.costPoints, code: `LZ-${randomCode(4, rng.next)}-${randomCode(4, rng.next)}`,
        status: now - ev.at > 30 * DAY ? rng.weighted([['USED', 8], ['ISSUED', 2]] as const) : 'ISSUED', createdAt: at,
      });
      audit(d, user, 'REWARD_REDEEMED', 'Reward', reward.id, `${reward.name} (-${reward.costPoints} pontos)`, at);
    }
  }
  for (const x of d.disposals) if (x.status === 'REJECTED' && now - Date.parse(x.reviewedAt!) < 20 * DAY) {
    audit(d, admin, 'DISPOSAL_REJECTED', 'Disposal', x.id, x.rejectionReason, x.reviewedAt!);
  }

  // ---------------------------------------------------------------- lixeiras inteligentes
  const bin = (h: HouseholdRec, name: string, code: CategoryCode, cap: number, thr: number, fillNow: number, rate: number, battery: number, lastAgoMin: number): SmartBinRec => {
    const lastAt = now - lastAgoMin * 60_000;
    const readings = [];
    for (let i = 47; i >= 0; i--) {
      const t = lastAt - i * 30 * 60_000;
      const hoursAgo = (lastAt - t) / HOUR;
      let f = fillNow - Math.max(rate, 0.8) * hoursAgo;
      if (f < 0) f += 82; // antes da última coleta a lixeira estava cheia (dente de serra)
      readings.push({ fillLevel: Math.round(Math.max(0, Math.min(100, f))), batteryLevel: Math.round(battery + i * 0.04), at: iso(t) });
    }
    const b: SmartBinRec = {
      id: rng.uuid(), householdId: h.id, categoryId: cat(code).id, name, capacityLiters: cap, autoRequestThreshold: thr,
      deviceId: rng.uuid(), deviceKey: randomCode(32, rng.next), fillLevel: fillNow, batteryLevel: battery, lastReadingAt: iso(lastAt),
      fillRatePerHour: rate, readings, createdAt: iso(now - rng.int(60, 200) * DAY),
    };
    d.bins.push(b);
    return b;
  };
  const hh = (key: string) => d.households.find((h) => h.name === HOUSEHOLDS.find((x) => x.key === key)!.name)!;
  const mHome = hh('MARIANA');
  bin(mHome, 'Recicláveis da cozinha', 'PLASTICO', 50, 80, 38, 1.4, 86, 12);
  bin(mHome, 'Papel do escritório', 'PAPEL', 30, 85, 64, 0.9, 71, 7);
  const compost = bin(mHome, 'Composteira', 'ORGANICO', 20, 75, 72, 2.2, 93, 21);
  bin(hh('SOUZA'), 'Lixeira reciclável', 'PLASTICO', 60, 80, 86, 1.1, 64, 4);
  bin(hh('REPUBLICA'), 'Vidros da república', 'VIDRO', 40, 70, 55, 0.7, 77, 16);
  bin(hh('REPUBLICA'), 'Orgânicos', 'ORGANICO', 30, 80, 92, 1.8, 58, 9);
  bin(hh('NAKAMURA'), 'Papel e papelão', 'PAPEL', 80, 85, 40, 0.6, 12, 25);
  bin(hh('OLIVEIRA'), 'Lixeira da garagem', 'METAL', 40, 80, 47, 0, 34, 9 * 60); // sem sinal há 9 h → OFFLINE
  // coleta anterior da composteira (já realizada)
  const compostEmptiedAt = now - Math.round(((72 / 2.2) + 0.5) * HOUR);
  d.collectionRequests.push({
    id: rng.uuid(), address: mHome.address!, latitude: mHome.latitude, longitude: mHome.longitude, categoryCodes: ['ORGANICO'], estimatedKg: 6.8,
    status: 'COLLECTED', source: 'SMART_BIN', preferredDate: null, scheduledFor: localDate(new Date(compostEmptiedAt)), routeId: null,
    notes: 'Solicitação automática: a lixeira "Composteira" atingiu 78%.', createdAt: iso(compostEmptiedAt - 20 * HOUR),
    updatedAt: iso(compostEmptiedAt), requesterId: mHome.ownerId, smartBinId: compost.id,
  });
  // lixeiras acima do limite abrem solicitação automática
  for (const b of d.bins) if (b.fillLevel >= b.autoRequestThreshold) openAutomaticRequest(d, b, iso(now - rng.int(30, 300) * 60_000));
  for (const u of residents) if (u.householdId) evaluateBadges(d, u.id, iso(now - HOUR));

  // ---------------------------------------------------------------- solicitações de coleta e rotas
  const mkRequest = (u: UserRec, codes: CategoryCode[], kg: number, status: CollectionRequestRec['status'], createdAgoH: number, extra: Partial<CollectionRequestRec> = {}): CollectionRequestRec => {
    const h = householdOf(u);
    const nb = h?.neighborhood ?? 'Centro';
    const street = rng.pick(STREETS[nb] ?? STREETS['Centro']);
    const p = jitter(rng, h ? { latitude: h.latitude, longitude: h.longitude } : neighborhoodPoint(nb), 0.01);
    const r: CollectionRequestRec = {
      id: rng.uuid(), address: `${street}, ${rng.int(20, 1800)} – ${nb}, ${h?.city ?? 'Taboão da Serra'}`, latitude: p.latitude, longitude: p.longitude,
      categoryCodes: codes, estimatedKg: kg, status, source: 'USER', preferredDate: null, scheduledFor: null, routeId: null,
      notes: rng.pick([null, 'Deixar na portaria.', 'Material separado em sacos.', 'Tocar o interfone 12.', 'Móveis de escritório antigos e caixas.']),
      createdAt: iso(now - createdAgoH * HOUR), updatedAt: iso(now - Math.max(0, createdAgoH - 3) * HOUR), requesterId: u.id, smartBinId: null, ...extra,
    };
    d.collectionRequests.push(r);
    return r;
  };
  const pickResident = (i: number) => flaggable[(i * 3 + 2) % flaggable.length];
  const mixes: CategoryCode[][] = [['PAPEL', 'PLASTICO'], ['VIDRO'], ['ELETRONICO'], ['PLASTICO', 'METAL'], ['PAPEL'], ['ORGANICO'], ['PLASTICO', 'PAPEL', 'VIDRO']];
  // abertas, para o admin otimizar
  for (let i = 0; i < 7; i++) {
    mkRequest(pickResident(i), mixes[i % mixes.length], rng.float(4, 60, 1), 'REQUESTED', rng.int(3, 90), {
      preferredDate: rng.chance(0.5) ? addDays(today, rng.int(0, 5)) : null,
    });
  }
  // da moradora de demonstração
  mkRequest(morador, ['ELETRONICO'], 3.5, 'REQUESTED', 26, { notes: 'Monitor antigo e cabos.', preferredDate: addDays(today, 2), address: 'Rua Cesário Dau, 610 – Jardim Maria Rosa, Taboão da Serra', latitude: mHome.latitude, longitude: mHome.longitude });
  mkRequest(morador, ['PAPEL', 'PLASTICO'], 12, 'COLLECTED', 40 * 24, { address: 'Rua Cesário Dau, 610 – Jardim Maria Rosa, Taboão da Serra', latitude: mHome.latitude, longitude: mHome.longitude });
  mkRequest(pickResident(9), ['VIDRO'], 8, 'CANCELLED', 15 * 24, { notes: 'Consegui levar ao ecoponto.' });

  const mkRoute = (name: string, collectorUser: UserRec, plannedDate: string, reqs: CollectionRequestRec[], status: RouteRec['status'], doneCount: number) => {
    const plan = optimize(DEFAULT_DEPOT, reqs.map((r) => ({ id: r.id, latitude: r.latitude, longitude: r.longitude, kg: r.estimatedKg, address: r.address })), 1000);
    const trip = plan.trips[0];
    const routeId = rng.uuid();
    const plannedAt = Date.parse(`${plannedDate}T11:00:00Z`);
    const rec: RouteRec = {
      id: routeId, name, status, collectorId: collectorUser.id, plannedDate, totalDistanceKm: trip.distanceKm, naiveDistanceKm: trip.naiveDistanceKm,
      estimatedMinutes: trip.estimatedMinutes, loadKg: trip.loadKg, depot: { ...DEFAULT_DEPOT },
      stops: trip.stops.map((s, i) => {
        const done = i < doneCount;
        const doneAt = Math.min(now - (doneCount - i) * 25 * 60_000, plannedAt + (i + 1) * 30 * 60_000);
        return {
          id: rng.uuid(), sequence: i + 1, requestId: s.id, address: s.address, latitude: s.latitude, longitude: s.longitude, estimatedKg: s.kg,
          status: done ? 'DONE' as const : 'PENDING' as const, completedAt: done ? iso(doneAt) : null, collectedKg: done ? round(s.kg * rng.float(0.8, 1.15)) : null,
        };
      }),
      createdAt: iso(Math.min(now - 3 * HOUR, plannedAt - DAY)),
    };
    rec.stops.forEach((s) => {
      const r = reqs.find((x) => x.id === s.requestId)!;
      r.routeId = routeId;
      r.scheduledFor = plannedDate;
      r.status = s.status === 'DONE' ? 'COLLECTED' : status === 'IN_PROGRESS' ? 'IN_ROUTE' : 'SCHEDULED';
    });
    d.routes.push(rec);
    audit(d, admin, 'ROUTE_CREATED', 'Route', rec.id, `${rec.name} — ${rec.stops.length} paradas, ${rec.totalDistanceKm} km`, rec.createdAt);
    return rec;
  };
  const batch = (n: number, offset: number, ageH: number) => Array.from({ length: n }, (_, i) =>
    mkRequest(pickResident(offset + i), mixes[(offset + i) % mixes.length], rng.float(5, 80, 1), 'SCHEDULED', ageH + i * 3));
  mkRoute('Rota Jardim Maria Rosa – manhã', collector, today, batch(5, 11, 30), 'IN_PROGRESS', 2);
  mkRoute('Rota Vila Sônia / Parque Pinheiros', collector, addDays(today, 1), batch(4, 17, 20), 'PLANNED', 0);
  mkRoute('Rota Centro – recicláveis', collector, addDays(today, -8), batch(4, 22, 8 * 24 + 30), 'DONE', 4);
  mkRoute('Rota Jardim Record – volumosos', collector, addDays(today, -15), batch(5, 27, 15 * 24 + 30), 'DONE', 5);
  mkRoute('Rota Jardim Mituzi', collector2, addDays(today, -4), batch(3, 33, 4 * 24 + 20), 'DONE', 3);

  // ---------------------------------------------------------------- auditoria de acesso
  for (const u of [admin, collector, morador, ...residents.slice(0, 12)]) {
    audit(d, u, 'LOGIN_SUCCESS', 'User', u.id, null, u.lastLoginAt!, `177.${rng.int(10, 220)}.${rng.int(0, 255)}.${rng.int(1, 254)}`);
  }
  for (const u of residents.filter((x) => now - Date.parse(x.createdAt) < 40 * DAY)) {
    audit(d, u, 'USER_REGISTERED', 'User', u.id, null, u.createdAt);
  }
  audit(d, 'tentativa@exemplo.com', 'LOGIN_FAILED', 'User', null, 'e-mail não cadastrado', iso(now - 5 * HOUR), '189.40.12.7');
  audit(d, admin, 'REPORT_EXPORTED', 'Report', 'disposals.csv', `${addDays(today, -30)} a ${today}`, iso(now - 2 * DAY));
  audit(d, admin, 'REWARD_UPDATED', 'Reward', d.rewards[7].id, d.rewards[7].name, iso(now - 3 * DAY));

  return d;
}
