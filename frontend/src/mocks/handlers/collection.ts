/** Ecopontos (/api/collection-points) e solicitações de coleta (/api/collection-requests). */
import type { CategoryCode, CollectionPoint, CollectionRequest } from '@/api/types';
import { banco, agoraIso, type RegistroSolicitacaoColeta } from '../db';
import { paraEcoponto, paraSolicitacaoColeta } from '../dto';
import { DATA_RE, Validador, objetoDoCorpo, criado, falha, ok, lerTexto } from '../http';
import { registrarAuditoria } from '../logic/audit';
import { somarDias, dataLocal } from '../logic/dates';
import { distanciaHaversineKm } from '../logic/geo';
import { SOLICITACAO_ABERTA } from '../logic/bins';
import { arredondar } from '../logic/random';
import { rota } from '../server';
import { CODIGOS_CATEGORIA } from './disposals';

const MAX_SOLICITACOES_ABERTAS = 5;

function parametroDecimal(q: URLSearchParams, nome: string, min: number, max: number): number | null {
  const bruto = q.get(nome);
  if (bruto === null || bruto === '') return null;
  const n = Number(bruto);
  if (!Number.isFinite(n) || n < min || n > max) throw falha.campo(nome, `deve estar entre ${min} e ${max}`);
  return n;
}

export function validarCodigosCategoria(v: Validador, campo: string, valor: unknown): CategoryCode[] {
  if (!Array.isArray(valor) || valor.length === 0) { v.add(campo, 'selecione ao menos um material'); return []; }
  if (valor.some((c) => !CODIGOS_CATEGORIA.includes(c as CategoryCode))) { v.add(campo, 'categoria inválida'); return []; }
  return [...new Set(valor as CategoryCode[])];
}

