/** Ecopontos (/api/collection-points) e solicitações de coleta (/api/collection-requests). */
import type { CategoryCode, CollectionPoint, CollectionRequest } from '@/api/types';
import { db, nowIso, type CollectionRequestRec } from '../db';
import { toCollectionPoint, toCollectionRequest } from '../dto';
import { DATE_RE, Validator, bodyObject, created, fail, ok, str } from '../http';
import { audit } from '../logic/audit';
import { addDays, localDate } from '../logic/dates';
import { haversineKm } from '../logic/geo';
import { OPEN_REQUEST } from '../logic/bins';
import { round } from '../logic/random';
import { route } from '../server';
import { CATEGORY_CODES } from './disposals';

const MAX_OPEN_REQUESTS = 5;

function floatParam(q: URLSearchParams, name: string, min: number, max: number): number | null {
  const raw = q.get(name);
  if (raw === null || raw === '') return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < min || n > max) throw fail.field(name, `deve estar entre ${min} e ${max}`);
  return n;
}

export function validateCategoryCodes(v: Validator, field: string, value: unknown): CategoryCode[] {
  if (!Array.isArray(value) || value.length === 0) { v.add(field, 'selecione ao menos um material'); return []; }
  if (value.some((c) => !CATEGORY_CODES.includes(c as CategoryCode))) { v.add(field, 'categoria inválida'); return []; }
  return [...new Set(value as CategoryCode[])];
}

export function registerCollectionRoutes() {
  route('GET', '/collection-points', ({ query }) => {
    const lat = floatParam(query, 'lat', -90, 90);
    const lon = floatParam(query, 'lon', -180, 180);
    if ((lat === null) !== (lon === null)) throw fail.field('lat', 'informe lat e lon juntos');
    const radius = floatParam(query, 'radiusKm', 0.1, 500);
    const category = query.get('category');
    if (category && !CATEGORY_CODES.includes(category as CategoryCode)) throw fail.field('category', 'categoria inválida');
    const from = lat !== null && lon !== null ? { latitude: lat, longitude: lon } : null;
    let list = db().collectionPoints
      .filter((p) => p.active && (!category || p.categories.includes(category as CategoryCode)))
      .map((p) => toCollectionPoint(p, from));
    if (from) {
      if (radius !== null) list = list.filter((p) => (p.distanceKm ?? 0) <= radius);
      list.sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
    } else {
      list.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    }
    return ok<CollectionPoint[]>(list);
  }, { access: 'public' });

  route('POST', '/collection-requests', ({ me, body }) => {
    const d = db();
    const b = bodyObject(body);
    const v = new Validator();
    const address = str(b.address) ?? '';
    v.check(address.length >= 5 && address.length <= 200, 'address', 'informe o endereço (5 a 200 caracteres)');
    const lat = b.latitude;
    const lon = b.longitude;
    v.check(typeof lat === 'number' && lat >= -90 && lat <= 90, 'latitude', 'latitude inválida');
    v.check(typeof lon === 'number' && lon >= -180 && lon <= 180, 'longitude', 'longitude inválida');
    const codes = validateCategoryCodes(v, 'categoryCodes', b.categoryCodes);
    const kg = b.estimatedKg;
    v.check(typeof kg === 'number' && kg >= 0.5 && kg <= 2000, 'estimatedKg', 'informe entre 0,5 e 2.000 kg');
    const today = localDate(new Date());
    let preferredDate: string | null = null;
    if (b.preferredDate !== undefined && b.preferredDate !== null && b.preferredDate !== '') {
      const pd = str(b.preferredDate) ?? '';
      if (!DATE_RE.test(pd)) v.add('preferredDate', 'data inválida (use AAAA-MM-DD)');
      else if (pd < today) v.add('preferredDate', 'a data preferida não pode estar no passado');
      else if (pd > addDays(today, 60)) v.add('preferredDate', 'escolha uma data nos próximos 60 dias');
      else preferredDate = pd;
    }
    const notes = b.notes === undefined || b.notes === null ? null : str(b.notes);
    if (notes && notes.length > 500) v.add('notes', 'máximo de 500 caracteres');
    v.throwIfAny();
    const open = d.collectionRequests.filter((r) => r.requesterId === me.id && r.source === 'USER' && OPEN_REQUEST.includes(r.status)).length;
    if (open >= MAX_OPEN_REQUESTS) throw fail.business(`Você já tem ${open} solicitações em aberto. Aguarde a coleta ou cancele alguma.`);

    const at = nowIso();
    const rec: CollectionRequestRec = {
      id: crypto.randomUUID(), address, latitude: lat as number, longitude: lon as number, categoryCodes: codes,
      estimatedKg: round(kg as number), status: 'REQUESTED', source: 'USER', preferredDate, scheduledFor: null, routeId: null,
      notes: notes || null, createdAt: at, updatedAt: at, requesterId: me.id, smartBinId: null,
    };
    d.collectionRequests.push(rec);
    audit(d, me, 'COLLECTION_REQUESTED', 'CollectionRequest', rec.id, `${rec.estimatedKg} kg — ${codes.join(', ')}`);
    return created<CollectionRequest>(toCollectionRequest(d, rec));
  });

  route('GET', '/collection-requests', ({ me }) => {
    const d = db();
    const myHousehold = me.householdId;
    const myBins = new Set(d.bins.filter((b) => myHousehold && b.householdId === myHousehold).map((b) => b.id));
    return ok<CollectionRequest[]>(d.collectionRequests
      .filter((r) => r.requesterId === me.id || (r.smartBinId !== null && myBins.has(r.smartBinId)))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((r) => toCollectionRequest(d, r)));
  });

  route('POST', '/collection-requests/:id/cancel', ({ me, params }) => {
    const d = db();
    const r = d.collectionRequests.find((x) => x.id === params.id);
    if (!r || (r.requesterId !== me.id && me.role !== 'ADMIN')) throw fail.notFound('Solicitação não encontrada.');
    if (r.status === 'CANCELLED') return ok<CollectionRequest>(toCollectionRequest(d, r));
    if (r.status === 'IN_ROUTE' || r.status === 'COLLECTED') {
      throw fail.business(r.status === 'COLLECTED' ? 'Esta coleta já foi realizada.' : 'O coletor já está a caminho; não é possível cancelar.');
    }
    if (r.routeId) {
      const routeRec = d.routes.find((x) => x.id === r.routeId);
      if (routeRec) {
        routeRec.stops = routeRec.stops.filter((s) => s.requestId !== r.id).map((s, i) => ({ ...s, sequence: i + 1 }));
        routeRec.loadKg = round(routeRec.stops.reduce((s, x) => s + x.estimatedKg, 0));
        // distância aproximada após remover a parada
        let km = 0;
        let prev = routeRec.depot;
        for (const s of routeRec.stops) { km += haversineKm(prev, s); prev = s; }
        routeRec.totalDistanceKm = round(km + haversineKm(prev, routeRec.depot));
      }
    }
    r.status = 'CANCELLED';
    r.routeId = null;
    r.scheduledFor = null;
    r.updatedAt = nowIso();
    audit(d, me, 'COLLECTION_CANCELLED', 'CollectionRequest', r.id, null);
    return ok<CollectionRequest>(toCollectionRequest(d, r));
  });
}
