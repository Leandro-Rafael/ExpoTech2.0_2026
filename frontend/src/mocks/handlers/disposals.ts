/** /api/disposals — registro (com Idempotency-Key e antifraude) e histórico do usuário. */
import type { AiSource, CategoryCode, Disposal, DisposalStatus, Page } from '@/api/types';
import { banco, agoraIso, type RegistroDescarte } from '../db';
import { paginar, paraDescarte } from '../dto';
import { UUID_RE, Validador, objetoDoCorpo, criado, parametroEnum, falha, parametroInteiro, lerNumero, ok, lerTexto } from '../http';
import { registrarAuditoria } from '../logic/audit';
import { DIA } from '../logic/dates';
import { LIMIAR_SINALIZACAO, avaliar } from '../logic/fraud';
import { aprovarDescarte } from '../logic/points';
import { arredondar } from '../logic/random';
import { rota } from '../server';

export const CODIGOS_CATEGORIA: CategoryCode[] = ['PLASTICO', 'PAPEL', 'VIDRO', 'METAL', 'ORGANICO', 'ELETRONICO', 'REJEITO'];
const FONTES_IA: AiSource[] = ['CLAUDE', 'LOCAL', 'MANUAL'];
export const STATUS_DESCARTE: DisposalStatus[] = ['PENDING', 'APPROVED', 'REJECTED'];
const AUTOAPROVAR_RISCO_MAX = 20;
const AUTOAPROVAR_KG_MAX = 5;

