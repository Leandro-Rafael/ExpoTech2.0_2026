/**
 * Rótulos em português + "tom" visual para TODOS os enums do contrato.
 * O tom é consumido por <Badge tone> e <StatusPill>.
 *
 *   import { disposalStatus } from '@/lib/labels';
 *   disposalStatus.PENDING.label // "Pendente"
 */
import type { AiSource, BadgeTier, CategoryCode, CollectionRequestStatus, CollectionSource, DisposalStatus, OrganizationType, PointTransactionType, RankingPeriod, RedemptionStatus, Role, RouteStatus, SmartBinStatus } from '@/api/types';

export type Tom = 'neutral' | 'brand' | 'lime' | 'success' | 'warning' | 'danger' | 'info';
export interface MetaEnum { label: string; tone: Tom; description?: string }
type MapaEnum<K extends string> = Record<K, MetaEnum>;

export const perfil: MapaEnum<Role> = {
  USER: { label: 'Morador', tone: 'brand' },
  COLLECTOR: { label: 'Coletor', tone: 'info' },
  ADMIN: { label: 'Administrador', tone: 'lime' },
};

export const statusDescarte: MapaEnum<DisposalStatus> = {
  PENDING: { label: 'Pendente', tone: 'warning', description: 'Aguardando análise' },
  APPROVED: { label: 'Aprovado', tone: 'success', description: 'Pontos creditados' },
  REJECTED: { label: 'Recusado', tone: 'danger', description: 'Não gerou pontos' },
};

export const origemIa: MapaEnum<AiSource> = {
  CLAUDE: { label: 'IA no servidor', tone: 'lime' },
  LOCAL: { label: 'IA no navegador', tone: 'info' },
  MANUAL: { label: 'Manual', tone: 'neutral' },
};

export const tipoTransacaoPontos: MapaEnum<PointTransactionType> = {
  EARN: { label: 'Ganho', tone: 'success' },
  BONUS: { label: 'Bônus', tone: 'lime' },
  REDEEM: { label: 'Resgate', tone: 'warning' },
  ADJUST: { label: 'Ajuste', tone: 'neutral' },
};

export const periodoRanking: MapaEnum<RankingPeriod> = {
  WEEK: { label: 'Semana', tone: 'neutral' },
  MONTH: { label: 'Mês', tone: 'neutral' },
  YEAR: { label: 'Ano', tone: 'neutral' },
  ALL: { label: 'Sempre', tone: 'neutral' },
};

export const statusSolicitacaoColeta: MapaEnum<CollectionRequestStatus> = {
  REQUESTED: { label: 'Solicitada', tone: 'warning' },
  SCHEDULED: { label: 'Agendada', tone: 'info' },
  IN_ROUTE: { label: 'Em rota', tone: 'lime' },
  COLLECTED: { label: 'Coletada', tone: 'success' },
  CANCELLED: { label: 'Cancelada', tone: 'neutral' },
};

export const origemColeta: MapaEnum<CollectionSource> = {
  USER: { label: 'Morador', tone: 'neutral' },
  SMART_BIN: { label: 'Lixeira inteligente', tone: 'lime' },
};

export const statusRota: MapaEnum<RouteStatus> = {
  PLANNED: { label: 'Planejada', tone: 'info' },
  IN_PROGRESS: { label: 'Em andamento', tone: 'lime' },
  DONE: { label: 'Concluída', tone: 'success' },
};

export const statusResgate: MapaEnum<RedemptionStatus> = {
  ISSUED: { label: 'Disponível', tone: 'success' },
  USED: { label: 'Utilizado', tone: 'neutral' },
  CANCELLED: { label: 'Cancelado', tone: 'danger' },
};

export const tipoOrganizacao: MapaEnum<OrganizationType> = {
  TURMA: { label: 'Turma', tone: 'info' },
  EMPRESA: { label: 'Empresa', tone: 'brand' },
  CONDOMINIO: { label: 'Condomínio', tone: 'lime' },
  ESCOLA: { label: 'Escola', tone: 'warning' },
};

export const nivelMedalha: MapaEnum<BadgeTier> & Record<BadgeTier, { color: string }> = {
  BRONZE: { label: 'Bronze', tone: 'warning', color: '#d08b5b' },
  PRATA: { label: 'Prata', tone: 'neutral', color: '#cbd5e1' },
  OURO: { label: 'Ouro', tone: 'warning', color: '#fbbf24' },
  DIAMANTE: { label: 'Diamante', tone: 'info', color: '#7dd3fc' },
};

export const statusLixeira: MapaEnum<SmartBinStatus> = {
  OK: { label: 'Normal', tone: 'success' },
  ATTENTION: { label: 'Atenção', tone: 'warning' },
  FULL: { label: 'Cheia', tone: 'danger' },
  OFFLINE: { label: 'Offline', tone: 'neutral' },
};

/** Fallback local das categorias (cor/ícone/nome) caso a API ainda não tenha respondido. */
export const categoriaPadrao: Record<CategoryCode, { name: string; color: string; icon: string }> = {
  PLASTICO: { name: 'Plástico', color: '#ef4444', icon: 'milk' },
  PAPEL: { name: 'Papel', color: '#3b82f6', icon: 'newspaper' },
  VIDRO: { name: 'Vidro', color: '#22c55e', icon: 'wine' },
  METAL: { name: 'Metal', color: '#eab308', icon: 'cylinder' },
  ORGANICO: { name: 'Orgânico', color: '#a16207', icon: 'apple' },
  ELETRONICO: { name: 'Eletrônico', color: '#f97316', icon: 'cpu' },
  REJEITO: { name: 'Rejeito', color: '#6b7280', icon: 'trash-2' },
};

export const CODIGOS_CATEGORIA = Object.keys(categoriaPadrao) as CategoryCode[];

/** Mensagens de códigos de erro da API (ApiError.code) para exibição amigável. */
export const mensagemCodigoErro: Record<string, string> = {
  VALIDATION_ERROR: 'Verifique os campos destacados.',
  BAD_CREDENTIALS: 'E-mail ou senha incorretos.',
  ACCOUNT_LOCKED: 'Conta temporariamente bloqueada por excesso de tentativas. Tente novamente em alguns minutos.',
  UNAUTHORIZED: 'Sua sessão expirou. Entre novamente.',
  FORBIDDEN: 'Você não tem permissão para esta ação.',
  ACCOUNT_DISABLED: 'Esta conta está desativada. Fale com a administração.',
  NOT_FOUND: 'Não encontramos o que você procurava.',
  CONFLICT: 'Este registro já existe ou foi alterado por outra pessoa.',
  INSUFFICIENT_POINTS: 'Você ainda não tem pontos suficientes para este resgate.',
  OUT_OF_STOCK: 'Recompensa esgotada no momento.',
  RATE_LIMITED: 'Muitas tentativas. Aguarde um pouco.',
  INVALID_IMAGE: 'Imagem inválida. Envie JPEG ou PNG de até 5 MB.',
  BUSINESS_RULE: 'Esta operação não é permitida pelas regras do sistema.',
  INTERNAL_ERROR: 'Algo deu errado do nosso lado. Tente novamente.',
  NETWORK_ERROR: 'Não foi possível conectar ao servidor. Verifique sua conexão.',
};
