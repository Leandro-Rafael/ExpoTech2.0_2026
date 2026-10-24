/** Residência (Smart Home), lixeiras inteligentes e leituras IoT. */
import type { Household, SmartBin, SmartBinCreated } from '@/api/types';
import { db, nowIso, type HouseholdRec, type MockDb, type SmartBinRec, type UserRec } from '../db';
import { toHousehold, toSmartBin } from '../dto';
import { HttpError, Validator, bodyObject, created, fail, noContent, ok, str } from '../http';
import { audit } from '../logic/audit';
import { recordReading } from '../logic/bins';
import { neighborhoodPoint } from '../logic/geo';
import { evaluateBadges } from '../logic/points';
import { randomCode, round } from '../logic/random';
import { route } from '../server';

const MAX_MEMBERS = 12;
const MAX_BINS = 12;

function myHousehold(d: MockDb, me: UserRec): HouseholdRec | null {
  return d.households.find((h) => h.id === me.householdId) ?? null;
}

function requireHousehold(d: MockDb, me: UserRec): HouseholdRec {
  const h = myHousehold(d, me);
  if (!h) throw fail.business('Crie ou entre em uma residência antes de cadastrar lixeiras.');
  return h;
}

function newInviteCode(d: MockDb): string {
  let code: string;
  do code = randomCode(8); while (d.households.some((h) => h.inviteCode === code));
  return code;
}

