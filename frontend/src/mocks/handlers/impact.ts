/** Impacto ambiental (/api/public/stats, /api/impact/*) e rotas do coletor (/api/collector/*). */
import type { ImpactSummary, PublicStats, Route, SimulationInput, SimulationResult } from '@/api/types';
import { db, nowIso, type RouteRec, type UserRec } from '../db';
import { toRoute } from '../dto';
import { Validator, bodyObject, enumParam, fail, intParam, ok } from '../http';
import { audit } from '../logic/audit';
import { emptyBin } from '../logic/bins';
import { localDate } from '../logic/dates';
import { impactSummary, publicStats } from '../logic/impact';
import { simulate } from '../logic/simulator';
import { COLLECTOR, route } from '../server';

export function registerImpactRoutes() {
  route('GET', '/public/stats', () => ok<PublicStats>(publicStats(db())), { access: 'public' });

  route('GET', '/impact/summary', ({ me, query }) => {
    const scope = enumParam(query, 'scope', ['ME', 'COMMUNITY'] as const) ?? 'ME';
    const months = intParam(query, 'months', 12, 1, 36);
    return ok<ImpactSummary>(impactSummary(db(), scope, me.id, months));
  });

  route('POST', '/impact/simulate', ({ body }) => {
    const b = bodyObject(body);
    const v = new Validator();
    const n = (k: keyof SimulationInput, min: number, max: number, msg: string) => {
      const x = b[k];
      v.check(typeof x === 'number' && Number.isFinite(x) && x >= min && x <= max, k, msg);
      return x as number;
    };
    const input: SimulationInput = {
      population: n('population', 1, 50_000_000, 'informe de 1 a 50.000.000 habitantes'),
      kgPerCapitaDay: n('kgPerCapitaDay', 0.1, 5, 'informe de 0,1 a 5 kg por habitante/dia'),
      currentRecyclingRate: n('currentRecyclingRate', 0, 1, 'informe uma taxa entre 0 e 1'),
      targetRecyclingRate: n('targetRecyclingRate', 0, 1, 'informe uma taxa entre 0 e 1'),
      targetYear: n('targetYear', 2027, 2050, 'informe um ano entre 2027 e 2050'),
      annualGrowthRate: n('annualGrowthRate', -0.05, 0.1, 'informe entre -0,05 e 0,10'),
    };
    if (!v.has('targetRecyclingRate') && !v.has('currentRecyclingRate') && input.targetRecyclingRate < input.currentRecyclingRate) {
      v.add('targetRecyclingRate', 'a meta deve ser maior ou igual à taxa atual');
    }
    if (!v.has('targetYear') && !Number.isInteger(input.targetYear)) v.add('targetYear', 'informe um ano inteiro');
    v.throwIfAny();
    const baseYear = Number(localDate(new Date()).slice(0, 4));
    return ok<SimulationResult>(simulate(input, baseYear));
  });
}

function myRoute(me: UserRec, id: string): RouteRec {
  const r = db().routes.find((x) => x.id === id);
  if (!r || (me.role !== 'ADMIN' && r.collectorId !== me.id)) throw fail.notFound('Rota não encontrada.');
  return r;
}

const STATUS_ORDER: Record<RouteRec['status'], number> = { IN_PROGRESS: 0, PLANNED: 1, DONE: 2 };

export function registerCollectorRoutes() {
  route('GET', '/collector/routes', ({ me }) => {
    const d = db();
    return ok<Route[]>(d.routes
      .filter((r) => r.collectorId === me.id || (me.role === 'ADMIN' && r.collectorId === null))
      .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
        || (a.status === 'DONE' ? b.plannedDate.localeCompare(a.plannedDate) : a.plannedDate.localeCompare(b.plannedDate)))
      .map((r) => toRoute(d, r)));
  }, { access: COLLECTOR });

  route('POST', '/collector/routes/:id/start', ({ me, params }) => {
    const d = db();
    const r = myRoute(me, params.id);
    if (r.status === 'DONE') throw fail.business('Esta rota já foi concluída.');
    if (r.status === 'PLANNED') {
      r.status = 'IN_PROGRESS';
      if (!r.collectorId) r.collectorId = me.id;
      const at = nowIso();
      for (const s of r.stops) {
        const req = d.collectionRequests.find((x) => x.id === s.requestId);
        if (req && req.status !== 'CANCELLED' && req.status !== 'COLLECTED') { req.status = 'IN_ROUTE'; req.updatedAt = at; }
      }
      audit(d, me, 'ROUTE_STARTED', 'Route', r.id, r.name);
    }
    return ok<Route>(toRoute(d, r));
  }, { access: COLLECTOR });

  route('POST', '/collector/routes/:routeId/stops/:stopId/complete', ({ me, params, body }) => {
    const d = db();
    const r = myRoute(me, params.routeId);
    const stop = r.stops.find((s) => s.id === params.stopId);
    if (!stop) throw fail.notFound('Parada não encontrada.');
    if (r.status === 'PLANNED') throw fail.business('Inicie a rota antes de concluir paradas.');
    if (r.status === 'DONE' || stop.status === 'DONE') return ok<Route>(toRoute(d, r));
    const b = bodyObject(body);
    const kg = b.collectedKg;
    if (kg !== undefined && kg !== null && (typeof kg !== 'number' || kg < 0 || kg > 5000)) throw fail.field('collectedKg', 'informe de 0 a 5.000 kg');
    const at = nowIso();
    stop.status = 'DONE';
    stop.completedAt = at;
    stop.collectedKg = typeof kg === 'number' ? kg : stop.estimatedKg;
    const req = d.collectionRequests.find((x) => x.id === stop.requestId);
    if (req && req.status !== 'CANCELLED') {
      req.status = 'COLLECTED';
      req.updatedAt = at;
      if (req.smartBinId) emptyBin(d, req.smartBinId, at);
    }
    audit(d, me, 'STOP_COMPLETED', 'Route', r.id, `${stop.address} — ${stop.collectedKg} kg`);
    if (r.stops.every((s) => s.status === 'DONE')) {
      r.status = 'DONE';
      audit(d, me, 'ROUTE_COMPLETED', 'Route', r.id, r.name);
    }
    return ok<Route>(toRoute(d, r));
  }, { access: COLLECTOR });
}
