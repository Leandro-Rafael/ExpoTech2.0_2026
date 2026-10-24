/** /api/disposals — registro (com Idempotency-Key e antifraude) e histórico do usuário. */
import type { AiSource, CategoryCode, Disposal, DisposalStatus, Page } from '@/api/types';
import { db, nowIso, type DisposalRec } from '../db';
import { paginate, toDisposal } from '../dto';
import { UUID_RE, Validator, bodyObject, created, enumParam, fail, intParam, num, ok, str } from '../http';
import { audit } from '../logic/audit';
import { DAY } from '../logic/dates';
import { FLAG_THRESHOLD, assess } from '../logic/fraud';
import { approveDisposal } from '../logic/points';
import { round } from '../logic/random';
import { route } from '../server';

export const CATEGORY_CODES: CategoryCode[] = ['PLASTICO', 'PAPEL', 'VIDRO', 'METAL', 'ORGANICO', 'ELETRONICO', 'REJEITO'];
const AI_SOURCES: AiSource[] = ['CLAUDE', 'LOCAL', 'MANUAL'];
export const DISPOSAL_STATUSES: DisposalStatus[] = ['PENDING', 'APPROVED', 'REJECTED'];
const AUTO_APPROVE_MAX_SCORE = 20;
const AUTO_APPROVE_MAX_KG = 5;

