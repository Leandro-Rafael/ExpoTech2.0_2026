/** /api/admin — somente ADMIN. */
import type {
  AdminOverview, AdminUser, AuditEntry, Category, CategoryCode, Challenge, ChallengeMetric, CollectionPoint,
  CollectionRequest, CollectionRequestStatus, Disposal, GeoPoint, Goal, Organization, OrganizationType, Page, Reward,
  Role, Route, RouteOptimization, SmartBin, UserRef,
} from '@/api/types';
import { banco, agoraIso, type RegistroDesafio, type RegistroEcoponto, type RegistroSolicitacaoColeta, type RegistroMeta, type BancoSimulado, type RegistroRota } from '../db';
import {
  paginar, paraUsuarioAdmin, paraDesafio, paraEcoponto, paraSolicitacaoColeta, paraDescarte, paraRota, paraLixeira, refUsuario,
} from '../dto';
import { DATA_RE, UUID_RE, Validador, objetoDoCorpo, lerBooleano, criado, parametroEnum, falha, parametroInteiro, semConteudo, ok, lerTexto, type Json } from '../http';
import { registrarAuditoria } from '../logic/audit';
import { SOLICITACAO_ABERTA } from '../logic/bins';
import { DIA, somarDias, dataLocal } from '../logic/dates';
import { LIMIAR_SINALIZACAO } from '../logic/fraud';
import { DEPOSITO_PADRAO } from '../logic/geo';
import { dtoMeta } from '../logic/impact';
import { aprovarDescarte, ehRecente } from '../logic/points';
import { arredondar } from '../logic/random';
import { ALGORITMO, CAPACIDADE_PADRAO_KG, otimizar } from '../logic/routes';
import { ADMIN, rota } from '../server';
import { validarCodigosCategoria } from './collection';
import { CODIGOS_CATEGORIA, STATUS_DESCARTE } from './disposals';

const PAPEIS: Role[] = ['USER', 'COLLECTOR', 'ADMIN'];
const STATUS_SOLICITACAO: CollectionRequestStatus[] = ['REQUESTED', 'SCHEDULED', 'IN_ROUTE', 'COLLECTED', 'CANCELLED'];
const TIPOS_ORG: OrganizationType[] = ['TURMA', 'EMPRESA', 'CONDOMINIO', 'ESCOLA'];
const A = { access: ADMIN };

const normalizarTexto = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// ---------------------------------------------------------------- validação dos inputs

function campoTexto(v: Validador, b: Json, campo: string, min: number, max: number, rotulo = 'campo'): string {
  const s = lerTexto(b[campo]) ?? '';
  v.check(s.length >= min && s.length <= max, campo, `${rotulo}: informe de ${min} a ${max} caracteres`);
  return s;
}

function campoNumero(v: Validador, b: Json, campo: string, min: number, max: number, inteiro = false): number {
  const x = b[campo];
  v.check(typeof x === 'number' && Number.isFinite(x) && x >= min && x <= max && (!inteiro || Number.isInteger(x)), campo,
    `informe ${inteiro ? 'um número inteiro ' : ''}entre ${min} e ${max}`);
  return x as number;
}

function campoBooleano(v: Validador, b: Json, campo: string): boolean {
  const x = lerBooleano(b[campo]);
  v.check(x !== null, campo, 'informe verdadeiro ou falso');
  return x ?? false;
}

