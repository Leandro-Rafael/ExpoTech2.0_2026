/**
 * Roteador + interceptador de `window.fetch` do modo demonstração.
 * Só trata requisições da mesma origem para `/api/...`; todo o resto segue para a rede normalmente.
 */
import type { Role } from '@/api/types';
import { banco, salvar } from './db';
import { ErroHttp, falha, type ContextoSimulado, type RequisicaoSimulada, type RespostaSimulada } from './http';
import { avancarLixeiras } from './logic/bins';
import { latenciaMs } from './logic/random';
import { restanteBloqueioInspecao } from './logic/security';
import { csrfValido, usuarioAtual, idUsuarioDaSessao } from './session';

/** `public` = sem login; `user` = qualquer usuário logado; demais = papéis permitidos. */
type Acesso = 'public' | 'user' | Role[];

interface DefinicaoRota {
  method: string;
  pattern: RegExp;
  keys: string[];
  access: Acesso;
  csrf: boolean;
  handler: (ctx: ContextoSimulado) => RespostaSimulada | Promise<RespostaSimulada>;
}

const rotas: DefinicaoRota[] = [];
const ISENTAS_DE_BLOQUEIO = new Set(['GET /api/auth/csrf', 'POST /api/auth/logout', 'POST /api/auth/register']);
const METODOS_QUE_ALTERAM = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export interface OpcoesRota { access?: Acesso; csrf?: boolean }

/** Registra uma rota. `path` relativo a /api, com parâmetros `:id`. */
export function rota(
  metodo: string,
  caminho: string,
  tratador: (ctx: ContextoSimulado) => RespostaSimulada | Promise<RespostaSimulada>,
  opcoes: OpcoesRota = {},
) {
  const chaves: string[] = [];
  const padrao = new RegExp(
    `^/api${caminho.replace(/\/:([A-Za-z]+)/g, (_m, k: string) => { chaves.push(k); return '/([^/]+)'; })}/?$`,
  );
  rotas.push({ method: metodo, pattern: padrao, keys: chaves, handler: tratador, access: opcoes.access ?? 'user', csrf: opcoes.csrf ?? true });
}

export const ADMIN: Role[] = ['ADMIN'];
export const COLETOR: Role[] = ['COLLECTOR', 'ADMIN'];

function respostaDeProblema(erro: ErroHttp): Response {
  return new Response(JSON.stringify(erro.toProblem()), {
    status: erro.status,
    headers: { 'Content-Type': 'application/problem+json', ...erro.headers },
  });
}

function paraResposta(r: RespostaSimulada): Response {
  if (r.status === 204 || r.status === 202) return new Response(null, { status: r.status, headers: r.headers });
  if (r.blob) return new Response(r.blob, { status: r.status, headers: { 'Content-Type': r.blob.type, ...r.headers } });
  return new Response(JSON.stringify(r.body ?? null), { status: r.status, headers: { 'Content-Type': 'application/json', ...r.headers } });
}

async function lerCorpo(req: Request): Promise<{ body: unknown; form: FormData | null }> {
  if (req.method === 'GET' || req.method === 'HEAD') return { body: undefined, form: null };
  const ct = req.headers.get('content-type') ?? '';
  if (ct.includes('multipart/form-data')) {
    const form = await req.formData();
    return { body: form, form };
  }
  const texto = await req.text();
  if (!texto) return { body: undefined, form: null };
  if (ct.includes('json')) {
    try {
      return { body: JSON.parse(texto), form: null };
    } catch {
      throw new ErroHttp(400, 'VALIDATION_ERROR', 'Dados inválidos', 'JSON malformado.');
    }
  }
  return { body: texto, form: null };
}