export function registrarRotasDescarte() {
  rota('POST', '/disposals', ({ me, body, headers }) => {
    const d = banco();
    const chave = headers.get('Idempotency-Key');
    if (chave !== null && !/^[A-Za-z0-9_-]{8,64}$/.test(chave)) {
      throw falha.campo('Idempotency-Key', 'use de 8 a 64 caracteres (letras, números, - ou _)');
    }
    if (chave) {
      const idExistente = d.idempotency[`${me.id}:${chave}`];
      const existente = idExistente && d.disposals.find((x) => x.id === idExistente);
      if (existente) return criado<Disposal>(paraDescarte(d, existente)); // clique duplo: devolve o mesmo descarte
    }

    const b = objetoDoCorpo(body);
    const v = new Validador();
    const idCategoria = lerTexto(b.categoryId);
    const categoria = idCategoria ? d.categories.find((c) => c.id === idCategoria && c.active) : undefined;
    if (!idCategoria) v.add('categoryId', 'informe a categoria');
    else if (!categoria) v.add('categoryId', 'categoria não encontrada');

    const kgBruto = lerNumero(b.quantityKg);
    if (kgBruto === null) v.add('quantityKg', 'deve ser um número');
    else if (kgBruto < 0.01) v.add('quantityKg', 'a quantidade mínima é 0,01 kg');
    else if (categoria && kgBruto > categoria.maxKgPerDisposal) {
      v.add('quantityKg', `máximo de ${categoria.maxKgPerDisposal} kg por descarte de ${categoria.name}`);
    }

    const lat = b.latitude ?? null;
    const lon = b.longitude ?? null;
    if ((lat === null) !== (lon === null)) v.add('latitude', 'informe latitude e longitude juntas');
    else if (lat !== null) {
      v.check(typeof lat === 'number' && lat >= -90 && lat <= 90, 'latitude', 'latitude inválida');
      v.check(typeof lon === 'number' && lon >= -180 && lon <= 180, 'longitude', 'longitude inválida');
    }

    const agora = Date.now();
    let descartadoEm = new Date(agora).toISOString();
    if (b.disposedAt !== undefined && b.disposedAt !== null) {
      const t = typeof b.disposedAt === 'string' ? Date.parse(b.disposedAt) : NaN;
      if (Number.isNaN(t)) v.add('disposedAt', 'data inválida');
      else if (t > agora + 5 * 60_000) v.add('disposedAt', 'a data do descarte não pode ser no futuro');
      else if (t < agora - 7 * DIA) v.add('disposedAt', 'só é possível registrar descartes dos últimos 7 dias');
      else descartadoEm = new Date(t).toISOString();
    }

    const idFoto = b.photoId ?? null;
    const foto = typeof idFoto === 'string' ? d.photos.find((p) => p.id === idFoto && p.ownerId === me.id) ?? null : null;
    if (idFoto !== null) {
      if (!foto) throw falha.notFound('Foto não encontrada.'); // de outro usuário ou inexistente (como no back-end)
      else if (d.disposals.some((x) => x.photoId === foto.id)) v.add('photoId', 'esta foto já foi usada em outro descarte');
    }

    const idEcoponto = b.collectionPointId ?? null;
    if (idEcoponto !== null) {
      const cp = typeof idEcoponto === 'string' && UUID_RE.test(idEcoponto) ? d.collectionPoints.find((p) => p.id === idEcoponto && p.active) : undefined;
      if (!cp) v.add('collectionPointId', 'ecoponto não encontrado');
      else if (categoria && !cp.categories.includes(categoria.code)) v.add('collectionPointId', `este ecoponto não recebe ${categoria.name.toLowerCase()}`);
    }

    const observacoes = b.notes === undefined || b.notes === null ? null : lerTexto(b.notes);
    if (observacoes !== null && observacoes.length > 500) v.add('notes', 'máximo de 500 caracteres');
    const codigoIa = b.aiSuggestedCode ?? null;
    if (codigoIa !== null && !CODIGOS_CATEGORIA.includes(codigoIa as CategoryCode)) v.add('aiSuggestedCode', 'categoria inválida');
    const confiancaIa = b.aiConfidence ?? null;
    if (confiancaIa !== null && (typeof confiancaIa !== 'number' || confiancaIa < 0 || confiancaIa > 1)) v.add('aiConfidence', 'deve estar entre 0 e 1');
    const fonteIa = b.aiSource ?? null;
    if (fonteIa !== null && !FONTES_IA.includes(fonteIa as AiSource)) v.add('aiSource', 'origem inválida');
    v.throwIfAny();

    const quando = agoraIso();
    const registro: RegistroDescarte = {
      id: crypto.randomUUID(),
      userId: me.id,
      categoryId: categoria!.id,
      quantityKg: arredondar(kgBruto!, 3),
      status: 'PENDING',
      pointsAwarded: 0,
      photoId: foto?.id ?? null,
      latitude: lat as number | null,
      longitude: lon as number | null,
      collectionPointId: idEcoponto as string | null,
      disposedAt: descartadoEm,
      createdAt: quando,
      reviewedAt: null,
      rejectionReason: null,
      notes: observacoes || null,
      aiSuggestedCode: codigoIa as CategoryCode | null,
      aiConfidence: confiancaIa as number | null,
      aiSource: fonteIa as AiSource | null,
      fraudScore: 0,
      fraudFlags: [],
      idempotencyKey: chave,
    };
    const fraude = avaliar(d, registro, categoria!, foto);
    registro.fraudScore = fraude.score;
    registro.fraudFlags = fraude.flags;
    d.disposals.push(registro);
    if (chave) d.idempotency[`${me.id}:${chave}`] = registro.id;
    registrarAuditoria(d, me, 'DISPOSAL_CREATED', 'Disposal', registro.id, `${registro.quantityKg} kg de ${categoria!.name}${fraude.score >= LIMIAR_SINALIZACAO ? ` (risco ${fraude.score})` : ''}`);

    // aprovação automática de baixo risco (como APP_AUTO_APPROVE=true no back-end)
    if (fraude.score < AUTOAPROVAR_RISCO_MAX && registro.quantityKg <= AUTOAPROVAR_KG_MAX && foto) {
      const concedidos = aprovarDescarte(d, registro, quando);
      registrarAuditoria(d, 'sistema', 'DISPOSAL_AUTO_APPROVED', 'Disposal', registro.id, `+${concedidos} pontos (baixo risco)`);
    }
    return criado<Disposal>(paraDescarte(d, registro));
  });

  rota('GET', '/disposals', ({ me, query }) => {
    const d = banco();
    const status = parametroEnum(query, 'status', STATUS_DESCARTE);
    const pagina = parametroInteiro(query, 'page', 0, 0, 10_000);
    const tamanho = parametroInteiro(query, 'size', 20, 1, 100);
    const lista = d.disposals
      .filter((x) => x.userId === me.id && (!status || x.status === status))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const p = paginar(lista, pagina, tamanho);
    return ok<Page<Disposal>>({ ...p, content: p.content.map((x) => paraDescarte(d, x)) });
  });

  rota('GET', '/disposals/:id', ({ me, params }) => {
    const d = banco();
    const x = d.disposals.find((k) => k.id === params.id);
    if (!x || (x.userId !== me.id && me.role !== 'ADMIN')) throw falha.notFound('Descarte não encontrado.');
    return ok<Disposal>(paraDescarte(d, x, me.role === 'ADMIN'));
  });
}
