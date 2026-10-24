/** /api/me, /api/me/password, /api/organizations e /api/categories. */
import type { Category, Organization, UserMe } from '@/api/types';
import { db } from '../db';
import { toUserMe } from '../dto';
import { UUID_RE, Validator, bodyObject, fail, noContent, ok, str } from '../http';
import { audit } from '../logic/audit';
import { checkPassword, validatePassword } from '../logic/password';
import { startSession } from '../session';
import { route } from '../server';
import { newPasswordHash } from './auth';

export function registerProfileRoutes() {
  route('PATCH', '/me', ({ me, body }) => {
    const d = db();
    const b = bodyObject(body);
    const v = new Validator();
    if ('name' in b && b.name !== undefined) {
      const name = str(b.name) ?? '';
      if (v.check(name.length >= 2 && name.length <= 80, 'name', 'o nome deve ter entre 2 e 80 caracteres')) me.name = name;
    }
    if ('organizationId' in b) {
      const id = b.organizationId;
      if (id === null) me.organizationId = null;
      else if (typeof id !== 'string' || !UUID_RE.test(id)) v.add('organizationId', 'organização inválida');
      else if (!d.organizations.some((o) => o.id === id)) v.add('organizationId', 'organização não encontrada');
      else me.organizationId = id;
    }
    v.throwIfAny();
    audit(d, me, 'PROFILE_UPDATED', 'User', me.id, null);
    return ok<UserMe>(toUserMe(d, me));
  });

  route('POST', '/me/password', ({ me, body }) => {
    const d = db();
    const b = bodyObject(body);
    const current = typeof b.currentPassword === 'string' ? b.currentPassword : '';
    if (!current) throw fail.field('currentPassword', 'informe a senha atual');
    if (!checkPassword(current, me.passwordHash)) throw fail.field('currentPassword', 'senha atual incorreta');
    const err = validatePassword('newPassword', b.newPassword, me.email);
    if (err) throw fail.validation([err]);
    if (checkPassword(String(b.newPassword), me.passwordHash)) throw fail.field('newPassword', 'a nova senha deve ser diferente da atual');
    me.passwordHash = newPasswordHash(String(b.newPassword));
    me.sessionEpoch++; // encerra as demais sessões
    startSession(me);
    audit(d, me, 'PASSWORD_CHANGED', 'User', me.id, 'demais sessões encerradas');
    return noContent();
  });

  route('GET', '/organizations', () =>
    ok<Organization[]>([...db().organizations].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')).map((o) => ({ ...o }))));

  route('GET', '/categories', ({ user, query }) => {
    // `all=true` só vale para ADMIN (os demais recebem apenas as ativas)
    const all = query.get('all') === 'true' && user?.role === 'ADMIN';
    const list = db().categories.filter((c) => all || c.active);
    return ok<Category[]>(list.map((c) => ({ ...c, guidance: [...c.guidance] })));
  }, { access: 'public' });
}
