/**
 * Roteador + interceptador de `window.fetch` do modo demonstração.
 * Só trata requisições da mesma origem para `/api/...`; todo o resto segue para a rede normalmente.
 */
import type { Role } from '@/api/types';
import { db, save } from './db';
import { HttpError, fail, type MockContext, type MockRequest, type MockResponse } from './http';
import { tickBins } from './logic/bins';
import { latencyMs } from './logic/random';
import { csrfValid, currentUser } from './session';

/** `public` = sem login; `user` = qualquer usuário logado; demais = papéis permitidos. */
export type Access = 'public' | 'user' | Role[];

interface RouteDef {
  method: string;
  pattern: RegExp;
  keys: string[];
  access: Access;
  csrf: boolean;
  handler: (ctx: MockContext) => MockResponse | Promise<MockResponse>;
}

const routes: RouteDef[] = [];
const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export interface RouteOptions { access?: Access; csrf?: boolean }

/** Registra uma rota. `path` relativo a /api, com parâmetros `:id`. */
export function route(
  method: string,
  path: string,
  handler: (ctx: MockContext) => MockResponse | Promise<MockResponse>,
  opts: RouteOptions = {},
) {
  const keys: string[] = [];
  const pattern = new RegExp(
    `^/api${path.replace(/\/:([A-Za-z]+)/g, (_m, k: string) => { keys.push(k); return '/([^/]+)'; })}/?$`,
  );
  routes.push({ method, pattern, keys, handler, access: opts.access ?? 'user', csrf: opts.csrf ?? true });
}

export const ADMIN: Role[] = ['ADMIN'];
export const COLLECTOR: Role[] = ['COLLECTOR', 'ADMIN'];

function problemResponse(err: HttpError): Response {
  return new Response(JSON.stringify(err.toProblem()), {
    status: err.status,
    headers: { 'Content-Type': 'application/problem+json', ...err.headers },
  });
}

function toResponse(r: MockResponse): Response {
  if (r.status === 204 || r.status === 202) return new Response(null, { status: r.status, headers: r.headers });
  if (r.blob) return new Response(r.blob, { status: r.status, headers: { 'Content-Type': r.blob.type, ...r.headers } });
  return new Response(JSON.stringify(r.body ?? null), { status: r.status, headers: { 'Content-Type': 'application/json', ...r.headers } });
}

async function parseBody(req: Request): Promise<{ body: unknown; form: FormData | null }> {
  if (req.method === 'GET' || req.method === 'HEAD') return { body: undefined, form: null };
  const ct = req.headers.get('content-type') ?? '';
  if (ct.includes('multipart/form-data')) {
    const form = await req.formData();
    return { body: form, form };
  }
  const text = await req.text();
  if (!text) return { body: undefined, form: null };
  if (ct.includes('json')) {
    try {
      return { body: JSON.parse(text), form: null };
    } catch {
      throw new HttpError(400, 'VALIDATION_ERROR', 'Dados inválidos', 'JSON malformado.');
    }
  }
  return { body: text, form: null };
}

/** Despacha uma requisição para o handler correspondente. */
export async function handle(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const method = req.method.toUpperCase();
  try {
    const candidates = routes.filter((r) => r.pattern.test(url.pathname));
    if (!candidates.length) throw fail.notFound(`Rota ${url.pathname} não existe.`);
    const def = candidates.find((r) => r.method === method);
    if (!def) throw fail.methodNotAllowed();

    const d = db();
    const binsChanged = tickBins(d);
    const fingerprint = () => `${d.audit.length}:${d.userBadges.length}:${d.transactions.length}:${d.collectionRequests.length}`;
    const before = fingerprint();

    if (MUTATING.has(method) && def.csrf && !csrfValid(req.headers)) throw fail.csrf();

    const match = def.pattern.exec(url.pathname)!;
    const params: Record<string, string> = {};
    def.keys.forEach((k, i) => { params[k] = decodeURIComponent(match[i + 1]); });

    const me = currentUser(d);
    if (def.access !== 'public') {
      if (!me) throw fail.unauthorized();
      if (Array.isArray(def.access) && !def.access.includes(me.role)) throw fail.forbidden();
    }

    const { body, form } = await parseBody(req);
    const ctx: MockRequest = { method, path: url.pathname, params, query: url.searchParams, headers: req.headers, body, form };
    const result = await def.handler({ ...ctx, me: me!, user: me });
    if (MUTATING.has(method) || binsChanged || fingerprint() !== before) save();
    return toResponse(result);
  } catch (e) {
    if (e instanceof HttpError) {
      if (MUTATING.has(method)) save(); // ex.: contador de tentativas de login
      return problemResponse(e);
    }
    console.error('[modo demonstração] erro no handler', e);
    return problemResponse(new HttpError(500, 'INTERNAL_ERROR', 'Erro interno', 'Erro inesperado no servidor de demonstração.'));
  }
}

function wait(ms: number, signal: AbortSignal | null | undefined): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(new DOMException('A operação foi abortada.', 'AbortError')); return; }
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => { clearTimeout(t); reject(new DOMException('A operação foi abortada.', 'AbortError')); }, { once: true });
  });
}

/** Substitui `window.fetch` (idempotente). */
let installed = false;
export function installInterceptor() {
  if (installed) return;
  installed = true;
  const realFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const raw = input instanceof Request ? input.url : String(input);
    const url = new URL(raw, location.href);
    if (url.origin !== location.origin || !url.pathname.startsWith('/api/')) return realFetch(input, init);

    const req = new Request(input, init);
    await wait(latencyMs(), init?.signal ?? req.signal);
    const res = await handle(req);
    if (import.meta.env.DEV) console.debug(`[mock] ${req.method} ${url.pathname}${url.search} → ${res.status}`);
    return res;
  };
}
