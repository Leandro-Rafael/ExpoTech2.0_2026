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
import { mensagemCodigoErro } from '@/lib/labels';

const BASE_API = '/api';

type ValorConsulta = string | number | boolean | null | undefined;
type ParametrosConsulta = Record<string, ValorConsulta | ValorConsulta[]>;

export interface OpcoesRequisicao {
  query?: ParametrosConsulta;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  /** Envia o header Idempotency-Key (use `newIdempotencyKey()` uma vez por ação do usuário). */
  idempotencyKey?: string;
  /** Não tenta refresh em 401 (usado pelas próprias rotas de auth). */
  skipRefresh?: boolean;
  /** Não emite logout global em 401 (ex.: checagem inicial de sessão). */
  silent401?: boolean;
}

export interface ErroDeCampo { field: string; message: string }

/** Erro de API normalizado. Sempre é o que `throw` dos helpers deste módulo lança. */
export class ErroApi extends Error {
  readonly status: number;
  readonly code: string;
  readonly title: string;
  readonly detail: string | undefined;
  readonly fieldErrors: ErroDeCampo[];
  /** Segundos até poder tentar de novo (429). */
  readonly retryAfter: number | null;

  constructor(init: { status: number; code: string; title: string; detail?: string; fieldErrors?: ErroDeCampo[]; retryAfter?: number | null }) {
    super(init.detail || init.title);
    this.name = 'ApiError';
    this.status = init.status;
    this.code = init.code;
    this.title = init.title;
    this.detail = init.detail;
    this.fieldErrors = init.fieldErrors ?? [];
    this.retryAfter = init.retryAfter ?? null;
  }

  get ehErroDeRede() { return this.status === 0; }
  get ehValidacao() { return this.code === 'VALIDATION_ERROR' || this.fieldErrors.length > 0; }
  get ehNaoAutorizado() { return this.status === 401; }
  get ehProibido() { return this.status === 403; }
  get ehNaoEncontrado() { return this.status === 404; }
  get ehLimiteExcedido() { return this.status === 429; }

  /** Mapa field → mensagem. */
  mapaDeCampos(): Record<string, string> {
    return Object.fromEntries(this.fieldErrors.map((e) => [e.field, e.message]));
  }
}

/** Mensagem amigável em PT para qualquer erro (ApiError ou não). Use em toasts/ErrorState. */
export function mensagemDeErro(erro: unknown, padrao = 'Algo deu errado. Tente novamente.'): string {
  if (erro instanceof ErroApi) {
    if (erro.code === 'RATE_LIMITED' || erro.ehLimiteExcedido) return mensagemLimiteDeTentativas(erro.retryAfter);
    if (erro.code === 'ACCOUNT_LOCKED') return erro.detail ?? mensagemBloqueio(erro.retryAfter);
    if (erro.detail) return erro.detail;
    return mensagemCodigoErro[erro.code] ?? erro.title ?? padrao;
  }
  if (erro instanceof Error && erro.message) return erro.message;
  return padrao;
}

function mensagemLimiteDeTentativas(segundos: number | null): string {
  if (!segundos || segundos <= 0) return mensagemCodigoErro.RATE_LIMITED;
  if (segundos < 60) return `Muitas tentativas. Tente novamente em ${segundos} s.`;
  const min = Math.ceil(segundos / 60);
  return `Muitas tentativas. Tente novamente em ${min} min.`;
}

// ---------------------------------------------------------------- eventos

type Ouvinte = () => void;
const ouvintesLogout = new Set<Ouvinte>();

/** Assina o evento "sessão expirou/terminou" (o AuthProvider limpa o usuário). */
export function aoNaoAutorizado(fn: Ouvinte): () => void {
  ouvintesLogout.add(fn);
  return () => ouvintesLogout.delete(fn);
}
function emitirNaoAutorizado() { ouvintesLogout.forEach((fn) => fn()); }

type OuvinteBloqueio = (erro: ErroApi) => void;
const ouvintesBloqueio = new Set<OuvinteBloqueio>();

/** Assina respostas 423 ACCOUNT_LOCKED (o InspectionGuard mostra a tela de bloqueio dentro do app). */
export function aoBloquearConta(fn: OuvinteBloqueio): () => void {
  ouvintesBloqueio.add(fn);
  return () => ouvintesBloqueio.delete(fn);
}

// ---------------------------------------------------------------- CSRF

function lerCookie(nome: string): string | null {
  const encontrado = document.cookie.split('; ').find((c) => c.startsWith(`${nome}=`));
  return encontrado ? decodeURIComponent(encontrado.slice(nome.length + 1)) : null;
}

let promessaCsrf: Promise<void> | null = null;

/** Garante o cookie XSRF-TOKEN (GET /api/auth/csrf). Chamado no boot e antes de mutações se faltar. */
export function garantirCsrf(forcar = false): Promise<void> {
  if (!forcar && lerCookie('XSRF-TOKEN')) return Promise.resolve();
  if (!promessaCsrf || forcar) {
    promessaCsrf = fetch(`${BASE_API}/auth/csrf`, { credentials: 'include', headers: { Accept: 'application/json' } })
      .then(() => undefined)
      .catch(() => undefined)
      .finally(() => { promessaCsrf = null; });
  }
  return promessaCsrf;
}