export function registerDisposalRoutes() {
  route('POST', '/disposals', ({ me, body, headers }) => {
    const d = db();
    const key = headers.get('Idempotency-Key');
    if (key !== null && !/^[A-Za-z0-9_-]{8,64}$/.test(key)) {
      throw fail.field('Idempotency-Key', 'use de 8 a 64 caracteres (letras, números, - ou _)');
    }
    if (key) {
      const existingId = d.idempotency[`${me.id}:${key}`];
      const existing = existingId && d.disposals.find((x) => x.id === existingId);
      if (existing) return created<Disposal>(toDisposal(d, existing)); // clique duplo: devolve o mesmo descarte
    }

    const b = bodyObject(body);
    const v = new Validator();
    const categoryId = str(b.categoryId);
    const category = categoryId ? d.categories.find((c) => c.id === categoryId && c.active) : undefined;
    if (!categoryId) v.add('categoryId', 'informe a categoria');
    else if (!category) v.add('categoryId', 'categoria não encontrada');

    const kgRaw = num(b.quantityKg);
    if (kgRaw === null) v.add('quantityKg', 'deve ser um número');
    else if (kgRaw < 0.01) v.add('quantityKg', 'a quantidade mínima é 0,01 kg');
    else if (category && kgRaw > category.maxKgPerDisposal) {
      v.add('quantityKg', `máximo de ${category.maxKgPerDisposal} kg por descarte de ${category.name}`);
    }

    const lat = b.latitude ?? null;
    const lon = b.longitude ?? null;
    if ((lat === null) !== (lon === null)) v.add('latitude', 'informe latitude e longitude juntas');
    else if (lat !== null) {
      v.check(typeof lat === 'number' && lat >= -90 && lat <= 90, 'latitude', 'latitude inválida');
      v.check(typeof lon === 'number' && lon >= -180 && lon <= 180, 'longitude', 'longitude inválida');
    }

    const now = Date.now();
    let disposedAt = new Date(now).toISOString();
    if (b.disposedAt !== undefined && b.disposedAt !== null) {
      const t = typeof b.disposedAt === 'string' ? Date.parse(b.disposedAt) : NaN;
      if (Number.isNaN(t)) v.add('disposedAt', 'data inválida');
      else if (t > now + 5 * 60_000) v.add('disposedAt', 'a data do descarte não pode ser no futuro');
      else if (t < now - 7 * DAY) v.add('disposedAt', 'só é possível registrar descartes dos últimos 7 dias');
      else disposedAt = new Date(t).toISOString();
    }

    const photoId = b.photoId ?? null;
    const photo = typeof photoId === 'string' ? d.photos.find((p) => p.id === photoId && p.ownerId === me.id) ?? null : null;
    if (photoId !== null) {
      if (!photo) v.add('photoId', 'foto não encontrada');
      else if (d.disposals.some((x) => x.photoId === photo.id)) v.add('photoId', 'esta foto já foi usada em outro descarte');
    }

    const cpId = b.collectionPointId ?? null;
    if (cpId !== null) {
      const cp = typeof cpId === 'string' && UUID_RE.test(cpId) ? d.collectionPoints.find((p) => p.id === cpId && p.active) : undefined;
      if (!cp) v.add('collectionPointId', 'ecoponto não encontrado');
      else if (category && !cp.categories.includes(category.code)) v.add('collectionPointId', `este ecoponto não recebe ${category.name.toLowerCase()}`);
    }

    const notes = b.notes === undefined || b.notes === null ? null : str(b.notes);
    if (notes !== null && notes.length > 500) v.add('notes', 'máximo de 500 caracteres');
    const aiCode = b.aiSuggestedCode ?? null;
    if (aiCode !== null && !CATEGORY_CODES.includes(aiCode as CategoryCode)) v.add('aiSuggestedCode', 'categoria inválida');
    const aiConf = b.aiConfidence ?? null;
    if (aiConf !== null && (typeof aiConf !== 'number' || aiConf < 0 || aiConf > 1)) v.add('aiConfidence', 'deve estar entre 0 e 1');
    const aiSource = b.aiSource ?? null;
    if (aiSource !== null && !AI_SOURCES.includes(aiSource as AiSource)) v.add('aiSource', 'origem inválida');
    v.throwIfAny();

    const at = nowIso();
    const rec: DisposalRec = {
      id: crypto.randomUUID(),
      userId: me.id,
      categoryId: category!.id,
      quantityKg: round(kgRaw!, 3),
      status: 'PENDING',
      pointsAwarded: 0,
      photoId: photo?.id ?? null,
      latitude: lat as number | null,
      longitude: lon as number | null,
      collectionPointId: cpId as string | null,
      disposedAt,
      createdAt: at,
      reviewedAt: null,
      rejectionReason: null,
      notes: notes || null,
      aiSuggestedCode: aiCode as CategoryCode | null,
      aiConfidence: aiConf as number | null,
      aiSource: aiSource as AiSource | null,
      fraudScore: 0,
      fraudFlags: [],
      idempotencyKey: key,
    };
    const fraud = assess(d, rec, category!, photo);
    rec.fraudScore = fraud.score;
    rec.fraudFlags = fraud.flags;
    d.disposals.push(rec);
    if (key) d.idempotency[`${me.id}:${key}`] = rec.id;
    audit(d, me, 'DISPOSAL_CREATED', 'Disposal', rec.id, `${rec.quantityKg} kg de ${category!.name}${fraud.score >= FLAG_THRESHOLD ? ` (risco ${fraud.score})` : ''}`);

    // aprovação automática de baixo risco (como APP_AUTO_APPROVE=true no back-end)
    if (fraud.score < AUTO_APPROVE_MAX_SCORE && rec.quantityKg <= AUTO_APPROVE_MAX_KG && photo) {
      const awarded = approveDisposal(d, rec, at);
      audit(d, 'sistema', 'DISPOSAL_AUTO_APPROVED', 'Disposal', rec.id, `+${awarded} pontos (baixo risco)`);
    }
    return created<Disposal>(toDisposal(d, rec));
  });

  route('GET', '/disposals', ({ me, query }) => {
    const d = db();
    const status = enumParam(query, 'status', DISPOSAL_STATUSES);
    const page = intParam(query, 'page', 0, 0, 10_000);
    const size = intParam(query, 'size', 20, 1, 100);
    const list = d.disposals
      .filter((x) => x.userId === me.id && (!status || x.status === status))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const p = paginate(list, page, size);
    return ok<Page<Disposal>>({ ...p, content: p.content.map((x) => toDisposal(d, x)) });
  });

  route('GET', '/disposals/:id', ({ me, params }) => {
    const d = db();
    const x = d.disposals.find((k) => k.id === params.id);
    if (!x || (x.userId !== me.id && me.role !== 'ADMIN')) throw fail.notFound('Descarte não encontrado.');
    return ok<Disposal>(toDisposal(d, x, me.role === 'ADMIN'));
  });
}