function entradaCategoria(d: BancoSimulado, body: unknown, idAtual: string | null): Omit<Category, 'id'> {
  const b = objetoDoCorpo(body);
  const v = new Validador();
  const codigo = b.code as CategoryCode;
  if (!CODIGOS_CATEGORIA.includes(codigo)) v.add('code', 'código inválido');
  else if (d.categories.some((c) => c.code === codigo && c.id !== idAtual)) v.add('code', 'já existe uma categoria com este código');
  const nome = campoTexto(v, b, 'name', 2, 60, 'nome');
  const descricao = campoTexto(v, b, 'description', 0, 500, 'descrição');
  const orientacao = Array.isArray(b.guidance) ? b.guidance.map((g) => String(g).trim()).filter(Boolean) : null;
  if (!orientacao) v.add('guidance', 'informe a lista de orientações');
  else v.check(orientacao.length <= 12 && orientacao.every((g) => g.length <= 300), 'guidance', 'até 12 orientações de até 300 caracteres');
  const pontosPorKg = campoNumero(v, b, 'pointsPerKg', 0, 1000, true);
  const fatorCo2Kg = campoNumero(v, b, 'co2FactorKg', 0, 50);
  const reciclavel = campoBooleano(v, b, 'recyclable');
  const cor = lerTexto(b.color) ?? '';
  v.check(/^#[0-9A-Fa-f]{6}$/.test(cor), 'color', 'use uma cor hexadecimal (#RRGGBB)');
  const icon = campoTexto(v, b, 'icon', 1, 40, 'ícone');
  const maxKgPorDescarte = campoNumero(v, b, 'maxKgPerDisposal', 0.1, 1000);
  const ativo = campoBooleano(v, b, 'active');
  v.throwIfAny();
  return { code: codigo, name: nome, description: descricao, guidance: orientacao!, pointsPerKg: pontosPorKg, co2FactorKg: fatorCo2Kg, recyclable: reciclavel, color: cor.toUpperCase(), icon, maxKgPerDisposal: maxKgPorDescarte, active: ativo };
}

function entradaEcoponto(body: unknown): Omit<RegistroEcoponto, 'id'> {
  const b = objetoDoCorpo(body);
  const v = new Validador();
  const saida = {
    name: campoTexto(v, b, 'name', 3, 120, 'nome'),
    address: campoTexto(v, b, 'address', 5, 200, 'endereço'),
    neighborhood: campoTexto(v, b, 'neighborhood', 2, 80, 'bairro'),
    latitude: campoNumero(v, b, 'latitude', -90, 90),
    longitude: campoNumero(v, b, 'longitude', -180, 180),
    openingHours: campoTexto(v, b, 'openingHours', 3, 120, 'horário'),
    categories: validarCodigosCategoria(v, 'categories', b.categories),
    active: campoBooleano(v, b, 'active'),
  };
  v.throwIfAny();
  return saida;
}

function entradaRecompensa(body: unknown): Omit<Reward, 'id'> {
  const b = objetoDoCorpo(body);
  const v = new Validador();
  const parceiro = b.partner === null || b.partner === undefined ? null : lerTexto(b.partner);
  if (parceiro && parceiro.length > 120) v.add('partner', 'máximo de 120 caracteres');
  const saida = {
    name: campoTexto(v, b, 'name', 2, 80, 'nome'),
    description: campoTexto(v, b, 'description', 0, 500, 'descrição'),
    costPoints: campoNumero(v, b, 'costPoints', 1, 1_000_000, true),
    stock: campoNumero(v, b, 'stock', 0, 1_000_000, true),
    icon: campoTexto(v, b, 'icon', 1, 40, 'ícone'),
    partner: parceiro || null,
    active: campoBooleano(v, b, 'active'),
  };
  v.throwIfAny();
  return saida;
}

function entradaDesafio(body: unknown): Omit<RegistroDesafio, 'id'> {
  const b = objetoDoCorpo(body);
  const v = new Validador();
  const codigoCategoria = b.categoryCode ?? null;
  if (codigoCategoria !== null && !CODIGOS_CATEGORIA.includes(codigoCategoria as CategoryCode)) v.add('categoryCode', 'categoria inválida');
  const metrica = b.metric as ChallengeMetric;
  v.check(metrica === 'KG' || metrica === 'COUNT', 'metric', 'use KG ou COUNT');
  const iniciaEm = lerTexto(b.startsAt) ?? '';
  const terminaEm = lerTexto(b.endsAt) ?? '';
  v.check(DATA_RE.test(iniciaEm), 'startsAt', 'data inválida (AAAA-MM-DD)');
  if (v.check(DATA_RE.test(terminaEm), 'endsAt', 'data inválida (AAAA-MM-DD)') && DATA_RE.test(iniciaEm)) {
    v.check(terminaEm >= iniciaEm, 'endsAt', 'o fim deve ser depois do início');
  }
  const saida = {
    title: campoTexto(v, b, 'title', 3, 100, 'título'),
    description: campoTexto(v, b, 'description', 0, 500, 'descrição'),
    categoryCode: codigoCategoria as CategoryCode | null,
    metric: metrica,
    target: campoNumero(v, b, 'target', 0.1, 100_000),
    bonusPoints: campoNumero(v, b, 'bonusPoints', 0, 100_000, true),
    startsAt: iniciaEm,
    endsAt: terminaEm,
    active: campoBooleano(v, b, 'active'),
  };
  v.throwIfAny();
  return saida;
}

function entradaMeta(body: unknown): Omit<RegistroMeta, 'id'> {
  const b = objetoDoCorpo(body);
  const v = new Validador();
  const saida = {
    year: campoNumero(v, b, 'year', 2024, 2100, true),
    title: campoTexto(v, b, 'title', 3, 120, 'título'),
    targetRecyclingRate: campoNumero(v, b, 'targetRecyclingRate', 0, 1),
    targetKg: campoNumero(v, b, 'targetKg', 0, 1_000_000_000),
  };
  v.throwIfAny();
  return saida;
}

// ---------------------------------------------------------------- rotas (otimização)

interface ParadaPlano { id: string; latitude: number; longitude: number; kg: number; address: string }

function corpoRota(d: BancoSimulado, body: unknown, paraCriar: boolean) {
  const b = objetoDoCorpo(body);
  const v = new Validador();
  const ids = Array.isArray(b.requestIds) ? (b.requestIds as unknown[]) : null;
  if (!ids || !ids.length) v.add('requestIds', 'selecione ao menos uma solicitação');
  else if (ids.length > 100) v.add('requestIds', 'no máximo 100 solicitações por vez');
  else if (ids.some((x) => typeof x !== 'string' || !UUID_RE.test(x))) v.add('requestIds', 'id inválido');
  let deposito: GeoPoint = DEPOSITO_PADRAO;
  if (b.depot !== undefined && b.depot !== null) {
    const dp = b.depot as Json;
    const ok2 = typeof dp.latitude === 'number' && typeof dp.longitude === 'number' && Math.abs(dp.latitude) <= 90 && Math.abs(dp.longitude) <= 180;
    if (v.check(ok2, 'depot', 'garagem inválida')) deposito = { latitude: dp.latitude as number, longitude: dp.longitude as number };
  }
  let capacidade = CAPACIDADE_PADRAO_KG;
  if (b.vehicleCapacityKg !== undefined && b.vehicleCapacityKg !== null) capacidade = campoNumero(v, b, 'vehicleCapacityKg', 10, 50_000);
  v.throwIfAny();
  const solicitacoes: RegistroSolicitacaoColeta[] = [];
  for (const id of new Set(ids as string[])) {
    const r = d.collectionRequests.find((x) => x.id === id);
    if (!r) throw falha.campo('requestIds', 'solicitação não encontrada');
    if (paraCriar ? r.status !== 'REQUESTED' : !SOLICITACAO_ABERTA.includes(r.status)) {
      throw falha.business(paraCriar ? 'Só é possível roteirizar solicitações com status "Solicitada".' : 'Há solicitações que não estão em aberto.');
    }
    solicitacoes.push(r);
  }
  solicitacoes.sort((a, c) => a.createdAt.localeCompare(c.createdAt));
  const paradas: ParadaPlano[] = solicitacoes.map((r) => ({ id: r.id, latitude: r.latitude, longitude: r.longitude, kg: r.estimatedKg, address: r.address }));
  return { b, depot: deposito, capacity: capacidade, plan: otimizar(deposito, paradas, capacidade) };
}

// ---------------------------------------------------------------- CSV

function celulaCsv(valor: string): string {
  let v = valor;
  if (/^[=+\-@\t\r]/.test(v)) v = `'${v}`; // proteção contra CSV/Formula Injection
  if (/[;"\n\r]/.test(v)) v = `"${v.replace(/"/g, '""')}"`;
  return v;
}

const formatoDataHora = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const formatarDataHora = (iso: string) => formatoDataHora.format(new Date(iso)).replace(',', '');

// ---------------------------------------------------------------- registro

export function registrarRotasAdmin() {
  rota('GET', '/admin/overview', () => {
    const d = banco();
    const agora = Date.now();
    const categoriaPorId = new Map(d.categories.map((c) => [c.id, c]));
    const aprovados = d.disposals.filter((x) => x.status === 'APPROVED');
    const dias: AdminOverview['disposalsLast14Days'] = [];
    const hoje = dataLocal(new Date(agora));
    for (let i = 13; i >= 0; i--) dias.push({ date: somarDias(hoje, -i), count: 0, kg: 0 });
    const porDia = new Map(dias.map((x) => [x.date, x]));
    for (const x of d.disposals) {
      const e = porDia.get(dataLocal(x.createdAt));
      if (e) { e.count++; e.kg = arredondar(e.kg + x.quantityKg); }
    }
    const idsAtivos = new Set(d.disposals.filter((x) => agora - Date.parse(x.createdAt) <= 30 * DIA).map((x) => x.userId));
    d.users.forEach((u) => { if (ehRecente(u.lastLoginAt, agora, 30)) idsAtivos.add(u.id); });
    return ok<AdminOverview>({
      users: d.users.length,
      activeUsers30d: idsAtivos.size,
      pendingDisposals: d.disposals.filter((x) => x.status === 'PENDING').length,
      flaggedDisposals: d.disposals.filter((x) => x.status === 'PENDING' && x.fraudScore >= LIMIAR_SINALIZACAO).length,
      openCollectionRequests: d.collectionRequests.filter((r) => SOLICITACAO_ABERTA.includes(r.status)).length,
      binsNeedingCollection: d.bins.filter((b) => b.fillLevel >= b.autoRequestThreshold).length,
      totalKg: arredondar(aprovados.reduce((s, x) => s + x.quantityKg, 0)),
      recycledKg: arredondar(aprovados.reduce((s, x) => s + (categoriaPorId.get(x.categoryId)?.recyclable ? x.quantityKg : 0), 0)),
      pointsIssued: d.transactions.filter((t) => t.amount > 0 && (t.type === 'EARN' || t.type === 'BONUS')).reduce((s, t) => s + t.amount, 0),
      redemptions: d.redemptions.length,
      disposalsLast14Days: dias,
      recentAudit: d.audit.slice(0, 10).map((e) => ({ ...e })),
    });
  }, A);

  // ---------- usuários
  rota('GET', '/admin/users', ({ query }) => {
    const d = banco();
    const q = normalizarTexto(query.get('q')?.trim() ?? '');
    const papel = parametroEnum(query, 'role', PAPEIS);
    const pagina = parametroInteiro(query, 'page', 0, 0, 10_000);
    const tamanho = parametroInteiro(query, 'size', 20, 1, 100);
    const lista = d.users
      .filter((u) => (!papel || u.role === papel) && (!q || normalizarTexto(u.name).includes(q) || u.email.includes(q)))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    const p = paginar(lista, pagina, tamanho);
    return ok<Page<AdminUser>>({ ...p, content: p.content.map((u) => paraUsuarioAdmin(d, u)) });
  }, A);

  rota('PATCH', '/admin/users/:id', ({ me, params, body }) => {
    const d = banco();
    const u = d.users.find((x) => x.id === params.id);
    if (!u) throw falha.notFound('Usuário não encontrado.');
    const b = objetoDoCorpo(body);
    const v = new Validador();
    if (b.role !== undefined && !PAPEIS.includes(b.role as Role)) v.add('role', 'perfil inválido');
    if (b.enabled !== undefined && typeof b.enabled !== 'boolean') v.add('enabled', 'informe verdadeiro ou falso');
    v.throwIfAny();
    if (u.id === me.id && ((b.role !== undefined && b.role !== me.role) || b.enabled === false)) {
      throw falha.business('Você não pode alterar o próprio perfil nem desativar a própria conta.');
    }
    const alteracoes: string[] = [];
    if (b.role !== undefined && b.role !== u.role) { alteracoes.push(`perfil ${u.role} → ${b.role}`); u.role = b.role as Role; }
    if (typeof b.enabled === 'boolean' && b.enabled !== u.enabled) {
      alteracoes.push(b.enabled ? 'reativado' : 'desativado');
      u.enabled = b.enabled;
      if (!u.enabled) u.sessionEpoch++; // encerra as sessões
      else { u.lockedUntil = null; u.failedLogins = 0; }
    }
    if (alteracoes.length) registrarAuditoria(d, me, 'USER_UPDATED', 'User', u.id, alteracoes.join(', '));
    return ok<AdminUser>(paraUsuarioAdmin(d, u));
  }, A);

  // ---------- descartes
  rota('GET', '/admin/disposals', ({ query }) => {
    const d = banco();
    const status = parametroEnum(query, 'status', STATUS_DESCARTE);
    const sinalizado = query.get('flagged') === 'true';
    const pagina = parametroInteiro(query, 'page', 0, 0, 10_000);
    const tamanho = parametroInteiro(query, 'size', 20, 1, 100);
    const lista = d.disposals
      .filter((x) => (!status || x.status === status) && (!sinalizado || x.fraudScore >= LIMIAR_SINALIZACAO))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const p = paginar(lista, pagina, tamanho);
    return ok<Page<Disposal>>({ ...p, content: p.content.map((x) => paraDescarte(d, x, true)) });
  }, A);

  rota('POST', '/admin/disposals/:id/approve', ({ me, params, body }) => {
    const d = banco();
    const x = d.disposals.find((k) => k.id === params.id);
    if (!x) throw falha.notFound('Descarte não encontrado.');
    if (x.status === 'REJECTED') throw falha.conflict('Este descarte já foi recusado e não pode ser aprovado.');
    if (x.status === 'APPROVED') return ok<Disposal>(paraDescarte(d, x, true)); // pontos só uma vez
    if (x.userId === me.id) throw falha.business('Você não pode aprovar o seu próprio descarte.');
    const b = objetoDoCorpo(body);
    let observacao = '';
    if (b.categoryId !== undefined || b.quantityKg !== undefined) {
      const antes = d.categories.find((c) => c.id === x.categoryId)!;
      const categoria = b.categoryId === undefined || b.categoryId === null ? antes : d.categories.find((c) => c.id === b.categoryId);
      if (!categoria) throw falha.campo('categoryId', 'categoria não encontrada');
      let kg = x.quantityKg;
      if (b.quantityKg !== undefined && b.quantityKg !== null) {
        if (typeof b.quantityKg !== 'number' || b.quantityKg < 0.01) throw falha.campo('quantityKg', 'a quantidade mínima é 0,01 kg');
        kg = arredondar(b.quantityKg, 3);
      }
      if (kg > categoria.maxKgPerDisposal) throw falha.campo('quantityKg', `máximo de ${categoria.maxKgPerDisposal} kg para ${categoria.name}`);
      if (categoria.id !== antes.id || kg !== x.quantityKg) {
        observacao = ` (corrigido: ${antes.code} ${x.quantityKg} kg -> ${categoria.code} ${kg} kg)`;
        x.categoryId = categoria.id;
        x.quantityKg = kg;
      }
    }
    const concedidos = aprovarDescarte(d, x, agoraIso());
    registrarAuditoria(d, me, 'DISPOSAL_APPROVED', 'Disposal', x.id, `+${concedidos} pontos${observacao}`);
    return ok<Disposal>(paraDescarte(d, x, true));
  }, A);

  rota('POST', '/admin/disposals/:id/reject', ({ me, params, body }) => {
    const d = banco();
    const x = d.disposals.find((k) => k.id === params.id);
    if (!x) throw falha.notFound('Descarte não encontrado.');
    if (x.status === 'APPROVED') throw falha.conflict('Este descarte já foi aprovado e não pode ser recusado.');
    const motivo = lerTexto(objetoDoCorpo(body).reason) ?? '';
    if (motivo.length < 3) throw falha.campo('reason', 'informe o motivo da recusa');
    if (motivo.length > 300) throw falha.campo('reason', 'máximo de 300 caracteres');
    if (x.status === 'PENDING') {
      x.status = 'REJECTED';
      x.reviewedAt = agoraIso();
      x.rejectionReason = motivo;
      registrarAuditoria(d, me, 'DISPOSAL_REJECTED', 'Disposal', x.id, motivo);
    }
    return ok<Disposal>(paraDescarte(d, x, true));
  }, A);

  // ---------- categorias
  rota('POST', '/admin/categories', ({ me, body }) => {
    const d = banco();
    const c: Category = { id: crypto.randomUUID(), ...entradaCategoria(d, body, null) };
    d.categories.push(c);
    registrarAuditoria(d, me, 'CATEGORY_CREATED', 'Category', c.id, c.name);
    return criado<Category>({ ...c });
  }, A);

  rota('PUT', '/admin/categories/:id', ({ me, params, body }) => {
    const d = banco();
    const c = d.categories.find((x) => x.id === params.id);
    if (!c) throw falha.notFound('Categoria não encontrada.');
    Object.assign(c, entradaCategoria(d, body, c.id));
    registrarAuditoria(d, me, 'CATEGORY_UPDATED', 'Category', c.id, c.name);
    return ok<Category>({ ...c });
  }, A);

  // ---------- ecopontos
  rota('POST', '/admin/collection-points', ({ me, body }) => {
    const d = banco();
    const p: RegistroEcoponto = { id: crypto.randomUUID(), ...entradaEcoponto(body) };
    d.collectionPoints.push(p);
    registrarAuditoria(d, me, 'COLLECTION_POINT_CREATED', 'CollectionPoint', p.id, p.name);
    return criado<CollectionPoint>(paraEcoponto(p, null));
  }, A);

  rota('PUT', '/admin/collection-points/:id', ({ me, params, body }) => {
    const d = banco();
    const p = d.collectionPoints.find((x) => x.id === params.id);
    if (!p) throw falha.notFound('Ecoponto não encontrado.');
    Object.assign(p, entradaEcoponto(body));
    registrarAuditoria(d, me, 'COLLECTION_POINT_UPDATED', 'CollectionPoint', p.id, p.name);
    return ok<CollectionPoint>(paraEcoponto(p, null));
  }, A);

  rota('DELETE', '/admin/collection-points/:id', ({ me, params }) => {
    const d = banco();
    const p = d.collectionPoints.find((x) => x.id === params.id);
    if (!p) throw falha.notFound('Ecoponto não encontrado.');
    if (d.disposals.some((x) => x.collectionPointId === p.id)) {
      p.active = false; // há histórico vinculado: desativa em vez de apagar
    } else {
      d.collectionPoints = d.collectionPoints.filter((x) => x.id !== p.id);
    }
    registrarAuditoria(d, me, 'COLLECTION_POINT_DELETED', 'CollectionPoint', p.id, p.name);
    return semConteudo();
  }, A);

  // ---------- recompensas
  rota('GET', '/admin/rewards', () =>
    ok<Reward[]>(banco().rewards.slice().sort((a, b) => a.costPoints - b.costPoints).map((r) => ({ ...r }))), A);

  rota('POST', '/admin/rewards', ({ me, body }) => {
    const d = banco();
    const r: Reward = { id: crypto.randomUUID(), ...entradaRecompensa(body) };
    d.rewards.push(r);
    registrarAuditoria(d, me, 'REWARD_CREATED', 'Reward', r.id, r.name);
    return criado<Reward>({ ...r });
  }, A);

  rota('PUT', '/admin/rewards/:id', ({ me, params, body }) => {
    const d = banco();
    const r = d.rewards.find((x) => x.id === params.id);
    if (!r) throw falha.notFound('Recompensa não encontrada.');
    Object.assign(r, entradaRecompensa(body));
    registrarAuditoria(d, me, 'REWARD_UPDATED', 'Reward', r.id, r.name);
    return ok<Reward>({ ...r });
  }, A);

  // ---------- desafios
  rota('GET', '/admin/challenges', () => {
    const d = banco();
    return ok<Challenge[]>([...d.challenges].sort((a, b) => b.startsAt.localeCompare(a.startsAt)).map((c) => paraDesafio(d, c, null)));
  }, A);

  rota('POST', '/admin/challenges', ({ me, body }) => {
    const d = banco();
    const c: RegistroDesafio = { id: crypto.randomUUID(), ...entradaDesafio(body) };
    d.challenges.push(c);
    registrarAuditoria(d, me, 'CHALLENGE_CREATED', 'Challenge', c.id, c.title);
    return criado<Challenge>(paraDesafio(d, c, null));
  }, A);

  rota('PUT', '/admin/challenges/:id', ({ me, params, body }) => {
    const d = banco();
    const c = d.challenges.find((x) => x.id === params.id);
    if (!c) throw falha.notFound('Desafio não encontrado.');
    Object.assign(c, entradaDesafio(body));
    registrarAuditoria(d, me, 'CHALLENGE_UPDATED', 'Challenge', c.id, c.title);
    return ok<Challenge>(paraDesafio(d, c, null));
  }, A);

  // ---------- organizações
  rota('GET', '/admin/organizations', () =>
    ok<Organization[]>([...banco().organizations].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')).map((o) => ({ ...o }))), A);

  rota('POST', '/admin/organizations', ({ me, body }) => {
    const d = banco();
    const b = objetoDoCorpo(body);
    const v = new Validador();
    const nome = campoTexto(v, b, 'name', 2, 120, 'nome');
    const tipo = b.type as OrganizationType;
    v.check(TIPOS_ORG.includes(tipo), 'type', 'tipo inválido');
    if (!v.has('name') && d.organizations.some((o) => normalizarTexto(o.name) === normalizarTexto(nome))) v.add('name', 'já existe uma organização com este nome');
    v.throwIfAny();
    const o: Organization = { id: crypto.randomUUID(), name: nome, type: tipo };
    d.organizations.push(o);
    registrarAuditoria(d, me, 'ORGANIZATION_CREATED', 'Organization', o.id, nome);
    return criado<Organization>({ ...o });
  }, A);

  // ---------- metas
  rota('GET', '/admin/goals', () => {
    const d = banco();
    return ok<Goal[]>([...d.goals].sort((a, b) => a.year - b.year).map((g) => dtoMeta(d, g)));
  }, A);

  rota('POST', '/admin/goals', ({ me, body }) => {
    const d = banco();
    const g: RegistroMeta = { id: crypto.randomUUID(), ...entradaMeta(body) };
    d.goals.push(g);
    registrarAuditoria(d, me, 'GOAL_CREATED', 'Goal', g.id, `${g.year} - ${g.title}`);
    return criado<Goal>(dtoMeta(d, g));
  }, A);

  rota('PUT', '/admin/goals/:id', ({ me, params, body }) => {
    const d = banco();
    const g = d.goals.find((x) => x.id === params.id);
    if (!g) throw falha.notFound('Meta não encontrada.');
    Object.assign(g, entradaMeta(body));
    registrarAuditoria(d, me, 'GOAL_UPDATED', 'Goal', g.id, `${g.year} - ${g.title}`);
    return ok<Goal>(dtoMeta(d, g));
  }, A);

  // ---------- coletas e rotas
  rota('GET', '/admin/collection-requests', ({ query }) => {
    const d = banco();
    const status = parametroEnum(query, 'status', STATUS_SOLICITACAO);
    return ok<CollectionRequest[]>(d.collectionRequests
      .filter((r) => !status || r.status === status)
      .map((r) => paraSolicitacaoColeta(d, r))
      .sort((a, b) => b.priority - a.priority || b.createdAt.localeCompare(a.createdAt)));
  }, A);

  rota('GET', '/admin/collectors', () =>
    ok<UserRef[]>(banco().users.filter((u) => u.enabled && (u.role === 'COLLECTOR' || u.role === 'ADMIN'))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')).map((u) => refUsuario(u)!)), A);

  rota('POST', '/admin/routes/optimize', ({ body }) => {
    const d = banco();
    const { depot: deposito, plan: plano } = corpoRota(d, body, false);
    return ok<RouteOptimization>({
      algorithm: ALGORITMO,
      routes: plano.trips.map((t) => ({
        stops: t.stops.map((s, i) => ({ requestId: s.id, sequence: i + 1, latitude: s.latitude, longitude: s.longitude, address: s.address, estimatedKg: s.kg })),
        distanceKm: t.distanceKm, naiveDistanceKm: t.naiveDistanceKm, estimatedMinutes: t.estimatedMinutes, loadKg: t.loadKg,
      })),
      totalDistanceKm: plano.totalDistanceKm,
      naiveTotalDistanceKm: plano.naiveTotalDistanceKm,
      savingsPercent: plano.savingsPercent,
      depot: deposito,
    });
  }, A);

  rota('POST', '/admin/routes', ({ me, body }) => {
    const d = banco();
    const { b, depot: deposito, plan: plano } = corpoRota(d, body, true);
    const v = new Validador();
    const nome = campoTexto(v, b, 'name', 3, 80, 'nome');
    const dataPlanejada = lerTexto(b.plannedDate) ?? '';
    if (v.check(DATA_RE.test(dataPlanejada), 'plannedDate', 'data inválida (AAAA-MM-DD)')) {
      v.check(dataPlanejada >= dataLocal(new Date()), 'plannedDate', 'a data não pode estar no passado');
    }
    const idColetor = b.collectorId ?? null;
    if (idColetor !== null && !d.users.some((u) => u.id === idColetor && u.enabled && (u.role === 'COLLECTOR' || u.role === 'ADMIN'))) {
      v.add('collectorId', 'coletor não encontrado');
    }
    v.throwIfAny();
    const quando = agoraIso();
    const rotasCriadas: RegistroRota[] = plano.trips.map((t, i) => {
      const registro: RegistroRota = {
        id: crypto.randomUUID(),
        name: plano.trips.length > 1 ? `${nome} (${i + 1}/${plano.trips.length})` : nome,
        status: 'PLANNED',
        collectorId: idColetor as string | null,
        plannedDate: dataPlanejada,
        totalDistanceKm: t.distanceKm,
        naiveDistanceKm: t.naiveDistanceKm,
        estimatedMinutes: t.estimatedMinutes,
        loadKg: t.loadKg,
        depot: deposito,
        stops: t.stops.map((s, k) => ({
          id: crypto.randomUUID(), sequence: k + 1, requestId: s.id, address: s.address, latitude: s.latitude, longitude: s.longitude,
          estimatedKg: s.kg, status: 'PENDING', completedAt: null, collectedKg: null,
        })),
        createdAt: quando,
      };
      for (const s of registro.stops) {
        const r = d.collectionRequests.find((x) => x.id === s.requestId)!;
        r.status = 'SCHEDULED';
        r.routeId = registro.id;
        r.scheduledFor = dataPlanejada;
        r.updatedAt = quando;
      }
      d.routes.push(registro);
      registrarAuditoria(d, me, 'ROUTE_CREATED', 'Route', registro.id, `${registro.name} — ${registro.stops.length} paradas, ${registro.totalDistanceKm} km`);
      return registro;
    });
    return criado<Route[]>(rotasCriadas.map((r) => paraRota(d, r)));
  }, A);

  rota('GET', '/admin/routes', () => {
    const d = banco();
    return ok<Route[]>([...d.routes].sort((a, b) => b.plannedDate.localeCompare(a.plannedDate) || b.createdAt.localeCompare(a.createdAt)).map((r) => paraRota(d, r)));
  }, A);

  // ---------- lixeiras, auditoria e relatório
  rota('GET', '/admin/bins', () => {
    const d = banco();
    return ok<SmartBin[]>([...d.bins].sort((a, b) => b.fillLevel - a.fillLevel).map((b) => paraLixeira(d, b, true)));
  }, A);

  rota('GET', '/admin/audit', ({ query }) => {
    const pagina = parametroInteiro(query, 'page', 0, 0, 10_000);
    const tamanho = parametroInteiro(query, 'size', 20, 1, 100);
    const acoes = query.getAll('action').flatMap((a) => a.split(',')).map((a) => a.trim()).filter(Boolean);
    const v = new Validador();
    v.check(acoes.length <= 50, 'action', 'no máximo 50 ações por filtro');
    v.check(acoes.every((a) => /^[A-Z][A-Z0-9_]{0,59}$/.test(a)), 'action', 'ação inválida');
    v.throwIfAny();
    const texto = (query.get('q') ?? '').trim().slice(0, 100).toLowerCase();
    const linhas = banco().audit.filter((e) => (!acoes.length || acoes.includes(e.action))
      && (!texto || [e.actor, e.details, e.entity, e.ip].some((x) => x?.toLowerCase().includes(texto))));
    const p = paginar(linhas, pagina, tamanho);
    return ok<Page<AuditEntry>>({ ...p, content: p.content.map((e) => ({ ...e })) });
  }, A);

  rota('GET', '/admin/reports/disposals.csv', ({ me, query }) => {
    const d = banco();
    const hoje = dataLocal(new Date());
    const desde = query.get('from') || somarDias(hoje, -30);
    const ate = query.get('to') || hoje;
    const v = new Validador();
    v.check(DATA_RE.test(desde), 'from', 'data inválida (AAAA-MM-DD)');
    v.check(DATA_RE.test(ate), 'to', 'data inválida (AAAA-MM-DD)');
    v.throwIfAny();
    if (desde > ate) throw falha.campo('from', 'a data inicial deve ser anterior à final');
    if (Date.parse(ate) - Date.parse(desde) > 366 * DIA) throw falha.campo('to', 'o período máximo é de 366 dias');
    const linhas = d.disposals
      .filter((x) => { const dia = dataLocal(x.disposedAt); return dia >= desde && dia <= ate; })
      .sort((a, b) => a.disposedAt.localeCompare(b.disposedAt));
    const formatoKg = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3, useGrouping: false });
    let csv = '﻿id;data;usuario;email;categoria;kg;status;pontos;risco_fraude;sinalizado;revisado_em;motivo_recusa\n';
    for (const x of linhas) {
      const u = d.users.find((k) => k.id === x.userId);
      const c = d.categories.find((k) => k.id === x.categoryId);
      csv += [
        x.id, formatarDataHora(x.disposedAt), u?.name ?? '', u?.email ?? '', c?.name ?? '', formatoKg.format(x.quantityKg), x.status,
        String(x.pointsAwarded), String(x.fraudScore), x.fraudScore >= LIMIAR_SINALIZACAO ? 'sim' : 'nao',
        x.reviewedAt ? formatarDataHora(x.reviewedAt) : '', x.rejectionReason ?? '',
      ].map(celulaCsv).join(';') + '\n';
    }
    registrarAuditoria(d, me, 'REPORT_EXPORTED', 'Report', 'disposals.csv', `${desde} a ${ate} (${linhas.length} linhas)`);
    return {
      status: 200,
      blob: new Blob([csv], { type: 'text/csv;charset=utf-8' }),
      headers: { 'Content-Disposition': `attachment; filename="descartes_${desde}_${ate}.csv"` },
    };
  }, A);
}
