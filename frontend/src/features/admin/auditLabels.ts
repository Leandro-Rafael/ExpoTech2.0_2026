import type { Tone } from '@/lib/labels';

export type AuditGroup = 'acesso' | 'descartes' | 'coletas' | 'catalogo' | 'usuarios' | 'casa' | 'recompensas' | 'outros';

export const AUDIT_GROUPS: Record<AuditGroup, { label: string; tone: Tone }> = {
  acesso: { label: 'Acesso e segurança', tone: 'info' },
  descartes: { label: 'Descartes', tone: 'brand' },
  coletas: { label: 'Coletas e rotas', tone: 'lime' },
  catalogo: { label: 'Catálogo', tone: 'neutral' },
  usuarios: { label: 'Usuários', tone: 'warning' },
  casa: { label: 'Smart Home', tone: 'brand' },
  recompensas: { label: 'Recompensas', tone: 'success' },
  outros: { label: 'Outros', tone: 'neutral' },
};

const A: Record<string, [string, AuditGroup, Tone?]> = {
  LOGIN_SUCCESS: ['Entrou no sistema', 'acesso'],
  LOGIN_FAILED: ['Falha de login', 'acesso', 'warning'],
  LOGIN_DISABLED_ACCOUNT: ['Login em conta desativada', 'acesso', 'danger'],
  ACCOUNT_LOCKED: ['Conta bloqueada', 'acesso', 'danger'],
  ACCOUNT_UNLOCKED: ['Conta desbloqueada', 'acesso'],
  INSPECTION_WARNING: ['Aviso de inspeção do navegador', 'acesso', 'warning'],
  INSPECTION_LOCKED: ['Bloqueio por inspeção', 'acesso', 'danger'],
  LOGOUT: ['Saiu do sistema', 'acesso'],
  PASSWORD_CHANGED: ['Alterou a senha', 'acesso'],
  USER_REGISTERED: ['Novo cadastro', 'usuarios'],
  USER_UPDATED: ['Usuário alterado', 'usuarios'],
  PROFILE_UPDATED: ['Perfil atualizado', 'usuarios'],
  DISPOSAL_CREATED: ['Descarte registrado', 'descartes'],
  DISPOSAL_APPROVED: ['Descarte aprovado', 'descartes', 'success'],
  DISPOSAL_AUTO_APPROVED: ['Descarte aprovado automaticamente', 'descartes', 'success'],
  DISPOSAL_REJECTED: ['Descarte recusado', 'descartes', 'danger'],
  COLLECTION_REQUESTED: ['Coleta solicitada', 'coletas'],
  COLLECTION_CANCELLED: ['Coleta cancelada', 'coletas'],
  ROUTE_CREATED: ['Rota criada', 'coletas'],
  ROUTE_STARTED: ['Rota iniciada', 'coletas'],
  STOP_COMPLETED: ['Parada concluída', 'coletas', 'success'],
  ROUTE_COMPLETED: ['Rota concluída', 'coletas', 'success'],
  CATEGORY_CREATED: ['Categoria criada', 'catalogo'],
  CATEGORY_UPDATED: ['Categoria alterada', 'catalogo'],
  COLLECTION_POINT_CREATED: ['Ecoponto criado', 'catalogo'],
  COLLECTION_POINT_UPDATED: ['Ecoponto alterado', 'catalogo'],
  COLLECTION_POINT_DELETED: ['Ecoponto excluído', 'catalogo', 'danger'],
  REWARD_CREATED: ['Recompensa criada', 'catalogo'],
  REWARD_UPDATED: ['Recompensa alterada', 'catalogo'],
  CHALLENGE_CREATED: ['Desafio criado', 'catalogo'],
  CHALLENGE_UPDATED: ['Desafio alterado', 'catalogo'],
  ORGANIZATION_CREATED: ['Organização criada', 'catalogo'],
  GOAL_CREATED: ['Meta criada', 'catalogo'],
  GOAL_UPDATED: ['Meta alterada', 'catalogo'],
  REWARD_REDEEMED: ['Recompensa resgatada', 'recompensas'],
  HOUSEHOLD_CREATED: ['Residência criada', 'casa'],
  HOUSEHOLD_JOINED: ['Entrou em residência', 'casa'],
  HOUSEHOLD_LEFT: ['Saiu da residência', 'casa'],
  SMART_BIN_CREATED: ['Lixeira conectada', 'casa'],
  SMART_BIN_DELETED: ['Lixeira removida', 'casa'],
  SMART_BIN_AUTO_REQUEST: ['Lixeira pediu coleta', 'casa', 'warning'],
  REPORT_EXPORTED: ['Relatório exportado', 'outros'],
};

/** "SOME_NEW_ACTION" → "Some new action" quando não há rótulo. */
function humanize(code: string) {
  const s = code.toLowerCase().replace(/_/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function auditMeta(action: string): { label: string; group: AuditGroup; tone: Tone } {
  const m = A[action];
  if (!m) return { label: humanize(action), group: 'outros', tone: 'neutral' };
  return { label: m[0], group: m[1], tone: m[2] ?? AUDIT_GROUPS[m[1]].tone };
}

export const KNOWN_ACTIONS = Object.keys(A);
