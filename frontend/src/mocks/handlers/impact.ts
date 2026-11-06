/** Impacto ambiental (/api/public/stats, /api/impact/*) e rotas do coletor (/api/collector/*). */
import type { ImpactSummary, PublicStats, Route, SimulationInput, SimulationResult } from '@/api/types';
import { banco, agoraIso, type RegistroRota, type RegistroUsuario } from '../db';
import { paraRota } from '../dto';
import { Validador, objetoDoCorpo, parametroEnum, falha, parametroInteiro, ok } from '../http';
import { registrarAuditoria } from '../logic/audit';
import { esvaziarLixeira } from '../logic/bins';
import { dataLocal } from '../logic/dates';
import { resumoImpacto, estatisticasPublicas } from '../logic/impact';
import { simular } from '../logic/simulator';
import { COLETOR, rota } from '../server';

export function registrarRotasImpacto() {
  rota('GET', '/public/stats', () => ok<PublicStats>(estatisticasPublicas(banco())), { access: 'public' });

  rota('GET', '/impact/summary', ({ me, query }) => {
    const escopo = parametroEnum(query, 'scope', ['ME', 'COMMUNITY'] as const) ?? 'ME';
    const meses = parametroInteiro(query, 'months', 12, 1, 36);
    return ok<ImpactSummary>(resumoImpacto(banco(), escopo, me.id, meses));
  });

  rota('POST', '/impact/simulate', ({ body }) => {
    const b = objetoDoCorpo(body);
    const v = new Validador();
    const n = (k: keyof SimulationInput, min: number, max: number, msg: string) => {
      const x = b[k];
      v.check(typeof x === 'number' && Number.isFinite(x) && x >= min && x <= max, k, msg);
      return x as number;
    };
    const entrada: SimulationInput = {
      population: n('population', 1, 50_000_000, 'informe de 1 a 50.000.000 habitantes'),
      kgPerCapitaDay: n('kgPerCapitaDay', 0.1, 5, 'informe de 0,1 a 5 kg por habitante/dia'),
      currentRecyclingRate: n('currentRecyclingRate', 0, 1, 'informe uma taxa entre 0 e 1'),
      targetRecyclingRate: n('targetRecyclingRate', 0, 1, 'informe uma taxa entre 0 e 1'),
      targetYear: n('targetYear', 2027, 2050, 'informe um ano entre 2027 e 2050'),
      annualGrowthRate: n('annualGrowthRate', -0.05, 0.1, 'informe entre -0,05 e 0,10'),
    };
    if (!v.has('targetRecyclingRate') && !v.has('currentRecyclingRate') && entrada.targetRecyclingRate < entrada.currentRecyclingRate) {
      v.add('targetRecyclingRate', 'a meta deve ser maior ou igual à taxa atual');
    }
    if (!v.has('targetYear') && !Number.isInteger(entrada.targetYear)) v.add('targetYear', 'informe um ano inteiro');
    v.throwIfAny();
    const anoBase = Number(dataLocal(new Date()).slice(0, 4));
    return ok<SimulationResult>(simular(entrada, anoBase));
  });
}

function minhaRota(me: RegistroUsuario, id: string): RegistroRota {
  const r = banco().routes.find((x) => x.id === id);
  if (!r || (me.role !== 'ADMIN' && r.collectorId !== me.id)) throw falha.notFound('Rota não encontrada.');
  return r;
}

const ORDEM_STATUS: Record<RegistroRota['status'], number> = { IN_PROGRESS: 0, PLANNED: 1, DONE: 2 };

export function registrarRotasColetor() {
  rota('GET', '/collector/routes', ({ me }) => {
    const d = banco();
    return ok<Route[]>(d.routes
      .filter((r) => r.collectorId === me.id || (me.role === 'ADMIN' && r.collectorId === null))
      .sort((a, b) => ORDEM_STATUS[a.status] - ORDEM_STATUS[b.status]
        || (a.status === 'DONE' ? b.plannedDate.localeCompare(a.plannedDate) : a.plannedDate.localeCompare(b.plannedDate)))
      .map((r) => paraRota(d, r)));
  }, { access: COLETOR });

  rota('POST', '/collector/routes/:id/start', ({ me, params }) => {
    const d = banco();
    const r = minhaRota(me, params.id);
    if (r.status === 'DONE') throw falha.business('Esta rota já foi concluída.');
    if (r.status === 'PLANNED') {
      r.status = 'IN_PROGRESS';
      if (!r.collectorId) r.collectorId = me.id;
      const quando = agoraIso();
      for (const s of r.stops) {
        const solicitacao = d.collectionRequests.find((x) => x.id === s.requestId);
        if (solicitacao && solicitacao.status !== 'CANCELLED' && solicitacao.status !== 'COLLECTED') { solicitacao.status = 'IN_ROUTE'; solicitacao.updatedAt = quando; }
      }
      registrarAuditoria(d, me, 'ROUTE_STARTED', 'Route', r.id, r.name);
    }
    return ok<Route>(paraRota(d, r));
  }, { access: COLETOR });

  rota('POST', '/collector/routes/:routeId/stops/:stopId/complete', ({ me, params, body }) => {
    const d = banco();
    const r = minhaRota(me, params.routeId);
    const parada = r.stops.find((s) => s.id === params.stopId);
    if (!parada) throw falha.notFound('Parada não encontrada.');
    if (r.status === 'PLANNED') throw falha.business('Inicie a rota antes de concluir paradas.');
    if (r.status === 'DONE' || parada.status === 'DONE') return ok<Route>(paraRota(d, r));
    const b = objetoDoCorpo(body);
    const kg = b.collectedKg;
    if (kg !== undefined && kg !== null && (typeof kg !== 'number' || kg < 0 || kg > 5000)) throw falha.campo('collectedKg', 'informe de 0 a 5.000 kg');
    const quando = agoraIso();
    parada.status = 'DONE';
    parada.completedAt = quando;
    parada.collectedKg = typeof kg === 'number' ? kg : parada.estimatedKg;
    const solicitacao = d.collectionRequests.find((x) => x.id === parada.requestId);
    if (solicitacao && solicitacao.status !== 'CANCELLED') {
      solicitacao.status = 'COLLECTED';
      solicitacao.updatedAt = quando;
      if (solicitacao.smartBinId) esvaziarLixeira(d, solicitacao.smartBinId, quando);
    }
    registrarAuditoria(d, me, 'STOP_COMPLETED', 'Route', r.id, `${parada.address} — ${parada.collectedKg} kg`);
    if (r.stops.every((s) => s.status === 'DONE')) {
      r.status = 'DONE';
      registrarAuditoria(d, me, 'ROUTE_COMPLETED', 'Route', r.id, r.name);
    }
    return ok<Route>(paraRota(d, r));
  }, { access: COLETOR });
}
