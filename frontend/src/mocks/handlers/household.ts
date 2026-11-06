/** Residência (Smart Home), lixeiras inteligentes e leituras IoT. */
import type { Household, SmartBin, SmartBinCreated } from '@/api/types';
import { banco, agoraIso, type RegistroResidencia, type BancoSimulado, type RegistroLixeira, type RegistroUsuario } from '../db';
import { paraResidencia, paraLixeira } from '../dto';
import { ErroHttp, Validador, objetoDoCorpo, criado, falha, semConteudo, ok, lerTexto } from '../http';
import { registrarAuditoria } from '../logic/audit';
import { registrarLeitura } from '../logic/bins';
import { pontoDoBairro } from '../logic/geo';
import { avaliarMedalhas } from '../logic/points';
import { codigoAleatorio, arredondar } from '../logic/random';
import { rota } from '../server';

const MAX_MEMBROS = 12;
const MAX_LIXEIRAS = 12;

function minhaResidencia(d: BancoSimulado, me: RegistroUsuario): RegistroResidencia | null {
  return d.households.find((h) => h.id === me.householdId) ?? null;
}

function exigirResidencia(d: BancoSimulado, me: RegistroUsuario): RegistroResidencia {
  const h = minhaResidencia(d, me);
  if (!h) throw falha.business('Crie ou entre em uma residência antes de cadastrar lixeiras.');
  return h;
}

function novoCodigoConvite(d: BancoSimulado): string {
  let codigo: string;
  do codigo = codigoAleatorio(8); while (d.households.some((h) => h.inviteCode === codigo));
  return codigo;
}

