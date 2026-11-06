/** /api/me, /api/me/password, /api/organizations e /api/categories. */
import type { Category, Organization, UserMe } from '@/api/types';
import { banco } from '../db';
import { paraUsuarioLogado } from '../dto';
import { UUID_RE, Validador, objetoDoCorpo, falha, semConteudo, ok, lerTexto } from '../http';
import { registrarAuditoria } from '../logic/audit';
import { conferirSenha, validarSenha } from '../logic/password';
import { iniciarSessao } from '../session';
import { rota } from '../server';
import { novoHashSenha } from './auth';

export function registrarRotasPerfil() {
  rota('PATCH', '/me', ({ me, body }) => {
    const d = banco();
    const b = objetoDoCorpo(body);
    const v = new Validador();
    if ('name' in b && b.name !== undefined) {
      const nome = lerTexto(b.name) ?? '';
      if (v.check(nome.length >= 2 && nome.length <= 80, 'name', 'o nome deve ter entre 2 e 80 caracteres')) me.name = nome;
    }
    if ('organizationId' in b) {
      const id = b.organizationId;
      if (id === null) me.organizationId = null;
      else if (typeof id !== 'string' || !UUID_RE.test(id)) v.add('organizationId', 'organização inválida');
      else if (!d.organizations.some((o) => o.id === id)) v.add('organizationId', 'organização não encontrada');
      else me.organizationId = id;
    }
    v.throwIfAny();
    registrarAuditoria(d, me, 'PROFILE_UPDATED', 'User', me.id, null);
    return ok<UserMe>(paraUsuarioLogado(d, me));
  });

  rota('POST', '/me/password', ({ me, body }) => {
    const d = banco();
    const b = objetoDoCorpo(body);
    const atual = typeof b.currentPassword === 'string' ? b.currentPassword : '';
    if (!atual) throw falha.campo('currentPassword', 'informe a senha atual');
    if (!conferirSenha(atual, me.passwordHash)) throw falha.campo('currentPassword', 'senha atual incorreta');
    const erro = validarSenha('newPassword', b.newPassword, me.email);
    if (erro) throw falha.validation([erro]);
    if (conferirSenha(String(b.newPassword), me.passwordHash)) throw falha.campo('newPassword', 'a nova senha deve ser diferente da atual');
    me.passwordHash = novoHashSenha(String(b.newPassword));
    me.sessionEpoch++; // encerra as demais sessões
    iniciarSessao(me);
    registrarAuditoria(d, me, 'PASSWORD_CHANGED', 'User', me.id, 'demais sessões encerradas');
    return semConteudo();
  });

  rota('GET', '/organizations', () =>
    ok<Organization[]>([...banco().organizations].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')).map((o) => ({ ...o }))));

  rota('GET', '/categories', ({ user, query }) => {
    // `all=true` só vale para ADMIN (os demais recebem apenas as ativas)
    const todos = query.get('all') === 'true' && user?.role === 'ADMIN';
    const lista = banco().categories.filter((c) => todos || c.active);
    return ok<Category[]>(lista.map((c) => ({ ...c, guidance: [...c.guidance] })));
  }, { access: 'public' });
}
