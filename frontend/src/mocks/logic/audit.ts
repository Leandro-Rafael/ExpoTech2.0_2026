import type { MockDb, UserRec } from '../db';

/** Ator usado na trilha de auditoria. */
export function actorLabel(user: UserRec | null | undefined): string {
  return user ? `${user.name} <${user.email}>` : 'sistema';
}

/** Registra uma entrada de auditoria (mais recentes primeiro). */
export function audit(
  d: MockDb,
  actor: UserRec | string | null,
  action: string,
  entity: string | null,
  entityId: string | null,
  details: string | null,
  at: string = new Date().toISOString(),
  ip: string | null = '127.0.0.1',
) {
  const label = typeof actor === 'string' ? actor : actorLabel(actor);
  const entry = { id: crypto.randomUUID(), actor: label, action, entity, entityId, details, ip, createdAt: at };
  // mantém a ordem decrescente mesmo quando a semeadura registra eventos do passado
  const idx = d.audit.findIndex((e) => e.createdAt <= at);
  if (idx === -1) d.audit.push(entry);
  else d.audit.splice(idx, 0, entry);
}
