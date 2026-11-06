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
  RegistroDesafio, RegistroEcoponto, RegistroSolicitacaoColeta, RegistroDescarte, RegistroMeta, RegistroResidencia, BancoSimulado, RegistroFoto, RegistroRota,
  RegistroLixeira, RegistroUsuario,
} from './db';
import { registrarAuditoria } from './logic/audit';
import { abrirSolicitacaoAutomatica } from './logic/bins';
import { DIA, HORA, somarDias, dataLocal } from './logic/dates';
import { DEPOSITO_PADRAO, distanciaHaversineKm, pontoDoBairro } from './logic/geo';
import { hashDemo } from './logic/password';
import { aprovarDescarte, debitar, avaliarMedalhas } from './logic/points';
import { criarGerador, codigoAleatorio, arredondar, type GeradorAleatorio } from './logic/random';
import { otimizar } from './logic/routes';
import {
  CATEGORIAS, ECOPONTOS, OBSERVACOES_DESCARTE, RESIDENCIAS, ORGANIZACOES, MOTIVOS_RECUSA, SENHA_MORADOR, RECOMPENSAS, RUAS,
} from './seedData';

const FAIXA_KG: Record<CategoryCode, [number, number]> = {
  PLASTICO: [0.3, 3], PAPEL: [0.5, 5], VIDRO: [0.5, 4], METAL: [0.2, 2], ORGANICO: [0.5, 6], ELETRONICO: [0.2, 3], REJEITO: [0.3, 3],
};
const PESOS_CATEGORIA: [CategoryCode, number][] = [
  ['PLASTICO', 28], ['PAPEL', 24], ['VIDRO', 12], ['METAL', 10], ['ORGANICO', 16], ['ELETRONICO', 3], ['REJEITO', 7],
];

