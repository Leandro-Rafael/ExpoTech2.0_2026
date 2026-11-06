/** /api/auth — cadastro, login (com bloqueio após 5 falhas), refresh, logout, me. */
import type { UserMe } from '@/api/types';
import { banco, agoraIso, type RegistroUsuario } from '../db';
import { paraUsuarioLogado } from '../dto';
import { Validador, objetoDoCorpo, criado, falha, semConteudo, ok, lerTexto } from '../http';
import { registrarAuditoria, rotuloAutor } from '../logic/audit';
import { conferirSenha, hashDemo, validarSenha } from '../logic/password';
import { expirarBloqueioInspecao, restanteBloqueioInspecao } from '../logic/security';
import { limparSessao, usuarioAtual, emitirCookieCsrf, renovarSessao, idUsuarioDaSessao, iniciarSessao } from '../session';
import { rota } from '../server';

const MAX_LOGINS_FALHOS = 5;
const BLOQUEIO_MS = 15 * 60_000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function normalizarEmail(v: unknown): string {
  return typeof v === 'string' ? v.trim().toLowerCase() : '';
}

export function novoHashSenha(senha: string): string {
  return hashDemo(senha, crypto.randomUUID().slice(0, 8));
}

export function registrarRotasAuth() {
  rota('GET', '/auth/csrf', () => {
    emitirCookieCsrf();
    return semConteudo();
  }, { access: 'public' });

  rota('POST', '/auth/register', ({ body }) => {
    const d = banco();
    const b = objetoDoCorpo(body);
    const v = new Validador();
    const nome = lerTexto(b.name) ?? '';
    const email = normalizarEmail(b.email);
    v.check(nome.length >= 2, 'name', 'informe seu nome (mínimo 2 caracteres)');
    v.check(nome.length <= 80, 'name', 'o nome deve ter no máximo 80 caracteres');
    if (!email) v.add('email', 'informe o e-mail');
    else v.check(EMAIL_RE.test(email) && email.length <= 160, 'email', 'e-mail inválido');
    const erroSenha = validarSenha('password', b.password, email);
    if (erroSenha) v.add(erroSenha.field, erroSenha.message);
    v.throwIfAny();
    if (d.users.some((u) => u.email === email)) throw falha.conflict('Já existe uma conta cadastrada com este e-mail.');

    const agora = agoraIso();
    const usuario: RegistroUsuario = {
      id: crypto.randomUUID(), name: nome, email, passwordHash: novoHashSenha(String(b.password)), role: 'USER', enabled: true,
      failedLogins: 0, lockedUntil: null, householdId: null, organizationId: null, points: 0, totalEarned: 0, sessionEpoch: 0,
      createdAt: agora, lastLoginAt: agora,
    };
    d.users.push(usuario);
    iniciarSessao(usuario);
    registrarAuditoria(d, usuario, 'USER_REGISTERED', 'User', usuario.id, null);
    return criado<UserMe>(paraUsuarioLogado(d, usuario));
  }, { access: 'public' });

  rota('POST', '/auth/login', ({ body }) => {
    const d = banco();
    const b = objetoDoCorpo(body);
    const email = normalizarEmail(b.email);
    const senha = typeof b.password === 'string' ? b.password : '';
    const v = new Validador();
    v.check(!!email, 'email', 'informe o e-mail');
    v.check(!!senha, 'password', 'informe a senha');
    v.throwIfAny();

    const usuario = d.users.find((u) => u.email === email) ?? null;
    const agora = Date.now();
    if (usuario?.lockedUntil) {
      const restante = Date.parse(usuario.lockedUntil) - agora;
      if (restante > 0) throw falha.locked(restante / 1000);
      usuario.lockedUntil = null;
      usuario.failedLogins = 0;
    }
    if (!usuario || !conferirSenha(senha, usuario.passwordHash)) {
      registrarAuditoria(d, usuario ?? email, 'LOGIN_FAILED', 'User', usuario?.id ?? null, usuario ? 'senha incorreta' : 'e-mail não cadastrado');
      if (usuario) {
        usuario.failedLogins++;
        if (usuario.failedLogins >= MAX_LOGINS_FALHOS) {
          usuario.lockedUntil = new Date(agora + BLOQUEIO_MS).toISOString();
          usuario.failedLogins = 0;
          registrarAuditoria(d, usuario, 'ACCOUNT_LOCKED', 'User', usuario.id, 'bloqueio por 15 min');
          throw falha.locked(BLOQUEIO_MS / 1000);
        }
      }
      throw falha.badCredentials();
    }
    if (!usuario.enabled) {
      registrarAuditoria(d, usuario, 'LOGIN_DISABLED_ACCOUNT', 'User', usuario.id, null);
      throw falha.forbidden('Esta conta está desativada. Procure o administrador.');
    }
    // bloqueio por inspeção: só revelado depois da senha correta (não confirma contas a quem não tem a senha)
    expirarBloqueioInspecao(usuario);
    const restanteInspecao = restanteBloqueioInspecao(usuario);
    if (restanteInspecao > 0) throw falha.inspectionLocked(restanteInspecao / 1000);
    usuario.failedLogins = 0;
    usuario.lastLoginAt = agoraIso();
    iniciarSessao(usuario);
    registrarAuditoria(d, usuario, 'LOGIN_SUCCESS', 'User', usuario.id, null);
    return ok<UserMe>(paraUsuarioLogado(d, usuario));
  }, { access: 'public' });

  rota('POST', '/auth/refresh', () => {
    const d = banco();
    const sid = idUsuarioDaSessao();
    const usuarioDaSessao = sid ? d.users.find((u) => u.id === sid) : undefined;
    const restante = usuarioDaSessao ? restanteBloqueioInspecao(usuarioDaSessao) : 0;
    if (restante > 0) throw falha.inspectionLocked(restante / 1000);
    const usuario = renovarSessao(d);
    if (!usuario) throw falha.unauthorized('Sessão expirada. Faça login novamente.');
    return ok<UserMe>(paraUsuarioLogado(d, usuario));
  }, { access: 'public' });

  rota('POST', '/auth/logout', () => {
    const d = banco();
    const usuario = usuarioAtual(d);
    if (usuario) registrarAuditoria(d, rotuloAutor(usuario), 'LOGOUT', 'User', usuario.id, null);
    limparSessao();
    return semConteudo();
  }, { access: 'public' });

  rota('GET', '/auth/me', ({ me }) => ok<UserMe>(paraUsuarioLogado(banco(), me)));

  // Boot do SPA: 200 com sessão, 204 para visitante, 401 só se há "refresh token" (o cliente renova).
  rota('GET', '/auth/session', () => {
    const d = banco();
    const usuario = usuarioAtual(d);
    if (usuario) {
      const restante = restanteBloqueioInspecao(usuario);
      if (restante > 0) throw falha.inspectionLocked(restante / 1000);
      return ok<UserMe>(paraUsuarioLogado(d, usuario));
    }
    if (idUsuarioDaSessao()) throw falha.unauthorized('Sessão expirada. Faça login novamente.');
    return semConteudo();
  }, { access: 'public' });
}
