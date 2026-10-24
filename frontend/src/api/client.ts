/**
 * Cliente HTTP da API (/api).
 *
 * - Cookies HttpOnly (`credentials: 'include'`) — o front nunca vê tokens.
 * - CSRF: lê o cookie `XSRF-TOKEN` e envia `X-XSRF-TOKEN` em POST/PUT/PATCH/DELETE.
 * - 401 → tenta `POST /api/auth/refresh` UMA vez (promessa compartilhada entre
 *   requisições simultâneas) e repete; se falhar, emite o evento de logout.
 * - Erros RFC 7807 → `ApiError` tipado (status, code, detail, fieldErrors).
 * - 429 → mensagem com o tempo de espera do header Retry-After.
 *
 * Uso: `api.get<UserMe>('/auth/me')`, `api.post<Disposal>('/disposals', body, { idempotencyKey })`.
 * Prefira os módulos de endpoint (auth.ts, disposals.ts...) e os hooks de queries.ts.
 */
import type { ApiProblem } from './types';
import { errorCodeMessage } from '@/lib/labels';

export const API_BASE = '/api';

export type QueryValue = string | number | boolean | null | undefined;
export type QueryParams = Record<string, QueryValue | QueryValue[]>;

export interface RequestOptions {
  query?: QueryParams;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  /** Envia o header Idempotency-Key (use `newIdempotencyKey()` uma vez por ação do usuário). */
  idempotencyKey?: string;
  /** Não tenta refresh em 401 (usado pelas próprias rotas de auth). */
  skipRefresh?: boolean;
  /** Não emite logout global em 401 (ex.: checagem inicial de sessão). */
  silent401?: boolean;
}

export interface FieldError { field: string; message: string }

/** Erro de API normalizado. Sempre é o que `throw` dos helpers deste módulo lança. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly title: string;
  readonly detail: string | undefined;
  readonly fieldErrors: FieldError[];
  /** Segundos até poder tentar de novo (429). */
  readonly retryAfter: number | null;

  constructor(init: { status: number; code: string; title: string; detail?: string; fieldErrors?: FieldError[]; retryAfter?: number | null }) {
    super(init.detail || init.title);
    this.name = 'ApiError';
    this.status = init.status;
    this.code = init.code;
    this.title = init.title;
    this.detail = init.detail;
    this.fieldErrors = init.fieldErrors ?? [];
    this.retryAfter = init.retryAfter ?? null;
  }

  get isNetwork() { return this.status === 0; }
  get isValidation() { return this.code === 'VALIDATION_ERROR' || this.fieldErrors.length > 0; }
  get isUnauthorized() { return this.status === 401; }
  get isForbidden() { return this.status === 403; }
  get isNotFound() { return this.status === 404; }
  get isRateLimited() { return this.status === 429; }

  /** Mapa field → mensagem. */
  fieldMap(): Record<string, string> {
    return Object.fromEntries(this.fieldErrors.map((e) => [e.field, e.message]));
  }
}