export function registrarRotasColeta() {
  rota('GET', '/collection-points', ({ query, me }) => {
    const incluirInativos = query.get('all') === 'true' && me?.role === 'ADMIN';
    const lat = parametroDecimal(query, 'lat', -90, 90);
    const lon = parametroDecimal(query, 'lon', -180, 180);
    if ((lat === null) !== (lon === null)) throw falha.campo('lat', 'informe lat e lon juntos');
    const raio = parametroDecimal(query, 'radiusKm', 0.1, 500);
    const categoria = query.get('category');
    if (categoria && !CODIGOS_CATEGORIA.includes(categoria as CategoryCode)) throw falha.campo('category', 'categoria inválida');
    const origem = lat !== null && lon !== null ? { latitude: lat, longitude: lon } : null;
    let lista = banco().collectionPoints
      .filter((p) => (incluirInativos || p.active) && (!categoria || p.categories.includes(categoria as CategoryCode)))
      .map((p) => paraEcoponto(p, origem));
    if (origem) {
      if (raio !== null) lista = lista.filter((p) => (p.distanceKm ?? 0) <= raio);
      lista.sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
    } else {
      lista.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    }
    return ok<CollectionPoint[]>(lista);
  }, { access: 'public' });

  rota('POST', '/collection-requests', ({ me, body }) => {
    const d = banco();
    const b = objetoDoCorpo(body);
    const v = new Validador();
    const endereco = lerTexto(b.address) ?? '';
    v.check(endereco.length >= 5 && endereco.length <= 200, 'address', 'informe o endereço (5 a 200 caracteres)');
    const lat = b.latitude;
    const lon = b.longitude;
    v.check(typeof lat === 'number' && lat >= -90 && lat <= 90, 'latitude', 'latitude inválida');
    v.check(typeof lon === 'number' && lon >= -180 && lon <= 180, 'longitude', 'longitude inválida');
    const codigos = validarCodigosCategoria(v, 'categoryCodes', b.categoryCodes);
    const kg = b.estimatedKg;
    v.check(typeof kg === 'number' && kg >= 0.5 && kg <= 2000, 'estimatedKg', 'informe entre 0,5 e 2.000 kg');
    const hoje = dataLocal(new Date());
    let dataPreferida: string | null = null;
    if (b.preferredDate !== undefined && b.preferredDate !== null && b.preferredDate !== '') {
      const pd = lerTexto(b.preferredDate) ?? '';
      if (!DATA_RE.test(pd)) v.add('preferredDate', 'data inválida (use AAAA-MM-DD)');
      else if (pd < hoje) v.add('preferredDate', 'a data preferida não pode estar no passado');
      else if (pd > somarDias(hoje, 60)) v.add('preferredDate', 'escolha uma data nos próximos 60 dias');
      else dataPreferida = pd;
    }
    const observacoes = b.notes === undefined || b.notes === null ? null : lerTexto(b.notes);
    if (observacoes && observacoes.length > 500) v.add('notes', 'máximo de 500 caracteres');
    v.throwIfAny();
    const abertas = d.collectionRequests.filter((r) => r.requesterId === me.id && r.source === 'USER' && SOLICITACAO_ABERTA.includes(r.status)).length;
    if (abertas >= MAX_SOLICITACOES_ABERTAS) throw falha.business(`Você já tem ${abertas} solicitações em aberto. Aguarde a coleta ou cancele alguma.`);

    const quando = agoraIso();
    const registro: RegistroSolicitacaoColeta = {
      id: crypto.randomUUID(), address: endereco, latitude: lat as number, longitude: lon as number, categoryCodes: codigos,
      estimatedKg: arredondar(kg as number), status: 'REQUESTED', source: 'USER', preferredDate: dataPreferida, scheduledFor: null, routeId: null,
      notes: observacoes || null, createdAt: quando, updatedAt: quando, requesterId: me.id, smartBinId: null,
    };
    d.collectionRequests.push(registro);
    registrarAuditoria(d, me, 'COLLECTION_REQUESTED', 'CollectionRequest', registro.id, `${registro.estimatedKg} kg — ${codigos.join(', ')}`);
    return criado<CollectionRequest>(paraSolicitacaoColeta(d, registro));
  });

  rota('GET', '/collection-requests', ({ me }) => {
    const d = banco();
    const minhaResidencia = me.householdId;
    const minhasLixeiras = new Set(d.bins.filter((b) => minhaResidencia && b.householdId === minhaResidencia).map((b) => b.id));
    return ok<CollectionRequest[]>(d.collectionRequests
      .filter((r) => r.requesterId === me.id || (r.smartBinId !== null && minhasLixeiras.has(r.smartBinId)))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((r) => paraSolicitacaoColeta(d, r)));
  });

  rota('POST', '/collection-requests/:id/cancel', ({ me, params }) => {
    const d = banco();
    const r = d.collectionRequests.find((x) => x.id === params.id);
    if (!r || (r.requesterId !== me.id && me.role !== 'ADMIN')) throw falha.notFound('Solicitação não encontrada.');
    if (r.status === 'CANCELLED') return ok<CollectionRequest>(paraSolicitacaoColeta(d, r));
    if (r.status === 'IN_ROUTE' || r.status === 'COLLECTED') {
      throw falha.business(r.status === 'COLLECTED' ? 'Esta coleta já foi realizada.' : 'O coletor já está a caminho; não é possível cancelar.');
    }
    if (r.routeId) {
      const registroRota = d.routes.find((x) => x.id === r.routeId);
      if (registroRota) {
        registroRota.stops = registroRota.stops.filter((s) => s.requestId !== r.id).map((s, i) => ({ ...s, sequence: i + 1 }));
        registroRota.loadKg = arredondar(registroRota.stops.reduce((s, x) => s + x.estimatedKg, 0));
        // distância aproximada após remover a parada
        let km = 0;
        let anterior = registroRota.depot;
        for (const s of registroRota.stops) { km += distanciaHaversineKm(anterior, s); anterior = s; }
        registroRota.totalDistanceKm = arredondar(km + distanciaHaversineKm(anterior, registroRota.depot));
      }
    }
    r.status = 'CANCELLED';
    r.routeId = null;
    r.scheduledFor = null;
    r.updatedAt = agoraIso();
    registrarAuditoria(d, me, 'COLLECTION_CANCELLED', 'CollectionRequest', r.id, null);
    return ok<CollectionRequest>(paraSolicitacaoColeta(d, r));
  });
}