export function registerHouseholdRoutes() {
  route('GET', '/household', ({ me }) => {
    const d = db();
    const h = myHousehold(d, me);
    return h ? ok<Household>(toHousehold(d, h)) : noContent();
  });

  route('POST', '/household', ({ me, body }) => {
    const d = db();
    if (myHousehold(d, me)) throw fail.business('Você já faz parte de uma residência. Saia dela antes de criar outra.');
    const b = bodyObject(body);
    const v = new Validator();
    const name = str(b.name) ?? '';
    const neighborhood = str(b.neighborhood) ?? '';
    const city = str(b.city) ?? '';
    v.check(name.length >= 2 && name.length <= 80, 'name', 'informe um nome (2 a 80 caracteres)');
    v.check(neighborhood.length >= 2 && neighborhood.length <= 80, 'neighborhood', 'informe o bairro (2 a 80 caracteres)');
    v.check(city.length >= 2 && city.length <= 80, 'city', 'informe a cidade (2 a 80 caracteres)');
    const address = b.address === undefined || b.address === null ? null : str(b.address);
    if (address && address.length > 200) v.add('address', 'máximo de 200 caracteres');
    const lat = typeof b.latitude === 'number' ? b.latitude : null;
    const lon = typeof b.longitude === 'number' ? b.longitude : null;
    v.throwIfAny();
    const base = neighborhoodPoint(neighborhood);
    const h: HouseholdRec = {
      id: crypto.randomUUID(), name, neighborhood, city, inviteCode: newInviteCode(d), ownerId: me.id, address: address || null,
      latitude: lat ?? round(base.latitude + (Math.random() - 0.5) * 0.006, 6),
      longitude: lon ?? round(base.longitude + (Math.random() - 0.5) * 0.006, 6),
      createdAt: nowIso(),
    };
    d.households.push(h);
    me.householdId = h.id;
    audit(d, me, 'HOUSEHOLD_CREATED', 'Household', h.id, name);
    return created<Household>(toHousehold(d, h));
  });

  route('POST', '/household/join', ({ me, body }) => {
    const d = db();
    const b = bodyObject(body);
    const code = (str(b.inviteCode) ?? '').toUpperCase();
    if (!/^[A-Z0-9]{6,12}$/.test(code)) throw fail.field('inviteCode', 'código de convite inválido');
    const h = d.households.find((x) => x.inviteCode === code);
    if (!h) throw fail.notFound('Nenhuma residência encontrada com este código.');
    if (me.householdId === h.id) return ok<Household>(toHousehold(d, h));
    if (myHousehold(d, me)) throw fail.business('Você já faz parte de uma residência. Saia dela antes de entrar em outra.');
    if (d.users.filter((u) => u.householdId === h.id).length >= MAX_MEMBERS) {
      throw fail.business(`Esta residência já atingiu o limite de ${MAX_MEMBERS} moradores.`);
    }
    me.householdId = h.id;
    audit(d, me, 'HOUSEHOLD_JOINED', 'Household', h.id, h.name);
    return ok<Household>(toHousehold(d, h));
  });

  route('POST', '/household/leave', ({ me }) => {
    const d = db();
    const h = myHousehold(d, me);
    if (!h) throw fail.business('Você não faz parte de nenhuma residência.');
    me.householdId = null;
    const remaining = d.users.filter((u) => u.householdId === h.id);
    if (!remaining.length) {
      // último morador: a residência e as lixeiras deixam de existir
      const binIds = new Set(d.bins.filter((b) => b.householdId === h.id).map((b) => b.id));
      d.bins = d.bins.filter((b) => !binIds.has(b.id));
      d.collectionRequests.forEach((r) => { if (r.smartBinId && binIds.has(r.smartBinId)) r.smartBinId = null; });
      d.households = d.households.filter((x) => x.id !== h.id);
    } else if (h.ownerId === me.id) {
      h.ownerId = [...remaining].sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0].id;
    }
    audit(d, me, 'HOUSEHOLD_LEFT', 'Household', h.id, h.name);
    return noContent();
  });

  route('GET', '/household/bins', ({ me }) => {
    const d = db();
    const h = myHousehold(d, me);
    if (!h) return ok<SmartBin[]>([]);
    return ok<SmartBin[]>(d.bins.filter((b) => b.householdId === h.id).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')).map((b) => toSmartBin(d, b)));
  });

  route('POST', '/household/bins', ({ me, body }) => {
    const d = db();
    const h = requireHousehold(d, me);
    if (d.bins.filter((b) => b.householdId === h.id).length >= MAX_BINS) throw fail.business(`Limite de ${MAX_BINS} lixeiras por residência atingido.`);
    const b = bodyObject(body);
    const v = new Validator();
    const name = str(b.name) ?? '';
    v.check(name.length >= 2 && name.length <= 60, 'name', 'informe um nome para a lixeira');
    const category = d.categories.find((c) => c.id === b.categoryId && c.active);
    v.check(!!category, 'categoryId', 'categoria não encontrada');
    const cap = b.capacityLiters;
    v.check(typeof cap === 'number' && Number.isInteger(cap) && cap >= 5 && cap <= 1000, 'capacityLiters', 'informe de 5 a 1000 litros');
    const thr = b.autoRequestThreshold;
    v.check(typeof thr === 'number' && Number.isInteger(thr) && thr >= 50 && thr <= 100, 'autoRequestThreshold', 'informe um limite entre 50 e 100%');
    v.throwIfAny();
    const now = nowIso();
    const deviceKey = randomCode(32);
    const bin: SmartBinRec = {
      id: crypto.randomUUID(), householdId: h.id, categoryId: category!.id, name, capacityLiters: cap as number,
      autoRequestThreshold: thr as number, deviceId: crypto.randomUUID(), deviceKey, fillLevel: 0, batteryLevel: 100,
      lastReadingAt: null,
      // na demo o sensor já começa a "transmitir": o nível sobe devagar sozinho
      fillRatePerHour: round(1.5 + Math.random() * 2, 2),
      readings: [], createdAt: now,
    };
    d.bins.push(bin);
    recordReading(d, bin, 0, 100, now);
    evaluateBadges(d, me.id, now);
    audit(d, me, 'SMART_BIN_CREATED', 'SmartBin', bin.id, name);
    return created<SmartBinCreated>({ bin: toSmartBin(d, bin), deviceId: bin.deviceId, deviceKey });
  });

  route('DELETE', '/household/bins/:id', ({ me, params }) => {
    const d = db();
    const h = myHousehold(d, me);
    const bin = d.bins.find((b) => b.id === params.id && h && b.householdId === h.id);
    if (!bin) throw fail.notFound('Lixeira não encontrada.');
    d.bins = d.bins.filter((b) => b.id !== bin.id);
    d.collectionRequests.forEach((r) => { if (r.smartBinId === bin.id) r.smartBinId = null; });
    audit(d, me, 'SMART_BIN_DELETED', 'SmartBin', bin.id, bin.name);
    return noContent();
  });

  route('POST', '/iot/readings', ({ headers, body }) => {
    const d = db();
    const deviceId = headers.get('X-Device-Id');
    const deviceKey = headers.get('X-Device-Key');
    const bin = d.bins.find((b) => b.deviceId === deviceId);
    if (!bin || !deviceKey || bin.deviceKey !== deviceKey) {
      throw new HttpError(401, 'UNAUTHORIZED', 'Dispositivo não autorizado', 'Credenciais do dispositivo inválidas.');
    }
    const b = bodyObject(body);
    const v = new Validator();
    const fill = b.fillLevel;
    const battery = b.batteryLevel;
    v.check(typeof fill === 'number' && fill >= 0 && fill <= 100, 'fillLevel', 'informe de 0 a 100');
    v.check(typeof battery === 'number' && battery >= 0 && battery <= 100, 'batteryLevel', 'informe de 0 a 100');
    v.throwIfAny();
    recordReading(d, bin, Math.round(fill as number), Math.round(battery as number), nowIso());
    return noContent(202);
  }, { access: 'public', csrf: false });
}