/** Mensagem amigável em PT para qualquer erro (ApiError ou não). Use em toasts/ErrorState. */
export function errorMessage(err: unknown, fallback = 'Algo deu errado. Tente novamente.'): string {
  if (err instanceof ApiError) {
    if (err.code === 'RATE_LIMITED' || err.isRateLimited) return rateLimitMessage(err.retryAfter);
    if (err.code === 'ACCOUNT_LOCKED') return err.detail ?? lockedMessage(err.retryAfter);
    if (err.detail) return err.detail;
    return errorCodeMessage[err.code] ?? err.title ?? fallback;
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

function rateLimitMessage(seconds: number | null): string {
  if (!seconds || seconds <= 0) return errorCodeMessage.RATE_LIMITED;
  if (seconds < 60) return `Muitas tentativas. Tente novamente em ${seconds} s.`;
  const min = Math.ceil(seconds / 60);
  return `Muitas tentativas. Tente novamente em ${min} min.`;
}

// ---------------------------------------------------------------- eventos

type Listener = () => void;
const logoutListeners = new Set<Listener>();

/** Assina o evento "sessão expirou/terminou" (o AuthProvider limpa o usuário). */
export function onUnauthorized(fn: Listener): () => void {
  logoutListeners.add(fn);
  return () => logoutListeners.delete(fn);
}
function emitUnauthorized() { logoutListeners.forEach((fn) => fn()); }

// ---------------------------------------------------------------- CSRF

export function readCookie(name: string): string | null {
  const match = document.cookie.split('; ').find((c) => c.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

let csrfPromise: Promise<void> | null = null;

/** Garante o cookie XSRF-TOKEN (GET /api/auth/csrf). Chamado no boot e antes de mutações se faltar. */
export function ensureCsrf(force = false): Promise<void> {
  if (!force && readCookie('XSRF-TOKEN')) return Promise.resolve();
  if (!csrfPromise || force) {
    csrfPromise = fetch(`${API_BASE}/auth/csrf`, { credentials: 'include', headers: { Accept: 'application/json' } })
      .then(() => undefined)
      .catch(() => undefined)
      .finally(() => { csrfPromise = null; });
  }
  return csrfPromise;
}

// ---------------------------------------------------------------- refresh single-flight

let refreshPromise: Promise<boolean> | null = null;
/** Momento (performance.now) da última renovação bem-sucedida. */
let lastRefreshOkAt = -Infinity;

/**
 * Renova a sessão (POST /auth/refresh) com UMA promessa compartilhada: o back-end detecta
 * reuso do refresh token e encerra a sessão se duas renovações correrem em paralelo.
 * Requisições que receberam 401 mas foram ENVIADAS antes de uma renovação já concluída
 * apenas repetem (não renovam de novo) — ver `send()`.
 */
function refreshSession(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        await ensureCsrf();
        const res = await fetch(`${API_BASE}/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
          headers: { Accept: 'application/json', ...csrfHeaders('POST') },
        });
        if (res.ok) lastRefreshOkAt = performance.now();
        return res.ok;
      } catch {
        return false;
      } finally {
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
}

// ---------------------------------------------------------------- núcleo

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function csrfHeaders(method: string): Record<string, string> {
  if (!MUTATING.has(method)) return {};
  const token = readCookie('XSRF-TOKEN');
  return token ? { 'X-XSRF-TOKEN': token } : {};
}

export function buildUrl(path: string, query?: QueryParams): string {
  const url = path.startsWith('http') ? path : `${API_BASE}${path.startsWith('/') ? '' : '/'}${path}`;
  if (!query) return url;
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    const values = Array.isArray(v) ? v : [v];
    for (const item of values) {
      if (item === undefined || item === null || item === '') continue;
      sp.append(k, String(item));
    }
  }
  const qs = sp.toString();
  return qs ? `${url}?${qs}` : url;
}

async function toApiError(res: Response): Promise<ApiError> {
  let problem: Partial<ApiProblem> = {};
  const ct = res.headers.get('content-type') ?? '';
  if (ct.includes('json')) {
    try { problem = await res.json(); } catch { /* corpo vazio */ }
  }
  const retryAfterRaw = res.headers.get('Retry-After');
  let retryAfter: number | null = null;
  if (retryAfterRaw) {
    const n = Number(retryAfterRaw);
    retryAfter = Number.isFinite(n) ? n : Math.max(0, Math.round((Date.parse(retryAfterRaw) - Date.now()) / 1000));
  }
  const code = problem.code ?? defaultCode(res.status);
  const err = new ApiError({
    status: res.status,
    code,
    title: problem.title ?? res.statusText ?? 'Erro',
    detail: code === 'RATE_LIMITED' || res.status === 429
      ? rateLimitMessage(retryAfter)
      : code === 'ACCOUNT_LOCKED'
        ? lockedMessage(retryAfter)
        : problem.detail ?? errorCodeMessage[code],
    fieldErrors: Array.isArray(problem.errors) ? problem.errors : [],
    retryAfter,
  });
  return err;
}

function lockedMessage(seconds: number | null): string {
  if (!seconds || seconds <= 0) return errorCodeMessage.ACCOUNT_LOCKED;
  const min = Math.max(1, Math.ceil(seconds / 60));
  return `Conta bloqueada temporariamente por excesso de tentativas. Tente novamente em ${min} min.`;
}

/** Só usado quando o corpo não traz `code`. Sempre trate erros pelo `code`. */
function defaultCode(status: number): string {
  switch (status) {
    case 400: return 'VALIDATION_ERROR';
    case 401: return 'UNAUTHORIZED';
    case 403: return 'FORBIDDEN';
    case 404: return 'NOT_FOUND';
    case 409: return 'CONFLICT';
    case 413: return 'INVALID_IMAGE';
    case 422: return 'BUSINESS_RULE';
    case 423: return 'ACCOUNT_LOCKED';
    case 429: return 'RATE_LIMITED';
    default: return status >= 500 ? 'INTERNAL_ERROR' : 'UNKNOWN';
  }
}

type Body = unknown;

async function send(method: string, path: string, body: Body | undefined, opts: RequestOptions, retried = false): Promise<Response> {
  if (MUTATING.has(method)) await ensureCsrf();

  const headers: Record<string, string> = { Accept: 'application/json', ...csrfHeaders(method), ...opts.headers };
  let payload: BodyInit | undefined;
  if (body instanceof FormData) {
    payload = body; // o navegador define o boundary
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  if (opts.idempotencyKey) headers['Idempotency-Key'] = opts.idempotencyKey;

  let res: Response;
  const sentAt = performance.now();
  try {
    res = await fetch(buildUrl(path, opts.query), { method, headers, body: payload, credentials: 'include', signal: opts.signal });
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') throw e;
    throw new ApiError({ status: 0, code: 'NETWORK_ERROR', title: 'Sem conexão', detail: errorCodeMessage.NETWORK_ERROR });
  }

  if (res.status === 401 && !opts.skipRefresh && !retried) {
    // Enviada antes de uma renovação que já terminou? Só repete com o cookie novo.
    if (sentAt < lastRefreshOkAt) return send(method, path, body, opts, true);
    const ok = await refreshSession();
    if (ok) return send(method, path, body, opts, true);
    if (!opts.silent401) emitUnauthorized();
  } else if (res.status === 401 && retried && !opts.silent401) {
    emitUnauthorized();
  }

  // CSRF inválido/expirado: renova o cookie e tenta uma vez.
  if (res.status === 403 && MUTATING.has(method) && !retried) {
    const clone = res.clone();
    let isCsrf = false;
    try { const p = await clone.json(); isCsrf = /csrf/i.test(`${p?.detail ?? ''} ${p?.title ?? ''} ${p?.code ?? ''}`); } catch { /* */ }
    if (isCsrf) { await ensureCsrf(true); return send(method, path, body, opts, true); }
  }
  return res;
}

async function request<T>(method: string, path: string, body?: Body, opts: RequestOptions = {}): Promise<T> {
  const res = await send(method, path, body, opts);
  if (!res.ok) throw await toApiError(res);
  if (res.status === 204 || res.status === 202 || res.headers.get('content-length') === '0') return undefined as T;
  const ct = res.headers.get('content-type') ?? '';
  if (ct.includes('json')) return (await res.json()) as T;
  return (await res.text()) as unknown as T;
}

export const api = {
  get: <T>(path: string, opts?: RequestOptions) => request<T>('GET', path, undefined, opts),
  post: <T>(path: string, body?: Body, opts?: RequestOptions) => request<T>('POST', path, body, opts),
  put: <T>(path: string, body?: Body, opts?: RequestOptions) => request<T>('PUT', path, body, opts),
  patch: <T>(path: string, body?: Body, opts?: RequestOptions) => request<T>('PATCH', path, body, opts),
  delete: <T = void>(path: string, opts?: RequestOptions) => request<T>('DELETE', path, undefined, opts),

  /** Upload multipart. `fields` vira FormData; File/Blob são anexados como arquivo. */
  upload: <T>(path: string, fields: Record<string, string | Blob | File>, opts?: RequestOptions) => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) fd.append(k, v);
    return request<T>('POST', path, fd, opts);
  },

  /** Baixa um recurso binário (ex.: CSV) e retorna Blob + nome sugerido. */
  async blob(path: string, opts: RequestOptions = {}): Promise<{ blob: Blob; filename: string | null }> {
    const res = await send('GET', path, undefined, { ...opts, headers: { Accept: '*/*', ...opts.headers } });
    if (!res.ok) throw await toApiError(res);
    const cd = res.headers.get('content-disposition') ?? '';
    const m = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(cd);
    return { blob: await res.blob(), filename: m ? decodeURIComponent(m[1]) : null };
  },
};

/** Dispara o download de um Blob no navegador. */
export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Gera uma chave de idempotência (UUID v4). Gere UMA por intenção do usuário, não por tentativa. */
export function newIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/** URL absoluta de foto servida pela API (`/api/photos/{id}`) — já vem pronta no DTO; helper p/ montar por id. */
export function photoUrl(id: string): string {
  return `${API_BASE}/photos/${encodeURIComponent(id)}`;
}