function fotoProvisoria(c: Category): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480" viewBox="0 0 640 480">`
    + `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c.color}" stop-opacity=".9"/>`
    + `<stop offset="1" stop-color="#0b3d2e"/></linearGradient></defs><rect width="640" height="480" fill="url(#g)"/>`
    + `<circle cx="320" cy="200" r="90" fill="#fff" fill-opacity=".18"/>`
    + `<text x="320" y="215" font-family="sans-serif" font-size="44" font-weight="700" fill="#fff" text-anchor="middle">${c.name}</text>`
    + `<text x="320" y="400" font-family="sans-serif" font-size="22" fill="#fff" fill-opacity=".8" text-anchor="middle">Foto ilustrativa — modo demonstração</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function espalhar(gerador: GeradorAleatorio, p: GeoPoint, valor = 0.004): GeoPoint {
  return { latitude: arredondar(p.latitude + (gerador.next() - 0.5) * valor, 6), longitude: arredondar(p.longitude + (gerador.next() - 0.5) * valor, 6) };
}

export function semearBanco(versao: number, dataAgora: Date): BancoSimulado {
  const gerador = criarGerador(20502026);
  const agora = dataAgora.getTime();
  const iso = (t: number) => new Date(t).toISOString();
  const hoje = dataLocal(dataAgora);
  const inicioMes = `${hoje.slice(0, 8)}01`;
  const proximoMes = new Date(Date.UTC(Number(hoje.slice(0, 4)), Number(hoje.slice(5, 7)), 1));
  const fimMes = somarDias(proximoMes.toISOString().slice(0, 10), -1);

  const d: BancoSimulado = {
    version: versao, seededAt: iso(agora), users: [], organizations: [], categories: [], disposals: [], photos: [], transactions: [],
    userBadges: [], challenges: [], completions: [], rewards: [], redemptions: [], collectionPoints: [], collectionRequests: [],
    routes: [], households: [], bins: [], goals: [], audit: [], idempotency: {},
  };

  // ---------------------------------------------------------------- referência
  d.categories = CATEGORIAS.map((c) => ({ id: gerador.uuid(), ...c, guidance: [...c.guidance], active: true }));
  const cat = (codigo: CategoryCode) => d.categories.find((c) => c.code === codigo)!;
  const orgPorChave = new Map<string, Organization>();
  for (const o of ORGANIZACOES) {
    const organizacao: Organization = { id: gerador.uuid(), name: o.name, type: o.type };
    d.organizations.push(organizacao);
    orgPorChave.set(o.key, organizacao);
  }
  d.collectionPoints = ECOPONTOS.map((p): RegistroEcoponto => ({ id: gerador.uuid(), ...p, categories: [...p.categories], active: true }));
  d.rewards = RECOMPENSAS.map((r) => ({ id: gerador.uuid(), ...r, active: true }));
  const fotosSemente = new Map<CategoryCode, RegistroFoto>();
  for (const c of d.categories) {
    const p: RegistroFoto = { id: gerador.uuid(), ownerId: null, dataUrl: fotoProvisoria(c), mime: 'image/svg+xml', width: 640, height: 480, hash: null, createdAt: iso(agora - 400 * DIA) };
    d.photos.push(p);
    fotosSemente.set(c.code, p);
  }

  // ---------------------------------------------------------------- usuários
  const criarUsuario = (nome: string, email: string, senha: string, papel: RegistroUsuario['role'], criadoHaDias: number, extra: Partial<RegistroUsuario> = {}): RegistroUsuario => {
    const u: RegistroUsuario = {
      id: gerador.uuid(), name: nome, email, passwordHash: hashDemo(senha, codigoAleatorio(8, gerador.next)), role: papel, enabled: true, failedLogins: 0,
      lockedUntil: null, householdId: null, organizationId: null, points: 0, totalEarned: 0, sessionEpoch: 0,
      createdAt: iso(agora - criadoHaDias * DIA - gerador.int(0, 20) * HORA), lastLoginAt: iso(agora - gerador.int(1, 72) * HORA), ...extra,
    };
    d.users.push(u);
    return u;
  };
  const admin = criarUsuario('Ana Ribeiro', 'admin@ecotechzero.com.br', 'EcoTech@2050', 'ADMIN', 400);
  const coletor = criarUsuario('Carlos Henrique Lima', 'coletor@ecotechzero.com.br', 'Coleta@2050', 'COLLECTOR', 390);
  const coletor2 = criarUsuario('Juliana Matos', 'juliana.matos@ecotechzero.com.br', SENHA_MORADOR, 'COLLECTOR', 200);
  const morador = criarUsuario('Mariana Alves', 'morador@ecotechzero.com.br', 'Recicla@2050', 'USER', 370, { organizationId: orgPorChave.get('CC4')!.id });

  const atividade = new Map<string, number>([[morador.id, 1.6]]);
  for (const hs of RESIDENCIAS) {
    const base = pontoDoBairro(hs.neighborhood);
    const loc = espalhar(gerador, base, 0.006);
    const membros = hs.members.map((m) => {
      const u = criarUsuario(m.name, m.email, SENHA_MORADOR, 'USER', m.joinedDaysAgo, { organizationId: m.org ? orgPorChave.get(m.org)!.id : null });
      atividade.set(u.id, m.activity);
      return u;
    });
    if (hs.key === 'MARIANA') membros.unshift(morador);
    const h: RegistroResidencia = {
      id: gerador.uuid(), name: hs.name, neighborhood: hs.neighborhood, city: hs.neighborhood === 'Vila Sônia' ? 'São Paulo' : 'Taboão da Serra',
      inviteCode: codigoAleatorio(8, gerador.next), ownerId: membros[0].id, address: hs.address, latitude: loc.latitude, longitude: loc.longitude,
      createdAt: membros[0].createdAt,
    };
    d.households.push(h);
    membros.forEach((u) => { u.householdId = h.id; });
  }
  // um morador desativado e um sem residência, para a tela de usuários
  const sozinho = criarUsuario('Diego Almeida', 'diego.almeida@exemplo.com.br', SENHA_MORADOR, 'USER', 60);
  atividade.set(sozinho.id, 0.5);
  criarUsuario('Conta Suspensa (teste)', 'suspensa@exemplo.com.br', SENHA_MORADOR, 'USER', 90, { enabled: false, lastLoginAt: iso(agora - 40 * DIA) });

  const residenciaDe = (u: RegistroUsuario) => d.households.find((h) => h.id === u.householdId) ?? null;

  // ---------------------------------------------------------------- desafios e metas
  const ch = (c: Omit<RegistroDesafio, 'id'>): RegistroDesafio => { const r = { id: gerador.uuid(), ...c }; d.challenges.push(r); return r; };
  const nomeMes = new Intl.DateTimeFormat('pt-BR', { month: 'long', timeZone: 'America/Sao_Paulo' }).format(dataAgora);
  ch({ title: `Plástico em dia (${nomeMes})`, description: 'Recicle 8 kg de plástico neste mês.', categoryCode: 'PLASTICO', metric: 'KG', target: 8, bonusPoints: 80, startsAt: inicioMes, endsAt: fimMes, active: true });
  ch({ title: '10 descartes no mês', description: 'Registre 10 descartes aprovados neste mês.', categoryCode: null, metric: 'COUNT', target: 10, bonusPoints: 100, startsAt: inicioMes, endsAt: fimMes, active: true });
  ch({ title: 'Semana do vidro', description: 'Leve 3 kg de vidro a um ecoponto nesta semana.', categoryCode: 'VIDRO', metric: 'KG', target: 3, bonusPoints: 40, startsAt: somarDias(hoje, -3), endsAt: somarDias(hoje, 4), active: true });
  ch({ title: 'E-lixo zero', description: 'Descarte corretamente 2 kg de eletrônicos, pilhas ou cabos.', categoryCode: 'ELETRONICO', metric: 'KG', target: 2, bonusPoints: 120, startsAt: somarDias(hoje, -20), endsAt: somarDias(hoje, 40), active: true });
  ch({ title: 'Compostagem em casa', description: 'Composte 10 kg de orgânicos.', categoryCode: 'ORGANICO', metric: 'KG', target: 10, bonusPoints: 90, startsAt: somarDias(inicioMes, -31).slice(0, 8) + '01', endsAt: somarDias(inicioMes, -1), active: true });
  ch({ title: 'Maratona da reciclagem', description: '25 descartes aprovados em dois meses.', categoryCode: null, metric: 'COUNT', target: 25, bonusPoints: 200, startsAt: somarDias(hoje, -110), endsAt: somarDias(hoje, -50), active: true });
  ch({ title: 'Natal sem desperdício', description: 'Recicle 15 kg de papel e papelão das embalagens de fim de ano.', categoryCode: 'PAPEL', metric: 'KG', target: 15, bonusPoints: 150, startsAt: `${hoje.slice(0, 4)}-12-01`, endsAt: `${hoje.slice(0, 4)}-12-31`, active: true });

  const ano = Number(hoje.slice(0, 4));
  const metas: Omit<RegistroMeta, 'id'>[] = [
    { year: ano, title: `Meta ${ano} — Taboão Recicla`, targetRecyclingRate: 0.85, targetKg: 4500 },
    { year: 2030, title: 'Meta 2030 — metade do caminho', targetRecyclingRate: 0.9, targetKg: 12000 },
    { year: 2050, title: 'Lixo Zero 2050', targetRecyclingRate: 0.98, targetKg: 30000 },
  ];
  d.goals = metas.map((g) => ({ id: gerador.uuid(), ...g }));

  // ---------------------------------------------------------------- descartes (12 meses)
  const moradores = d.users.filter((u) => u.role === 'USER' && u.enabled);
  const statusFinal = new Map<string, 'APPROVED' | 'REJECTED' | 'PENDING'>();
  for (const u of moradores) {
    const a = atividade.get(u.id) ?? 0.8;
    const inicio = Math.max(Date.parse(u.createdAt), agora - 365 * DIA);
    const primeiroDia = Math.ceil((agora - inicio) / DIA);
    const h = residenciaDe(u);
    const casa = h ? { latitude: h.latitude, longitude: h.longitude } : pontoDoBairro('Centro');
    for (let diasAtras = primeiroDia; diasAtras >= 0; diasAtras--) {
      const crescimento = 0.45 + 0.55 * (1 - diasAtras / 365); // programa cresce ao longo do ano
      let chance = a * 0.2 * crescimento;
      // a moradora de demonstração mantém uma sequência nos últimos dias
      const forcado = u.id === morador.id && diasAtras <= 8 && diasAtras !== 0;
      if (u.id === morador.id) chance = 0.34;
      if (!forcado && !gerador.chance(chance)) continue;
      const codigo = forcado && diasAtras % 3 === 0 ? 'VIDRO' : gerador.weighted(PESOS_CATEGORIA);
      const c = cat(codigo);
      const [lo, hi] = FAIXA_KG[codigo];
      const kg = gerador.float(lo, hi, 2);
      const t = agora - diasAtras * DIA - gerador.int(0, 13) * HORA - gerador.int(0, 59) * 60_000 - (diasAtras === 0 ? 2 * HORA : 0);
      const descartadoEm = Math.min(t, agora - 30 * 60_000);
      const criadoEm = descartadoEm + gerador.int(1, 40) * 60_000;
      const temFoto = gerador.chance(0.7);
      const iaOk = temFoto && gerador.chance(0.85);
      const usarEcoponto = gerador.chance(0.55);
      const ecopontos = d.collectionPoints.filter((p) => p.categories.includes(codigo));
      const cp = usarEcoponto && ecopontos.length
        ? [...ecopontos].sort((x, y) => distanciaHaversineKm(casa, x) - distanciaHaversineKm(casa, y))[gerador.int(0, Math.min(2, ecopontos.length - 1))]
        : null;
      const loc = cp ? espalhar(gerador, cp, 0.0008) : espalhar(gerador, casa, 0.0015);
      const outroCodigo = gerador.pick(CATEGORIAS.filter((k) => k.code !== codigo)).code;
      const registro: RegistroDescarte = {
        id: gerador.uuid(), userId: u.id, categoryId: c.id, quantityKg: kg, status: 'PENDING', pointsAwarded: 0,
        photoId: temFoto ? fotosSemente.get(codigo)!.id : null, latitude: loc.latitude, longitude: loc.longitude,
        collectionPointId: cp?.id ?? null, disposedAt: iso(descartadoEm), createdAt: iso(criadoEm), reviewedAt: null,
        rejectionReason: null, notes: gerador.pick(OBSERVACOES_DESCARTE), aiSuggestedCode: temFoto ? (iaOk ? codigo : outroCodigo) : null,
        aiConfidence: temFoto ? gerador.float(iaOk ? 0.62 : 0.4, iaOk ? 0.97 : 0.68, 2) : null, aiSource: temFoto ? 'LOCAL' : 'MANUAL',
        fraudScore: gerador.chance(0.15) ? gerador.int(5, 25) : 0, fraudFlags: [], idempotencyKey: null,
      };
      if (registro.fraudScore > 0) registro.fraudFlags = ['Quantidade acima da média da categoria.'];
      const idadeDias = (agora - criadoEm) / DIA;
      let status: 'APPROVED' | 'REJECTED' | 'PENDING';
      if (forcado) status = 'APPROVED';
      else if (idadeDias <= 2) status = gerador.weighted([['PENDING', 55], ['APPROVED', 40], ['REJECTED', 5]] as const);
      else if (idadeDias <= 7) status = gerador.weighted([['PENDING', 18], ['APPROVED', 75], ['REJECTED', 7]] as const);
      else status = gerador.weighted([['APPROVED', 93], ['REJECTED', 7]] as const);
      const revisadoEm = criadoEm + (forcado ? HORA : gerador.int(2, 30) * HORA);
      if (status !== 'PENDING' && revisadoEm > agora) status = 'PENDING';
      if (status === 'REJECTED') {
        registro.status = 'REJECTED';
        registro.reviewedAt = iso(revisadoEm);
        registro.rejectionReason = gerador.pick(MOTIVOS_RECUSA);
      } else if (status === 'APPROVED') {
        registro.reviewedAt = iso(Math.min(revisadoEm, agora - 5 * 60_000)); // aprovado na reprodução abaixo
      }
      statusFinal.set(registro.id, status);
      d.disposals.push(registro);
    }
  }

  // descartes suspeitos (pendentes e sinalizados) para a fila do admin
  const suspeitos: [number, string[], number][] = [
    [72, ['Descarte acima de 5 kg sem foto de comprovação.', 'Total de 46,0 kg no mesmo dia (limite de referência: 40 kg).'], 18.5],
    [58, ['Foto muito parecida com uma enviada por outro usuário.', 'A IA sugeriu REJEITO com 81% de confiança, mas foi informado PLASTICO.'], 4.2],
    [45, ['6 descartes registrados em menos de 1 hora.'], 2.1],
    [64, ['Localização muito distante do descarte anterior em poucos minutos.', 'Descarte acima de 5 kg sem foto de comprovação.'], 12],
    [41, ['Quantidade muito acima do seu histórico (mediana 1,2 kg).'], 9.8],
    [85, ['A mesma foto já foi enviada anteriormente.', 'Foto muito parecida com outra que você já enviou.', '7 descartes registrados em menos de 1 hora.'], 6.5],
  ];
  const sinalizaveis = moradores.filter((u) => u.id !== morador.id);
  suspeitos.forEach(([pontuacao, sinais, kg], i) => {
    const u = sinalizaveis[(i * 5 + 3) % sinalizaveis.length];
    const codigo: CategoryCode = i === 1 ? 'PLASTICO' : i === 3 ? 'METAL' : gerador.pick(['PAPEL', 'PLASTICO', 'VIDRO'] as const);
    const c = cat(codigo);
    const t = agora - gerador.int(2, 40) * HORA;
    const semFoto = sinais.some((f) => f.includes('sem foto'));
    const h = residenciaDe(u);
    d.disposals.push({
      id: gerador.uuid(), userId: u.id, categoryId: c.id, quantityKg: Math.min(kg, c.maxKgPerDisposal), status: 'PENDING', pointsAwarded: 0,
      photoId: semFoto ? null : fotosSemente.get(codigo)!.id, latitude: h?.latitude ?? null, longitude: h?.longitude ?? null,
      collectionPointId: null, disposedAt: iso(t), createdAt: iso(t + 5 * 60_000), reviewedAt: null, rejectionReason: null,
      notes: null, aiSuggestedCode: semFoto ? null : i === 1 ? 'REJEITO' : codigo, aiConfidence: semFoto ? null : 0.81,
      aiSource: semFoto ? 'MANUAL' : 'LOCAL', fraudScore: pontuacao, fraudFlags: sinais, idempotencyKey: null,
    });
  });
  // dois recusados por fraude
  for (let i = 0; i < 2; i++) {
    const u = sinalizaveis[(i * 7 + 1) % sinalizaveis.length];
    const c = cat('METAL');
    const t = agora - (10 + i * 9) * DIA;
    d.disposals.push({
      id: gerador.uuid(), userId: u.id, categoryId: c.id, quantityKg: 15, status: 'REJECTED', pointsAwarded: 0, photoId: fotosSemente.get('METAL')!.id,
      latitude: null, longitude: null, collectionPointId: null, disposedAt: iso(t), createdAt: iso(t + 60_000), reviewedAt: iso(t + 6 * HORA),
      rejectionReason: 'Descarte duplicado (mesma foto de outro registro).', notes: null, aiSuggestedCode: 'METAL', aiConfidence: 0.9,
      aiSource: 'LOCAL', fraudScore: 70, fraudFlags: ['A mesma foto já foi enviada anteriormente.', 'Quantidade muito acima do seu histórico (mediana 0,8 kg).'], idempotencyKey: null,
    });
  }

  // ---------------------------------------------------------------- reprodução cronológica (pontos, desafios, medalhas, resgates)
  type Evento = { at: number; kind: 'approve'; disposal: RegistroDescarte } | { at: number; kind: 'redeem'; userId: string; rewardName: string };
  const eventos: Evento[] = d.disposals
    .filter((x) => statusFinal.get(x.id) === 'APPROVED')
    .map((x) => ({ at: Date.parse(x.reviewedAt!), kind: 'approve' as const, disposal: x }));
  eventos.push({ at: agora - 62 * DIA, kind: 'redeem', userId: morador.id, rewardName: 'Café na cantina' });
  eventos.push({ at: agora - 21 * DIA, kind: 'redeem', userId: morador.id, rewardName: 'Muda de árvore nativa' });
  for (const u of moradores) {
    if (u.id === morador.id) continue;
    const n = gerador.int(0, 3);
    for (let i = 0; i < n; i++) eventos.push({ at: agora - gerador.int(3, 300) * DIA, kind: 'redeem', userId: u.id, rewardName: gerador.pick(RECOMPENSAS.slice(0, 7)).name });
  }
  eventos.sort((a, b) => a.at - b.at);
  for (const ev of eventos) {
    const quando = iso(ev.at);
    if (ev.kind === 'approve') {
      ev.disposal.status = 'PENDING';
      aprovarDescarte(d, ev.disposal, quando);
      if (agora - ev.at < 20 * DIA) registrarAuditoria(d, admin, 'DISPOSAL_APPROVED', 'Disposal', ev.disposal.id, `+${ev.disposal.pointsAwarded} pontos`, quando);
    } else {
      const recompensa = d.rewards.find((r) => r.name === ev.rewardName)!;
      const usuario = d.users.find((u) => u.id === ev.userId)!;
      if (usuario.points < recompensa.costPoints || Date.parse(usuario.createdAt) > ev.at) continue;
      debitar(d, usuario.id, recompensa.costPoints, `Resgate: ${recompensa.name}`, quando);
      recompensa.stock = Math.max(0, recompensa.stock - 1);
      d.redemptions.push({
        id: gerador.uuid(), userId: usuario.id, rewardId: recompensa.id, cost: recompensa.costPoints, code: `LZ-${codigoAleatorio(4, gerador.next)}-${codigoAleatorio(4, gerador.next)}`,
        status: agora - ev.at > 30 * DIA ? gerador.weighted([['USED', 8], ['ISSUED', 2]] as const) : 'ISSUED', createdAt: quando,
      });
      registrarAuditoria(d, usuario, 'REWARD_REDEEMED', 'Reward', recompensa.id, `${recompensa.name} (-${recompensa.costPoints} pontos)`, quando);
    }
  }
  for (const x of d.disposals) if (x.status === 'REJECTED' && agora - Date.parse(x.reviewedAt!) < 20 * DIA) {
    registrarAuditoria(d, admin, 'DISPOSAL_REJECTED', 'Disposal', x.id, x.rejectionReason, x.reviewedAt!);
  }

  // ---------------------------------------------------------------- lixeiras inteligentes
  const criarLixeira = (h: RegistroResidencia, nome: string, codigo: CategoryCode, capacidade: number, limite: number, nivelAtual: number, taxa: number, bateria: number, ultimaHaMin: number): RegistroLixeira => {
    const ultimaEm = agora - ultimaHaMin * 60_000;
    const leituras = [];
    for (let i = 47; i >= 0; i--) {
      const t = ultimaEm - i * 30 * 60_000;
      const horasAtras = (ultimaEm - t) / HORA;
      let f = nivelAtual - Math.max(taxa, 0.8) * horasAtras;
      if (f < 0) f += 82; // antes da última coleta a lixeira estava cheia (dente de serra)
      leituras.push({ fillLevel: Math.round(Math.max(0, Math.min(100, f))), batteryLevel: Math.round(bateria + i * 0.04), at: iso(t) });
    }
    const b: RegistroLixeira = {
      id: gerador.uuid(), householdId: h.id, categoryId: cat(codigo).id, name: nome, capacityLiters: capacidade, autoRequestThreshold: limite,
      deviceId: gerador.uuid(), deviceKey: codigoAleatorio(32, gerador.next), fillLevel: nivelAtual, batteryLevel: bateria, lastReadingAt: iso(ultimaEm),
      fillRatePerHour: taxa, readings: leituras, createdAt: iso(agora - gerador.int(60, 200) * DIA),
    };
    d.bins.push(b);
    return b;
  };
  const residenciaPorChave = (chave: string) => d.households.find((h) => h.name === RESIDENCIAS.find((x) => x.key === chave)!.name)!;
  const casaMariana = residenciaPorChave('MARIANA');
  criarLixeira(casaMariana, 'Recicláveis da cozinha', 'PLASTICO', 50, 80, 38, 1.4, 86, 12);
  criarLixeira(casaMariana, 'Papel do escritório', 'PAPEL', 30, 85, 64, 0.9, 71, 7);
  const composteira = criarLixeira(casaMariana, 'Composteira', 'ORGANICO', 20, 75, 72, 2.2, 93, 21);
  criarLixeira(residenciaPorChave('SOUZA'), 'Lixeira reciclável', 'PLASTICO', 60, 80, 86, 1.1, 64, 4);
  criarLixeira(residenciaPorChave('REPUBLICA'), 'Vidros da república', 'VIDRO', 40, 70, 55, 0.7, 77, 16);
  criarLixeira(residenciaPorChave('REPUBLICA'), 'Orgânicos', 'ORGANICO', 30, 80, 92, 1.8, 58, 9);
  criarLixeira(residenciaPorChave('NAKAMURA'), 'Papel e papelão', 'PAPEL', 80, 85, 40, 0.6, 12, 25);
  criarLixeira(residenciaPorChave('OLIVEIRA'), 'Lixeira da garagem', 'METAL', 40, 80, 47, 0, 34, 9 * 60); // sem sinal há 9 h → OFFLINE
  // coleta anterior da composteira (já realizada)
  const composteiraEsvaziadaEm = agora - Math.round(((72 / 2.2) + 0.5) * HORA);
  d.collectionRequests.push({
    id: gerador.uuid(), address: casaMariana.address!, latitude: casaMariana.latitude, longitude: casaMariana.longitude, categoryCodes: ['ORGANICO'], estimatedKg: 6.8,
    status: 'COLLECTED', source: 'SMART_BIN', preferredDate: null, scheduledFor: dataLocal(new Date(composteiraEsvaziadaEm)), routeId: null,
    notes: 'Solicitação automática: a lixeira "Composteira" atingiu 78%.', createdAt: iso(composteiraEsvaziadaEm - 20 * HORA),
    updatedAt: iso(composteiraEsvaziadaEm), requesterId: casaMariana.ownerId, smartBinId: composteira.id,
  });
  // lixeiras acima do limite abrem solicitação automática
  for (const b of d.bins) if (b.fillLevel >= b.autoRequestThreshold) abrirSolicitacaoAutomatica(d, b, iso(agora - gerador.int(30, 300) * 60_000));
  for (const u of moradores) if (u.householdId) avaliarMedalhas(d, u.id, iso(agora - HORA));

  // ---------------------------------------------------------------- solicitações de coleta e rotas
  const criarSolicitacao = (u: RegistroUsuario, codigos: CategoryCode[], kg: number, status: RegistroSolicitacaoColeta['status'], criadoHaHoras: number, extra: Partial<RegistroSolicitacaoColeta> = {}): RegistroSolicitacaoColeta => {
    const h = residenciaDe(u);
    const bairro = h?.neighborhood ?? 'Centro';
    const rua = gerador.pick(RUAS[bairro] ?? RUAS['Centro']);
    const p = espalhar(gerador, h ? { latitude: h.latitude, longitude: h.longitude } : pontoDoBairro(bairro), 0.01);
    const r: RegistroSolicitacaoColeta = {
      id: gerador.uuid(), address: `${rua}, ${gerador.int(20, 1800)} – ${bairro}, ${h?.city ?? 'Taboão da Serra'}`, latitude: p.latitude, longitude: p.longitude,
      categoryCodes: codigos, estimatedKg: kg, status, source: 'USER', preferredDate: null, scheduledFor: null, routeId: null,
      notes: gerador.pick([null, 'Deixar na portaria.', 'Material separado em sacos.', 'Tocar o interfone 12.', 'Móveis de escritório antigos e caixas.']),
      createdAt: iso(agora - criadoHaHoras * HORA), updatedAt: iso(agora - Math.max(0, criadoHaHoras - 3) * HORA), requesterId: u.id, smartBinId: null, ...extra,
    };
    d.collectionRequests.push(r);
    return r;
  };
  const escolherMorador = (i: number) => sinalizaveis[(i * 3 + 2) % sinalizaveis.length];
  const misturas: CategoryCode[][] = [['PAPEL', 'PLASTICO'], ['VIDRO'], ['ELETRONICO'], ['PLASTICO', 'METAL'], ['PAPEL'], ['ORGANICO'], ['PLASTICO', 'PAPEL', 'VIDRO']];
  // abertas, para o admin otimizar
  for (let i = 0; i < 7; i++) {
    criarSolicitacao(escolherMorador(i), misturas[i % misturas.length], gerador.float(4, 60, 1), 'REQUESTED', gerador.int(3, 90), {
      preferredDate: gerador.chance(0.5) ? somarDias(hoje, gerador.int(0, 5)) : null,
    });
  }
  // da moradora de demonstração
  criarSolicitacao(morador, ['ELETRONICO'], 3.5, 'REQUESTED', 26, { notes: 'Monitor antigo e cabos.', preferredDate: somarDias(hoje, 2), address: 'Rua Cesário Dau, 610 – Jardim Maria Rosa, Taboão da Serra', latitude: casaMariana.latitude, longitude: casaMariana.longitude });
  criarSolicitacao(morador, ['PAPEL', 'PLASTICO'], 12, 'COLLECTED', 40 * 24, { address: 'Rua Cesário Dau, 610 – Jardim Maria Rosa, Taboão da Serra', latitude: casaMariana.latitude, longitude: casaMariana.longitude });
  criarSolicitacao(escolherMorador(9), ['VIDRO'], 8, 'CANCELLED', 15 * 24, { notes: 'Consegui levar ao ecoponto.' });

  const criarRota = (nome: string, usuarioColetor: RegistroUsuario, dataPlanejada: string, solicitacoes: RegistroSolicitacaoColeta[], status: RegistroRota['status'], qtdConcluidas: number) => {
    const plano = otimizar(DEPOSITO_PADRAO, solicitacoes.map((r) => ({ id: r.id, latitude: r.latitude, longitude: r.longitude, kg: r.estimatedKg, address: r.address })), 1000);
    const viagem = plano.trips[0];
    const idRota = gerador.uuid();
    const planejadaEm = Date.parse(`${dataPlanejada}T11:00:00Z`);
    const registro: RegistroRota = {
      id: idRota, name: nome, status, collectorId: usuarioColetor.id, plannedDate: dataPlanejada, totalDistanceKm: viagem.distanceKm, naiveDistanceKm: viagem.naiveDistanceKm,
      estimatedMinutes: viagem.estimatedMinutes, loadKg: viagem.loadKg, depot: { ...DEPOSITO_PADRAO },
      stops: viagem.stops.map((s, i) => {
        const concluida = i < qtdConcluidas;
        const concluidaEm = Math.min(agora - (qtdConcluidas - i) * 25 * 60_000, planejadaEm + (i + 1) * 30 * 60_000);
        return {
          id: gerador.uuid(), sequence: i + 1, requestId: s.id, address: s.address, latitude: s.latitude, longitude: s.longitude, estimatedKg: s.kg,
          status: concluida ? 'DONE' as const : 'PENDING' as const, completedAt: concluida ? iso(concluidaEm) : null, collectedKg: concluida ? arredondar(s.kg * gerador.float(0.8, 1.15)) : null,
        };
      }),
      createdAt: iso(Math.min(agora - 3 * HORA, planejadaEm - DIA)),
    };
    registro.stops.forEach((s) => {
      const r = solicitacoes.find((x) => x.id === s.requestId)!;
      r.routeId = idRota;
      r.scheduledFor = dataPlanejada;
      r.status = s.status === 'DONE' ? 'COLLECTED' : status === 'IN_PROGRESS' ? 'IN_ROUTE' : 'SCHEDULED';
    });
    d.routes.push(registro);
    registrarAuditoria(d, admin, 'ROUTE_CREATED', 'Route', registro.id, `${registro.name} — ${registro.stops.length} paradas, ${registro.totalDistanceKm} km`, registro.createdAt);
    return registro;
  };
  const lote = (n: number, deslocamento: number, idadeH: number) => Array.from({ length: n }, (_, i) =>
    criarSolicitacao(escolherMorador(deslocamento + i), misturas[(deslocamento + i) % misturas.length], gerador.float(5, 80, 1), 'SCHEDULED', idadeH + i * 3));
  criarRota('Rota Jardim Maria Rosa – manhã', coletor, hoje, lote(5, 11, 30), 'IN_PROGRESS', 2);
  criarRota('Rota Vila Sônia / Parque Pinheiros', coletor, somarDias(hoje, 1), lote(4, 17, 20), 'PLANNED', 0);
  criarRota('Rota Centro – recicláveis', coletor, somarDias(hoje, -8), lote(4, 22, 8 * 24 + 30), 'DONE', 4);
  criarRota('Rota Jardim Record – volumosos', coletor, somarDias(hoje, -15), lote(5, 27, 15 * 24 + 30), 'DONE', 5);
  criarRota('Rota Jardim Mituzi', coletor2, somarDias(hoje, -4), lote(3, 33, 4 * 24 + 20), 'DONE', 3);

  // ---------------------------------------------------------------- auditoria de acesso
  for (const u of [admin, coletor, morador, ...moradores.slice(0, 12)]) {
    registrarAuditoria(d, u, 'LOGIN_SUCCESS', 'User', u.id, null, u.lastLoginAt!, `177.${gerador.int(10, 220)}.${gerador.int(0, 255)}.${gerador.int(1, 254)}`);
  }
  for (const u of moradores.filter((x) => agora - Date.parse(x.createdAt) < 40 * DIA)) {
    registrarAuditoria(d, u, 'USER_REGISTERED', 'User', u.id, null, u.createdAt);
  }
  registrarAuditoria(d, 'tentativa@exemplo.com', 'LOGIN_FAILED', 'User', null, 'e-mail não cadastrado', iso(agora - 5 * HORA), '189.40.12.7');
  registrarAuditoria(d, admin, 'REPORT_EXPORTED', 'Report', 'disposals.csv', `${somarDias(hoje, -30)} a ${hoje}`, iso(agora - 2 * DIA));
  registrarAuditoria(d, admin, 'REWARD_UPDATED', 'Reward', d.rewards[7].id, d.rewards[7].name, iso(agora - 3 * DIA));

  return d;
}
