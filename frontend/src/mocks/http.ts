/**
 * Tipos e utilitários HTTP do modo demonstração: erros RFC 7807, respostas e validação.
 */
import type { ApiProblem } from '@/api/types';
import type { RegistroUsuario } from './db';

export interface ErroDeCampo { field: string; message: string }

/** Erro lançado pelos handlers; o servidor converte em resposta `application/problem+json`. */
export class ErroHttp extends Error {
  readonly status: number;
  readonly code: string;
  readonly title: string;
  readonly detail: string | undefined;
  readonly errors: ErroDeCampo[] | undefined;
  readonly headers: Record<string, string>;

  constructor(status: number, codigo: string, titulo: string, detalhe?: string, erros?: ErroDeCampo[], headers: Record<string, string> = {}) {
    super(detalhe ?? titulo);
    this.status = status;
    this.code = codigo;
    this.title = titulo;
    this.detail = detalhe;
    this.errors = erros;
    this.headers = headers;
  }

  toProblem(): ApiProblem {
    const p: ApiProblem = { status: this.status, title: this.title, code: this.code };
    if (this.detail) p.detail = this.detail;
    if (this.errors?.length) p.errors = this.errors;
    return p;
  }
}

export const falha = {
  validation: (erros: ErroDeCampo[], detalhe = 'Verifique os campos destacados.') =>
    new ErroHttp(400, 'VALIDATION_ERROR', 'Dados inválidos', detalhe, erros),
  campo: (field: string, mensagem: string) =>
    new ErroHttp(400, 'VALIDATION_ERROR', 'Dados inválidos', 'Verifique os campos destacados.', [{ field, message: mensagem }]),
  badCredentials: () => new ErroHttp(401, 'BAD_CREDENTIALS', 'Credenciais inválidas', 'E-mail ou senha incorretos.'),
  locked: (segundos: number) => {
    const minutos = Math.max(1, Math.ceil(segundos / 60));
    return new ErroHttp(423, 'ACCOUNT_LOCKED', 'Conta temporariamente bloqueada',
      `Muitas tentativas inválidas. Tente novamente em ${minutos} minuto(s).`, undefined, { 'Retry-After': String(Math.max(1, Math.round(segundos))) });
  },
  inspectionLocked: (segundos: number) =>
    new ErroHttp(423, 'ACCOUNT_LOCKED', 'Conta temporariamente bloqueada',
      'Acesso bloqueado por 30 minutos por tentativa de inspeção do sistema.', undefined, { 'Retry-After': String(Math.max(1, Math.ceil(segundos))) }),
  unauthorized: (detalhe = 'Faça login para continuar.') => new ErroHttp(401, 'UNAUTHORIZED', 'Não autenticado', detalhe),
  forbidden: (detalhe = 'Você não tem permissão para acessar este recurso.') => new ErroHttp(403, 'FORBIDDEN', 'Acesso negado', detalhe),
  csrf: () => new ErroHttp(403, 'FORBIDDEN', 'Acesso negado', 'Token CSRF inválido ou ausente. Recarregue a página.'),
  notFound: (detalhe = 'Recurso não encontrado.') => new ErroHttp(404, 'NOT_FOUND', 'Não encontrado', detalhe),
  conflict: (detalhe: string) => new ErroHttp(409, 'CONFLICT', 'Conflito', detalhe),
  business: (detalhe: string) => new ErroHttp(422, 'BUSINESS_RULE', 'Regra de negócio', detalhe),
  insufficientPoints: (detalhe: string) => new ErroHttp(422, 'INSUFFICIENT_POINTS', 'Pontos insuficientes', detalhe),
  outOfStock: () => new ErroHttp(409, 'OUT_OF_STOCK', 'Sem estoque', 'Esta recompensa está esgotada.'),
  invalidImage: (detalhe: string) => new ErroHttp(400, 'INVALID_IMAGE', 'Imagem inválida', detalhe),
  methodNotAllowed: () => new ErroHttp(405, 'BAD_REQUEST', 'Método não permitido', 'Método HTTP não suportado nesta rota.'),
};

/** Resposta de um handler. `T` tipa o corpo (garante conformidade com os DTOs do contrato). */
export interface RespostaSimulada<T = unknown> {
  status: number;
  body?: T;
  blob?: Blob;
  headers?: Record<string, string>;
}

export const ok = <T>(body: T, status = 200): RespostaSimulada<T> => ({ status, body });
export const criado = <T>(body: T): RespostaSimulada<T> => ({ status: 201, body });
export const semConteudo = (status = 204): RespostaSimulada<never> => ({ status });

export interface RequisicaoSimulada {
  method: string;
  path: string;
  params: Record<string, string>;
  query: URLSearchParams;
  headers: Headers;
  body: unknown;
  form: FormData | null;
}

export interface ContextoSimulado extends RequisicaoSimulada {
  /** Usuário autenticado (garantido em rotas que exigem login). */
  me: RegistroUsuario;
  /** Usuário logado, se houver (útil em rotas públicas). */
  user: RegistroUsuario | null;
}

// ---------------------------------------------------------------- validação

/** Coletor de erros de campo no formato `errors[]`. */
export class Validador {
  readonly errors: ErroDeCampo[] = [];

  add(campo: string, mensagem: string) {
    if (!this.errors.some((e) => e.field === campo)) this.errors.push({ field: campo, message: mensagem });
    return this;
  }

  check(condicao: boolean, campo: string, mensagem: string) {
    if (!condicao) this.add(campo, mensagem);
    return condicao;
  }

  has(campo: string) { return this.errors.some((e) => e.field === campo); }

  throwIfAny() {
    if (this.errors.length) throw falha.validation(this.errors);
  }
}

export type Json = Record<string, unknown>;

/** Garante que o corpo é um objeto JSON. */
export function objetoDoCorpo(body: unknown): Json {
  if (body && typeof body === 'object' && !Array.isArray(body) && !(body instanceof FormData)) return body as Json;
  if (body === undefined || body === null || body === '') return {};
  throw new ErroHttp(400, 'VALIDATION_ERROR', 'Dados inválidos', 'O corpo da requisição deve ser um objeto JSON.');
}

export const lerTexto = (v: unknown): string | null => (typeof v === 'string' ? v.trim() : null);
export const lerNumero = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
export const lerBooleano = (v: unknown): boolean | null => (typeof v === 'boolean' ? v : null);

export function parametroInteiro(q: URLSearchParams, nome: string, padrao: number, min: number, max: number): number {
  const bruto = q.get(nome);
  if (bruto === null || bruto === '') return padrao;
  const n = Number(bruto);
  if (!Number.isInteger(n) || n < min || n > max) throw falha.campo(nome, `deve ser um número inteiro entre ${min} e ${max}`);
  return n;
}

export function parametroEnum<T extends string>(q: URLSearchParams, nome: string, permitidos: readonly T[]): T | null {
  const bruto = q.get(nome);
  if (bruto === null || bruto === '') return null;
  if (!(permitidos as readonly string[]).includes(bruto)) throw falha.campo(nome, `valor inválido (use ${permitidos.join(', ')})`);
  return bruto as T;
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const DATA_RE = /^\d{4}-\d{2}-\d{2}$/;
