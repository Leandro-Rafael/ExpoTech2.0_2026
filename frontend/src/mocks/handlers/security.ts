/**
 * /api/security e rotas de segurança do admin — espelham o back-end:
 * avisos de inspeção (com bloqueio no 3º), desbloqueio de conta e relatório de integridade.
 */
import type { AdminUser, InspectionEventResult, InspectionTrigger, IntegrityReport } from '@/api/types';
import { db, nowIso } from '../db';
import { toAdminUser } from '../dto';
import { bodyObject, fail, ok } from '../http';
import { audit } from '../logic/audit';
import {
  INSPECTION_DEDUPE_MS, INSPECTION_LOCK_MS, MAX_INSPECTION_WARNINGS, expireInspectionLock, inspectionLockRemaining, inspectionResult,
} from '../logic/security';
import { ADMIN, route } from '../server';

const TRIGGERS: readonly InspectionTrigger[] = ['F12', 'CTRL_SHIFT_I', 'CTRL_SHIFT_J', 'CTRL_SHIFT_C', 'CTRL_U', 'CONTEXT_MENU', 'DEVTOOLS_OPEN'];

/** Só no modo demonstração: `__mockTamper()` simula uma linha adulterada no extrato; `__mockTamper(false)` desfaz. */
let tampered = false;

export function registerSecurityRoutes() {
  (window as Window & { __mockTamper?: (on?: boolean) => string }).__mockTamper = (on = true) => {
    tampered = on;
    return on ? 'Próxima verificação de integridade mostrará o extrato adulterado.' : 'Integridade restaurada.';
  };

  route('POST', '/security/inspection-events', ({ me, body }) => {
    const d = db();
    const b = bodyObject(body);
    if (!TRIGGERS.includes(b.trigger as InspectionTrigger)) throw fail.field('trigger', 'gatilho inválido');
    const now = Date.now();
    expireInspectionLock(me, now);
    if (inspectionLockRemaining(me, now) > 0) return ok<InspectionEventResult>(inspectionResult(me));
    const last = me.securityLastEventAt ? Date.parse(me.securityLastEventAt) : -Infinity;
    if (now - last < INSPECTION_DEDUPE_MS) return ok<InspectionEventResult>(inspectionResult(me)); // mesmo episódio

    const warnings = (me.securityWarnings ?? 0) + 1;
    me.securityWarnings = warnings;
    me.securityLastEventAt = nowIso();
    audit(d, me, 'SECURITY_INSPECTION_WARNING', 'User', me.id, `aviso ${warnings} de ${MAX_INSPECTION_WARNINGS} (${String(b.trigger)})`);
    if (warnings >= MAX_INSPECTION_WARNINGS) {
      me.securityLockedUntil = new Date(now + INSPECTION_LOCK_MS).toISOString();
      me.sessionEpoch++; // encerra todas as sessões
      audit(d, me, 'SECURITY_INSPECTION_LOCK', 'User', me.id, 'acesso bloqueado por 30 min; sessões encerradas');
    }
    return ok<InspectionEventResult>(inspectionResult(me));
  });

  route('POST', '/admin/users/:id/unlock', ({ me, params }) => {
    const d = db();
    const u = d.users.find((x) => x.id === params.id);
    if (!u) throw fail.notFound('Usuário não encontrado.');
    u.failedLogins = 0;
    u.lockedUntil = null;
    u.securityWarnings = 0;
    u.securityLockedUntil = null;
    u.securityLastEventAt = null;
    audit(d, me, 'USER_UNLOCKED', 'User', u.id, 'bloqueios e avisos de inspeção zerados');
    return ok<AdminUser>(toAdminUser(d, u));
  }, { access: ADMIN });

  route('GET', '/admin/integrity', () => {
    const d = db();
    const victim = d.transactions.at(-1);
    const report: IntegrityReport = {
      checkedAt: nowIso(),
      ledger: {
        ok: !(tampered && victim),
        rowsChecked: d.transactions.length,
        brokenAt: tampered && victim ? { table: 'point_transactions', id: victim.id, userId: victim.userId } : null,
      },
      audit: { ok: true, rowsChecked: d.audit.length, brokenAt: null },
      balances: { ok: !tampered, mismatches: tampered ? 1 : 0 },
    };
    return ok<IntegrityReport>(report);
  }, { access: ADMIN });
}