/** Despacha uma requisição para o handler correspondente. */
async function tratar(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const metodo = req.method.toUpperCase();
  try {
    // 1. Acha a rota registrada pelos handlers (404/405 se não existir).
    const candidatas = rotas.filter((r) => r.pattern.test(url.pathname));
    if (!candidatas.length) throw falha.notFound(`Rota ${url.pathname} não existe.`);
    const padrao = candidatas.find((r) => r.method === metodo);
    if (!padrao) throw falha.methodNotAllowed();

    const d = banco();
    const lixeirasMudaram = avancarLixeiras(d);
    const marcaEstado = () => `${d.audit.length}:${d.userBadges.length}:${d.transactions.length}:${d.collectionRequests.length}`;
    const antes = marcaEstado();

    // 2. Mesmas checagens do servidor real: CSRF, bloqueio por inspeção (423), login (401) e perfil (403).
    if (METODOS_QUE_ALTERAM.has(metodo) && padrao.csrf && !csrfValido(req.headers)) throw falha.csrf();

    const encontrado = padrao.pattern.exec(url.pathname)!;
    const params: Record<string, string> = {};
    padrao.keys.forEach((k, i) => { params[k] = decodeURIComponent(encontrado[i + 1]); });

    // Bloqueio por inspeção: toda rota autenticada responde 423 (exceto csrf e logout, para sair limpo)
    const sid = idUsuarioDaSessao();
    if (sid && !ISENTAS_DE_BLOQUEIO.has(`${metodo} ${url.pathname}`)) {
      const usuarioDaSessao = d.users.find((u) => u.id === sid);
      const restante = usuarioDaSessao ? restanteBloqueioInspecao(usuarioDaSessao) : 0;
      if (restante > 0 && url.pathname !== '/api/auth/login') throw falha.inspectionLocked(restante / 1000);
    }

    const me = usuarioAtual(d);
    if (padrao.access !== 'public') {
      if (!me) throw falha.unauthorized();
      if (Array.isArray(padrao.access) && !padrao.access.includes(me.role)) throw falha.forbidden();
    }

    // 3. Lê o corpo, executa o handler e salva o "banco" no localStorage se algo mudou.
    const { body, form } = await lerCorpo(req);
    const ctx: RequisicaoSimulada = { method: metodo, path: url.pathname, params, query: url.searchParams, headers: req.headers, body, form };
    const resultado = await padrao.handler({ ...ctx, me: me!, user: me });
    if (METODOS_QUE_ALTERAM.has(metodo) || lixeirasMudaram || marcaEstado() !== antes) salvar();
    return paraResposta(resultado);
  // 4. Erros viram a mesma resposta de erro (RFC 7807) que o back-end Java devolve.
  } catch (e) {
    if (e instanceof ErroHttp) {
      if (METODOS_QUE_ALTERAM.has(metodo)) salvar(); // ex.: contador de tentativas de login
      return respostaDeProblema(e);
    }
    console.error('[modo demonstração] erro no handler', e);
    return respostaDeProblema(new ErroHttp(500, 'INTERNAL_ERROR', 'Erro interno', 'Erro inesperado no servidor de demonstração.'));
  }
}

function esperar(ms: number, signal: AbortSignal | null | undefined): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(new DOMException('A operação foi abortada.', 'AbortError')); return; }
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => { clearTimeout(t); reject(new DOMException('A operação foi abortada.', 'AbortError')); }, { once: true });
  });
}

/** Substitui `window.fetch` (idempotente). */
let instalado = false;
export function instalarInterceptador() {
  if (instalado) return;
  instalado = true;
  const fetchReal = window.fetch.bind(window);

  window.fetch = async (entrada: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const bruto = entrada instanceof Request ? entrada.url : String(entrada);
    const url = new URL(bruto, location.href);
    // Só /api/ do próprio site é simulado; o resto (fontes, mapas) vai para a rede de verdade.
    if (url.origin !== location.origin || !url.pathname.startsWith('/api/')) return fetchReal(entrada, init);

    const req = new Request(entrada, init);
    await esperar(latenciaMs(), init?.signal ?? req.signal);
    const res = await tratar(req);
    if (import.meta.env.DEV) console.debug(`[mock] ${req.method} ${url.pathname}${url.search} → ${res.status}`);
    return res;
  };
}