export function registrarRotasResidencia() {
  rota('GET', '/household', ({ me }) => {
    const d = banco();
    const h = minhaResidencia(d, me);
    return h ? ok<Household>(paraResidencia(d, h)) : semConteudo();
  });

  rota('POST', '/household', ({ me, body }) => {
    const d = banco();
    if (minhaResidencia(d, me)) throw falha.business('Você já faz parte de uma residência. Saia dela antes de criar outra.');
    const b = objetoDoCorpo(body);
    const v = new Validador();
    const nome = lerTexto(b.name) ?? '';
    const bairro = lerTexto(b.neighborhood) ?? '';
    const cidade = lerTexto(b.city) ?? '';
    v.check(nome.length >= 2 && nome.length <= 80, 'name', 'informe um nome (2 a 80 caracteres)');
    v.check(bairro.length >= 2 && bairro.length <= 80, 'neighborhood', 'informe o bairro (2 a 80 caracteres)');
    v.check(cidade.length >= 2 && cidade.length <= 80, 'city', 'informe a cidade (2 a 80 caracteres)');
    const endereco = b.address === undefined || b.address === null ? null : lerTexto(b.address);
    if (endereco && endereco.length > 200) v.add('address', 'máximo de 200 caracteres');
    const lat = typeof b.latitude === 'number' ? b.latitude : null;
    const lon = typeof b.longitude === 'number' ? b.longitude : null;
    v.throwIfAny();
    const base = pontoDoBairro(bairro);
    const h: RegistroResidencia = {
      id: crypto.randomUUID(), name: nome, neighborhood: bairro, city: cidade, inviteCode: novoCodigoConvite(d), ownerId: me.id, address: endereco || null,
      latitude: lat ?? arredondar(base.latitude + (Math.random() - 0.5) * 0.006, 6),
      longitude: lon ?? arredondar(base.longitude + (Math.random() - 0.5) * 0.006, 6),
      createdAt: agoraIso(),
    };
    d.households.push(h);
    me.householdId = h.id;
    registrarAuditoria(d, me, 'HOUSEHOLD_CREATED', 'Household', h.id, nome);
    return criado<Household>(paraResidencia(d, h));
  });

  rota('POST', '/household/join', ({ me, body }) => {
    const d = banco();
    const b = objetoDoCorpo(body);
    const codigo = (lerTexto(b.inviteCode) ?? '').toUpperCase();
    if (!/^[A-Z0-9]{6,12}$/.test(codigo)) throw falha.campo('inviteCode', 'código de convite inválido');
    const h = d.households.find((x) => x.inviteCode === codigo);
    if (!h) throw falha.notFound('Nenhuma residência encontrada com este código.');
    if (me.householdId === h.id) return ok<Household>(paraResidencia(d, h));
    if (minhaResidencia(d, me)) throw falha.business('Você já faz parte de uma residência. Saia dela antes de entrar em outra.');
    if (d.users.filter((u) => u.householdId === h.id).length >= MAX_MEMBROS) {
      throw falha.business(`Esta residência já atingiu o limite de ${MAX_MEMBROS} moradores.`);
    }
    me.householdId = h.id;
    registrarAuditoria(d, me, 'HOUSEHOLD_JOINED', 'Household', h.id, h.name);
    return ok<Household>(paraResidencia(d, h));
  });

  rota('POST', '/household/leave', ({ me }) => {
    const d = banco();
    const h = minhaResidencia(d, me);
    if (!h) throw falha.business('Você não faz parte de nenhuma residência.');
    me.householdId = null;
    const restante = d.users.filter((u) => u.householdId === h.id);
    if (!restante.length) {
      // último morador: a residência e as lixeiras deixam de existir
      const idsLixeiras = new Set(d.bins.filter((b) => b.householdId === h.id).map((b) => b.id));
      d.bins = d.bins.filter((b) => !idsLixeiras.has(b.id));
      d.collectionRequests.forEach((r) => { if (r.smartBinId && idsLixeiras.has(r.smartBinId)) r.smartBinId = null; });
      d.households = d.households.filter((x) => x.id !== h.id);
    } else if (h.ownerId === me.id) {
      h.ownerId = [...restante].sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0].id;
    }
    registrarAuditoria(d, me, 'HOUSEHOLD_LEFT', 'Household', h.id, h.name);
    return semConteudo();
  });

  rota('GET', '/household/bins', ({ me }) => {
    const d = banco();
    const h = minhaResidencia(d, me);
    if (!h) return ok<SmartBin[]>([]);
    return ok<SmartBin[]>(d.bins.filter((b) => b.householdId === h.id).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')).map((b) => paraLixeira(d, b)));
  });

  rota('POST', '/household/bins', ({ me, body }) => {
    const d = banco();
    const h = exigirResidencia(d, me);
    if (d.bins.filter((b) => b.householdId === h.id).length >= MAX_LIXEIRAS) throw falha.business(`Limite de ${MAX_LIXEIRAS} lixeiras por residência atingido.`);
    const b = objetoDoCorpo(body);
    const v = new Validador();
    const nome = lerTexto(b.name) ?? '';
    v.check(nome.length >= 2 && nome.length <= 60, 'name', 'informe um nome para a lixeira');
    const categoria = d.categories.find((c) => c.id === b.categoryId && c.active);
    v.check(!!categoria, 'categoryId', 'categoria não encontrada');
    const capacidade = b.capacityLiters;
    v.check(typeof capacidade === 'number' && Number.isInteger(capacidade) && capacidade >= 5 && capacidade <= 1000, 'capacityLiters', 'informe de 5 a 1000 litros');
    const limite = b.autoRequestThreshold;
    v.check(typeof limite === 'number' && Number.isInteger(limite) && limite >= 50 && limite <= 100, 'autoRequestThreshold', 'informe um limite entre 50 e 100%');
    v.throwIfAny();
    const agora = agoraIso();
    const chaveDispositivo = codigoAleatorio(32);
    const lixeira: RegistroLixeira = {
      id: crypto.randomUUID(), householdId: h.id, categoryId: categoria!.id, name: nome, capacityLiters: capacidade as number,
      autoRequestThreshold: limite as number, deviceId: crypto.randomUUID(), deviceKey: chaveDispositivo, fillLevel: 0, batteryLevel: 100,
      lastReadingAt: null,
      // na demo o sensor já começa a "transmitir": o nível sobe devagar sozinho
      fillRatePerHour: arredondar(1.5 + Math.random() * 2, 2),
      readings: [], createdAt: agora,
    };
    d.bins.push(lixeira);
    registrarLeitura(d, lixeira, 0, 100, agora);
    avaliarMedalhas(d, me.id, agora);
    registrarAuditoria(d, me, 'SMART_BIN_CREATED', 'SmartBin', lixeira.id, nome);
    return criado<SmartBinCreated>({ bin: paraLixeira(d, lixeira), deviceId: lixeira.deviceId, deviceKey: chaveDispositivo });
  });

  rota('DELETE', '/household/bins/:id', ({ me, params }) => {
    const d = banco();
    const h = minhaResidencia(d, me);
    const lixeira = d.bins.find((b) => b.id === params.id && h && b.householdId === h.id);
    if (!lixeira) throw falha.notFound('Lixeira não encontrada.');
    d.bins = d.bins.filter((b) => b.id !== lixeira.id);
    d.collectionRequests.forEach((r) => { if (r.smartBinId === lixeira.id) r.smartBinId = null; });
    registrarAuditoria(d, me, 'SMART_BIN_DELETED', 'SmartBin', lixeira.id, lixeira.name);
    return semConteudo();
  });

  rota('POST', '/iot/readings', ({ headers, body }) => {
    const d = banco();
    const idDispositivo = headers.get('X-Device-Id');
    const chaveDispositivo = headers.get('X-Device-Key');
    const lixeira = d.bins.find((b) => b.deviceId === idDispositivo);
    if (!lixeira || !chaveDispositivo || lixeira.deviceKey !== chaveDispositivo) {
      throw new ErroHttp(401, 'UNAUTHORIZED', 'Dispositivo não autorizado', 'Credenciais do dispositivo inválidas.');
    }
    const b = objetoDoCorpo(body);
    const v = new Validador();
    const nivel = b.fillLevel;
    const bateria = b.batteryLevel;
    v.check(typeof nivel === 'number' && nivel >= 0 && nivel <= 100, 'fillLevel', 'informe de 0 a 100');
    v.check(typeof bateria === 'number' && bateria >= 0 && bateria <= 100, 'batteryLevel', 'informe de 0 a 100');
    v.throwIfAny();
    registrarLeitura(d, lixeira, Math.round(nivel as number), Math.round(bateria as number), agoraIso());
    return semConteudo(202);
  }, { access: 'public', csrf: false });
}
