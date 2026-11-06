/**
 * /api/security e rotas de segurança do admin — espelham o back-end:
 * avisos de inspeção (com bloqueio no 3º), desbloqueio de conta e relatório de integridade.
 */
import type { AdminUser, InspectionEventResult, InspectionTrigger, IntegrityReport } from '@/api/types';
import { banco, agoraIso } from '../db';
import { paraUsuarioAdmin } from '../dto';
import { objetoDoCorpo, falha, ok } from '../http';
import { registrarAuditoria } from '../logic/audit';
import {
  JANELA_AVISO_INSPECAO_MS, BLOQUEIO_INSPECAO_MS, MAX_AVISOS_INSPECAO, expirarBloqueioInspecao, restanteBloqueioInspecao, resultadoInspecao,
} from '../logic/security';
import { ADMIN, rota } from '../server';

const GATILHOS: readonly InspectionTrigger[] = ['F12', 'CTRL_SHIFT_I', 'CTRL_SHIFT_J', 'CTRL_SHIFT_C', 'CTRL_U', 'CONTEXT_MENU', 'DEVTOOLS_OPEN'];

/** Só no modo demonstração: `__mockTamper()` simula uma linha adulterada no extrato; `__mockTamper(false)` desfaz. */
let adulterado = false;

export function registrarRotasSeguranca() {
  (window as Window & { __mockTamper?: (ligar?: boolean) => string }).__mockTamper = (on = true) => {
    adulterado = on;
    return on ? 'Próxima verificação de integridade mostrará o extrato adulterado.' : 'Integridade restaurada.';
  };

  rota('POST', '/security/inspection-events', ({ me, body }) => {
    const d = banco();
    const b = objetoDoCorpo(body);
    if (!GATILHOS.includes(b.trigger as InspectionTrigger)) throw falha.campo('trigger', 'gatilho inválido');
    const agora = Date.now();
    expirarBloqueioInspecao(me, agora);
    if (restanteBloqueioInspecao(me, agora) > 0) return ok<InspectionEventResult>(resultadoInspecao(me));
    const ultimo = me.securityLastEventAt ? Date.parse(me.securityLastEventAt) : -Infinity;
    if (agora - ultimo < JANELA_AVISO_INSPECAO_MS) return ok<InspectionEventResult>(resultadoInspecao(me)); // mesmo episódio

    const avisos = (me.securityWarnings ?? 0) + 1;
    me.securityWarnings = avisos;
    me.securityLastEventAt = agoraIso();
    registrarAuditoria(d, me, 'SECURITY_INSPECTION_WARNING', 'User', me.id, `aviso ${avisos} de ${MAX_AVISOS_INSPECAO} (${String(b.trigger)})`);
    if (avisos >= MAX_AVISOS_INSPECAO) {
      me.securityLockedUntil = new Date(agora + BLOQUEIO_INSPECAO_MS).toISOString();
      me.sessionEpoch++; // encerra todas as sessões
      registrarAuditoria(d, me, 'SECURITY_INSPECTION_LOCK', 'User', me.id, 'acesso bloqueado por 30 min; sessões encerradas');
    }
    return ok<InspectionEventResult>(resultadoInspecao(me));
  });

  rota('POST', '/admin/users/:id/unlock', ({ me, params }) => {
    const d = banco();
    const u = d.users.find((x) => x.id === params.id);
    if (!u) throw falha.notFound('Usuário não encontrado.');
    u.failedLogins = 0;
    u.lockedUntil = null;
    u.securityWarnings = 0;
    u.securityLockedUntil = null;
    u.securityLastEventAt = null;
    registrarAuditoria(d, me, 'USER_UNLOCKED', 'User', u.id, 'bloqueios e avisos de inspeção zerados');
    return ok<AdminUser>(paraUsuarioAdmin(d, u));
  }, { access: ADMIN });

  rota('GET', '/admin/integrity', () => {
    const d = banco();
    const vitima = d.transactions.at(-1);
    const relatorio: IntegrityReport = {
      checkedAt: agoraIso(),
      ledger: {
        ok: !(adulterado && vitima),
        rowsChecked: d.transactions.length,
        brokenAt: adulterado && vitima ? { table: 'point_transactions', id: vitima.id, userId: vitima.userId } : null,
      },
      audit: { ok: true, rowsChecked: d.audit.length, brokenAt: null },
      balances: { ok: !adulterado, mismatches: adulterado ? 1 : 0 },
    };
    return ok<IntegrityReport>(relatorio);
  }, { access: ADMIN });
}