// ---------------------------------------------------------------- refresh single-flight

let promessaRenovacao: Promise<boolean> | null = null;
/** Momento (performance.now) da última renovação bem-sucedida. */
let ultimaRenovacaoOkEm = -Infinity;

/**
 * Renova a sessão (POST /auth/refresh) com UMA promessa compartilhada: o back-end detecta
 * reuso do refresh token e encerra a sessão se duas renovações correrem em paralelo.
 * Requisições que receberam 401 mas foram ENVIADAS antes de uma renovação já concluída
 * apenas repetem (não renovam de novo) — ver `send()`.
 */
function renovarSessao(): Promise<boolean> {
  if (!promessaRenovacao) {
    promessaRenovacao = (async () => {
      try {
        await garantirCsrf();
        const res = await fetch(`${BASE_API}/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
          headers: { Accept: 'application/json', ...cabecalhosCsrf('POST') },
        });
        if (res.ok) ultimaRenovacaoOkEm = performance.now();
        return res.ok;
      } catch {
        return false;
      } finally {
        promessaRenovacao = null;
      }
    })();
  }
  return promessaRenovacao;
}

// ---------------------------------------------------------------- núcleo

const METODOS_QUE_ALTERAM = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function cabecalhosCsrf(metodo: string): Record<string, string> {
  if (!METODOS_QUE_ALTERAM.has(metodo)) return {};
  const token = lerCookie('XSRF-TOKEN');
  return token ? { 'X-XSRF-TOKEN': token } : {};
}

function montarUrl(caminho: string, query?: ParametrosConsulta): string {
  const url = caminho.startsWith('http') ? caminho : `${BASE_API}${caminho.startsWith('/') ? '' : '/'}${caminho}`;
  if (!query) return url;
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    const valores = Array.isArray(v) ? v : [v];
    for (const item of valores) {
      if (item === undefined || item === null || item === '') continue;
      sp.append(k, String(item));
    }
  }
  const qs = sp.toString();
  return qs ? `${url}?${qs}` : url;
}

async function paraErroApi(res: Response): Promise<ErroApi> {
  let problema: Partial<ApiProblem> = {};
  const ct = res.headers.get('content-type') ?? '';
  if (ct.includes('json')) {
    try { problema = await res.json(); } catch { /* corpo vazio */ }
  }
  const esperaBruta = res.headers.get('Retry-After');
  let esperaSegundos: number | null = null;
  if (esperaBruta) {
    const n = Number(esperaBruta);
    esperaSegundos = Number.isFinite(n) ? n : Math.max(0, Math.round((Date.parse(esperaBruta) - Date.now()) / 1000));
  }
  const codigo = problema.code ?? codigoPadrao(res.status);
  const erro = new ErroApi({
    status: res.status,
    code: codigo,
    title: problema.title ?? res.statusText ?? 'Erro',
    detail: codigo === 'RATE_LIMITED' || res.status === 429
      ? mensagemLimiteDeTentativas(esperaSegundos)
      : codigo === 'ACCOUNT_LOCKED'
        ? detalheBloqueio(problema.detail, esperaSegundos)
        : problema.detail ?? mensagemCodigoErro[codigo],
    fieldErrors: Array.isArray(problema.errors) ? problema.errors : [],
    retryAfter: esperaSegundos,
  });
  // 423: avisa o InspectionGuard para mostrar a tela de bloqueio.
  if (codigo === 'ACCOUNT_LOCKED') ouvintesBloqueio.forEach((fn) => fn(erro));
  return erro;
}

/** Mantém o motivo enviado pelo servidor (senha ou inspeção) e acrescenta o tempo restante se faltar. */
function detalheBloqueio(detalhe: string | undefined, segundos: number | null): string {
  if (!detalhe) return mensagemBloqueio(segundos);
  if (/tente novamente/i.test(detalhe) || !segundos || segundos <= 0) return detalhe;
  return `${detalhe} Tente novamente em ${Math.max(1, Math.ceil(segundos / 60))} min.`;
}

function mensagemBloqueio(segundos: number | null): string {
  if (!segundos || segundos <= 0) return mensagemCodigoErro.ACCOUNT_LOCKED;
  const min = Math.max(1, Math.ceil(segundos / 60));
  return `Conta bloqueada temporariamente por excesso de tentativas. Tente novamente em ${min} min.`;
}

/** Só usado quando o corpo não traz `code`. Sempre trate erros pelo `code`. */
function codigoPadrao(status: number): string {
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

type Corpo = unknown;

// Caminho de toda requisição. `retried` garante que ela se repete no máximo uma vez.
async function enviar(metodo: string, caminho: string, body: Corpo | undefined, opcoes: OpcoesRequisicao, repetida = false): Promise<Response> {
  // 1. Se a requisição altera dados, garante o cookie CSRF antes.
  if (METODOS_QUE_ALTERAM.has(metodo)) await garantirCsrf();

  // 2. Monta cabeçalhos (com o token CSRF) e o corpo: FormData para arquivo, JSON para o resto.
  const headers: Record<string, string> = { Accept: 'application/json', ...cabecalhosCsrf(metodo), ...opcoes.headers };
  let conteudo: BodyInit | undefined;
  if (body instanceof FormData) {
    conteudo = body; // o navegador define o boundary
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    conteudo = JSON.stringify(body);
  }
  if (opcoes.idempotencyKey) headers['Idempotency-Key'] = opcoes.idempotencyKey;

  // 3. Envia com os cookies de sessão; falha de rede vira ApiError NETWORK_ERROR.
  let res: Response;
  const enviadaEm = performance.now();
  try {
    res = await fetch(montarUrl(caminho, opcoes.query), { method: metodo, headers, body: conteudo, credentials: 'include', signal: opcoes.signal });
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') throw e;
    throw new ErroApi({ status: 0, code: 'NETWORK_ERROR', title: 'Sem conexão', detail: mensagemCodigoErro.NETWORK_ERROR });
  }

  // 4. 401: renova a sessão uma vez e repete; se não der, avisa o AuthProvider para deslogar.
  if (res.status === 401 && !opcoes.skipRefresh && !repetida) {
    // Enviada antes de uma renovação que já terminou? Só repete com o cookie novo.
    if (enviadaEm < ultimaRenovacaoOkEm) return enviar(metodo, caminho, body, opcoes, true);
    const renovou = await renovarSessao();
    if (renovou) return enviar(metodo, caminho, body, opcoes, true);
    if (!opcoes.silent401) emitirNaoAutorizado();
  } else if (res.status === 401 && repetida && !opcoes.silent401) {
    emitirNaoAutorizado();
  }

  // 5. 403 de CSRF vencido: pega um token novo e repete.
  // CSRF inválido/expirado: renova o cookie e tenta uma vez.
  if (res.status === 403 && METODOS_QUE_ALTERAM.has(metodo) && !repetida) {
    const copia = res.clone();
    let ehCsrf = false;
    try { const p = await copia.json(); ehCsrf = /csrf/i.test(`${p?.detail ?? ''} ${p?.title ?? ''} ${p?.code ?? ''}`); } catch { /* */ }
    if (ehCsrf) { await garantirCsrf(true); return enviar(metodo, caminho, body, opcoes, true); }
  }
  return res;
}

async function requisicao<T>(metodo: string, caminho: string, body?: Corpo, opcoes: OpcoesRequisicao = {}): Promise<T> {
  const res = await enviar(metodo, caminho, body, opcoes);
  if (!res.ok) throw await paraErroApi(res);
  if (res.status === 204 || res.status === 202 || res.headers.get('content-length') === '0') return undefined as T;
  const ct = res.headers.get('content-type') ?? '';
  if (ct.includes('json')) return (await res.json()) as T;
  return (await res.text()) as unknown as T;
}

export const api = {
  get: <T>(caminho: string, opcoes?: OpcoesRequisicao) => requisicao<T>('GET', caminho, undefined, opcoes),
  post: <T>(caminho: string, body?: Corpo, opcoes?: OpcoesRequisicao) => requisicao<T>('POST', caminho, body, opcoes),
  put: <T>(caminho: string, body?: Corpo, opcoes?: OpcoesRequisicao) => requisicao<T>('PUT', caminho, body, opcoes),
  patch: <T>(caminho: string, body?: Corpo, opcoes?: OpcoesRequisicao) => requisicao<T>('PATCH', caminho, body, opcoes),
  delete: <T = void>(caminho: string, opcoes?: OpcoesRequisicao) => requisicao<T>('DELETE', caminho, undefined, opcoes),

  /** Upload multipart. `fields` vira FormData; File/Blob são anexados como arquivo. */
  upload: <T>(caminho: string, campos: Record<string, string | Blob | File>, opcoes?: OpcoesRequisicao) => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(campos)) fd.append(k, v);
    return requisicao<T>('POST', caminho, fd, opcoes);
  },

  /** Baixa um recurso binário (ex.: CSV) e retorna Blob + nome sugerido. */
  async blob(caminho: string, opcoes: OpcoesRequisicao = {}): Promise<{ blob: Blob; filename: string | null }> {
    const res = await enviar('GET', caminho, undefined, { ...opcoes, headers: { Accept: '*/*', ...opcoes.headers } });
    if (!res.ok) throw await paraErroApi(res);
    const cd = res.headers.get('content-disposition') ?? '';
    const m = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(cd);
    return { blob: await res.blob(), filename: m ? decodeURIComponent(m[1]) : null };
  },
};

/** Dispara o download de um Blob no navegador. */
export function salvarArquivo(blob: Blob, nomeArquivo: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivo;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Gera uma chave de idempotência (UUID v4). Gere UMA por intenção do usuário, não por tentativa. */
export function novaChaveIdempotencia(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/** URL absoluta de foto servida pela API (`/api/photos/{id}`) — já vem pronta no DTO; helper p/ montar por id. */
export function urlFoto(id: string): string {
  return `${BASE_API}/photos/${encodeURIComponent(id)}`;
}
