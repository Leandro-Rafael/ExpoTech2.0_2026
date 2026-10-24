/**
 * Tipos e utilitários HTTP do modo demonstração: erros RFC 7807, respostas e validação.
 */
import type { ApiProblem } from '@/api/types';
import type { UserRec } from './db';

export interface FieldError { field: string; message: string }

/** Erro lançado pelos handlers; o servidor converte em resposta `application/problem+json`. */
export class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly title: string;
  readonly detail: string | undefined;
  readonly errors: FieldError[] | undefined;
  readonly headers: Record<string, string>;

  constructor(status: number, code: string, title: string, detail?: string, errors?: FieldError[], headers: Record<string, string> = {}) {
    super(detail ?? title);
    this.status = status;
    this.code = code;
    this.title = title;
    this.detail = detail;
    this.errors = errors;
    this.headers = headers;
  }

  toProblem(): ApiProblem {
    const p: ApiProblem = { status: this.status, title: this.title, code: this.code };
    if (this.detail) p.detail = this.detail;
    if (this.errors?.length) p.errors = this.errors;
    return p;
  }
}

export const fail = {
  validation: (errors: FieldError[], detail = 'Verifique os campos destacados.') =>
    new HttpError(400, 'VALIDATION_ERROR', 'Dados inválidos', detail, errors),
  field: (field: string, message: string) =>
    new HttpError(400, 'VALIDATION_ERROR', 'Dados inválidos', 'Verifique os campos destacados.', [{ field, message }]),
  badCredentials: () => new HttpError(401, 'BAD_CREDENTIALS', 'Credenciais inválidas', 'E-mail ou senha incorretos.'),
  locked: (seconds: number) => {
    const minutes = Math.max(1, Math.ceil(seconds / 60));
    return new HttpError(423, 'ACCOUNT_LOCKED', 'Conta temporariamente bloqueada',
      `Muitas tentativas inválidas. Tente novamente em ${minutes} minuto(s).`, undefined, { 'Retry-After': String(Math.max(1, Math.round(seconds))) });
  },
  unauthorized: (detail = 'Faça login para continuar.') => new HttpError(401, 'UNAUTHORIZED', 'Não autenticado', detail),
  forbidden: (detail = 'Você não tem permissão para acessar este recurso.') => new HttpError(403, 'FORBIDDEN', 'Acesso negado', detail),
  csrf: () => new HttpError(403, 'FORBIDDEN', 'Acesso negado', 'Token CSRF inválido ou ausente. Recarregue a página.'),
  notFound: (detail = 'Recurso não encontrado.') => new HttpError(404, 'NOT_FOUND', 'Não encontrado', detail),
  conflict: (detail: string) => new HttpError(409, 'CONFLICT', 'Conflito', detail),
  business: (detail: string) => new HttpError(422, 'BUSINESS_RULE', 'Regra de negócio', detail),
  insufficientPoints: (detail: string) => new HttpError(422, 'INSUFFICIENT_POINTS', 'Pontos insuficientes', detail),
  outOfStock: () => new HttpError(409, 'OUT_OF_STOCK', 'Sem estoque', 'Esta recompensa está esgotada.'),
  invalidImage: (detail: string) => new HttpError(400, 'INVALID_IMAGE', 'Imagem inválida', detail),
  methodNotAllowed: () => new HttpError(405, 'BAD_REQUEST', 'Método não permitido', 'Método HTTP não suportado nesta rota.'),
};

/** Resposta de um handler. `T` tipa o corpo (garante conformidade com os DTOs do contrato). */
export interface MockResponse<T = unknown> {
  status: number;
  body?: T;
  blob?: Blob;
  headers?: Record<string, string>;
}

export const ok = <T>(body: T, status = 200): MockResponse<T> => ({ status, body });
export const created = <T>(body: T): MockResponse<T> => ({ status: 201, body });
export const noContent = (status = 204): MockResponse<never> => ({ status });

export interface MockRequest {
  method: string;
  path: string;
  params: Record<string, string>;
  query: URLSearchParams;
  headers: Headers;
  body: unknown;
  form: FormData | null;
}

export interface MockContext extends MockRequest {
  /** Usuário autenticado (garantido em rotas que exigem login). */
  me: UserRec;
  /** Usuário logado, se houver (útil em rotas públicas). */
  user: UserRec | null;
}

// ---------------------------------------------------------------- validação

/** Coletor de erros de campo no formato `errors[]`. */
export class Validator {
  readonly errors: FieldError[] = [];

  add(field: string, message: string) {
    if (!this.errors.some((e) => e.field === field)) this.errors.push({ field, message });
    return this;
  }

  check(cond: boolean, field: string, message: string) {
    if (!cond) this.add(field, message);
    return cond;
  }

  has(field: string) { return this.errors.some((e) => e.field === field); }

  throwIfAny() {
    if (this.errors.length) throw fail.validation(this.errors);
  }
}

export type Json = Record<string, unknown>;

/** Garante que o corpo é um objeto JSON. */
export function bodyObject(body: unknown): Json {
  if (body && typeof body === 'object' && !Array.isArray(body) && !(body instanceof FormData)) return body as Json;
  if (body === undefined || body === null || body === '') return {};
  throw new HttpError(400, 'VALIDATION_ERROR', 'Dados inválidos', 'O corpo da requisição deve ser um objeto JSON.');
}

export const str = (v: unknown): string | null => (typeof v === 'string' ? v.trim() : null);
export const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
export const bool = (v: unknown): boolean | null => (typeof v === 'boolean' ? v : null);

export function intParam(q: URLSearchParams, name: string, def: number, min: number, max: number): number {
  const raw = q.get(name);
  if (raw === null || raw === '') return def;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < min || n > max) throw fail.field(name, `deve ser um número inteiro entre ${min} e ${max}`);
  return n;
}

export function enumParam<T extends string>(q: URLSearchParams, name: string, allowed: readonly T[]): T | null {
  const raw = q.get(name);
  if (raw === null || raw === '') return null;
  if (!(allowed as readonly string[]).includes(raw)) throw fail.field(name, `valor inválido (use ${allowed.join(', ')})`);
  return raw as T;
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
