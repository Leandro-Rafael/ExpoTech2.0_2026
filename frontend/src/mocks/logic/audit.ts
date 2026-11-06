import type { BancoSimulado, RegistroUsuario } from '../db';

/** Ator usado na trilha de auditoria. */
export function rotuloAutor(usuario: RegistroUsuario | null | undefined): string {
  return usuario ? `${usuario.name} <${usuario.email}>` : 'sistema';
}

/** Registra uma entrada de auditoria (mais recentes primeiro). */
export function registrarAuditoria(
  d: BancoSimulado,
  autor: RegistroUsuario | string | null,
  acao: string,
  entidade: string | null,
  idEntidade: string | null,
  detalhes: string | null,
  quando: string = new Date().toISOString(),
  ip: string | null = '127.0.0.1',
) {
  const rotulo = typeof autor === 'string' ? autor : rotuloAutor(autor);
  const entrada = { id: crypto.randomUUID(), actor: rotulo, action: acao, entity: entidade, entityId: idEntidade, details: detalhes, ip, createdAt: quando };
  // mantém a ordem decrescente mesmo quando a semeadura registra eventos do passado
  const idx = d.audit.findIndex((e) => e.createdAt <= quando);
  if (idx === -1) d.audit.push(entrada);
  else d.audit.splice(idx, 0, entrada);
}
