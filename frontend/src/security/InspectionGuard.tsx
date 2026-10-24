/**
 * Dissuasão de inspeção na área logada (montado UMA vez no AppShell; landing, login e cadastro
 * não o carregam).
 *
 * - Atalhos F12, Ctrl/Cmd+Shift+I/J/C, Ctrl/Cmd+U (e Cmd+Option no mac) são bloqueados e informados
 *   ao servidor, que conta os avisos (eventos a menos de 5 s contam como um) e bloqueia no 3º.
 * - DevTools acoplado embaixo, aberto pelo menu, é detectado de forma conservadora (devtoolsDetector).
 * - Menu de contexto: bloqueado (remove o "Inspecionar"), mas NÃO conta aviso — clique direito
 *   acidental é comum, e contar geraria falso positivo; mostramos só um aviso discreto.
 * - 3º aviso (ou qualquer 423 ACCOUNT_LOCKED recebido dentro do app): tela de bloqueio com contagem
 *   regressiva e saída forçada para /entrar, que mostra o tempo restante.
 *
 * É dissuasão: quem desativar o JavaScript ou usar outro programa não é impedido. A regra que vale
 * (contagem, bloqueio de 30 min, sessões revogadas) é aplicada pelo servidor.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router';
import { Lock, ShieldAlert } from 'lucide-react';
import { ApiError, onAccountLocked } from '@/api/client';
import { securityApi } from '@/api/security';
import type { InspectionEventResult, InspectionTrigger } from '@/api/types';
import { useAuth } from '@/auth/AuthProvider';
import { Button, Modal, toast } from '@/components/ui';
import { useFocusTrap, useScrollLock } from '@/components/ui/useFocusTrap';
import { startDevtoolsDetector } from './devtoolsDetector';
import { saveLockNotice } from './lockNotice';
import { matchInspectionShortcut } from './shortcuts';

const MAX_WARNINGS = 3;
const DEDUPE_MS = 5000;
const RETRY_MS = 5000;
const CONTEXT_TOAST_MS = 10_000;
const AUTO_LOGOUT_MS = 5000;
const DEFAULT_LOCK_S = 30 * 60;

export function InspectionGuard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [warning, setWarning] = useState<number | null>(null);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);

  const known = useRef(user?.securityWarnings ?? 0);
  const lastLocalCount = useRef(-Infinity);
  const lockedRef = useRef(false);
  const retry = useRef<{ trigger: InspectionTrigger; timer: number; onOnline: () => void } | null>(null);

  const lock = useCallback((until: number) => {
    if (lockedRef.current) return;
    lockedRef.current = true;
    saveLockNotice(until); // mesmo que a sessão caia antes, a tela de login mostra o motivo
    setWarning(null);
    setLockedUntil(until);
  }, []);

  const applyResult = useCallback((r: InspectionEventResult) => {
    known.current = r.warnings;
    if (r.locked) {
      lock(r.lockedUntil ? Date.parse(r.lockedUntil) : Date.now() + DEFAULT_LOCK_S * 1000);
    } else if (r.warnings > 0) {
      setWarning(r.warnings);
    }
  }, [lock]);

  const clearRetry = useCallback(() => {
    if (!retry.current) return;
    window.clearTimeout(retry.current.timer);
    window.removeEventListener('online', retry.current.onOnline);
    retry.current = null;
  }, []);

  const report = useCallback(async (trigger: InspectionTrigger, isRetry = false) => {
    if (lockedRef.current) return;
    try {
      applyResult(await securityApi.reportInspection(trigger));
    } catch (e) {
      if (e instanceof ApiError && e.code === 'ACCOUNT_LOCKED') {
        lock(Date.now() + (e.retryAfter ?? DEFAULT_LOCK_S) * 1000);
        return;
      }
      if (isRetry) return;
      // Falhou (sem rede?): avisa mesmo assim e tenta enviar UMA vez de novo.
      const now = Date.now();
      if (now - lastLocalCount.current > DEDUPE_MS) {
        lastLocalCount.current = now;
        known.current = Math.min(MAX_WARNINGS, known.current + 1);
      }
      setWarning(Math.max(1, known.current));
      if (!retry.current) {
        const run = () => { clearRetry(); void report(trigger, true); };
        retry.current = { trigger, timer: window.setTimeout(run, RETRY_MS), onOnline: run };
        window.addEventListener('online', run, { once: true });
      }
    }
  }, [applyResult, lock, clearRetry]);

  // Atalhos (fase de captura: antes de qualquer outro handler) e menu de contexto.
  useEffect(() => {
    let lastContextToast = -Infinity;
    const onKeyDown = (e: KeyboardEvent) => {
      const trigger = matchInspectionShortcut(e);
      if (!trigger) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.repeat) return; // tecla segurada: um único evento
      void report(trigger);
    };
    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      const now = Date.now();
      if (now - lastContextToast > CONTEXT_TOAST_MS) {
        lastContextToast = now;
        toast.message('O menu de contexto está desativado nesta área.');
      }
    };
    window.addEventListener('keydown', onKeyDown, { capture: true });
    window.addEventListener('contextmenu', onContextMenu, { capture: true });
    const stopDetector = startDevtoolsDetector(() => void report('DEVTOOLS_OPEN'));
    const offLocked = onAccountLocked((err) => lock(Date.now() + (err.retryAfter ?? DEFAULT_LOCK_S) * 1000));
    return () => {
      window.removeEventListener('keydown', onKeyDown, { capture: true });
      window.removeEventListener('contextmenu', onContextMenu, { capture: true });
      stopDetector();
      offLocked();
      clearRetry();
    };
  }, [report, lock, clearRetry]);

  const signOut = useCallback(async () => {
    await logout(); // POST /auth/logout continua permitido durante o bloqueio
    navigate('/entrar', { replace: true });
  }, [logout, navigate]);

  return (
    <>
      <Modal
        open={warning !== null && lockedUntil === null}
        onClose={() => setWarning(null)}
        title="Não tente novamente"
        size="sm"
        closeOnBackdrop={false}
        hideClose
        footer={<Button data-autofocus onClick={() => setWarning(null)}>Entendi</Button>}
      >
        <div className="flex gap-3">
          <ShieldAlert className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
          <p className="text-sm leading-relaxed text-fg-soft">
            A inspeção do sistema não é permitida.{' '}
            <strong className="font-semibold text-fg">Aviso {warning ?? 1} de {MAX_WARNINGS}</strong> — no {MAX_WARNINGS}º aviso
            seu acesso será bloqueado por 30 minutos.
          </p>
        </div>
      </Modal>
      {lockedUntil !== null && <LockScreen until={lockedUntil} onSignOut={signOut} />}
    </>
  );
}

function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function LockScreen({ until, onSignOut }: { until: number; onSignOut: () => Promise<void> }) {
  const ref = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(() => Date.now());
  const [leaving, setLeaving] = useState(false);
  const left = useRef(false);
  useFocusTrap(ref, true);
  useScrollLock(true);

  const leave = useCallback(() => {
    if (left.current) return;
    left.current = true;
    setLeaving(true);
    void onSignOut();
  }, [onSignOut]);

  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    const auto = window.setTimeout(leave, AUTO_LOGOUT_MS);
    return () => { window.clearInterval(tick); window.clearTimeout(auto); };
  }, [leave]);

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-bg p-4">
      <div
        ref={ref}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="inspection-lock-title"
        aria-describedby="inspection-lock-desc"
        tabIndex={-1}
        className="w-full max-w-md rounded-2xl border border-danger/30 bg-surface p-6 text-center outline-none sm:p-8"
      >
        <span className="mx-auto flex size-12 items-center justify-center rounded-xl bg-danger/10 text-danger">
          <Lock className="size-6" aria-hidden />
        </span>
        <h2 id="inspection-lock-title" className="mt-5 text-2xl text-fg">Acesso bloqueado por 30 minutos</h2>
        <p id="inspection-lock-desc" className="mt-3 text-sm leading-relaxed text-muted">
          Detectamos três tentativas de inspeção do sistema. Por segurança, sua sessão foi encerrada e o acesso
          ficará bloqueado até o fim do prazo.
        </p>
        <p className="mt-6 font-mono text-4xl tabular-nums text-fg" aria-live="off">{formatClock(until - now)}</p>
        <p className="label-mono mt-1 text-subtle">tempo restante</p>
        <Button variant="secondary" className="mt-7" fullWidth loading={leaving} onClick={leave}>Sair agora</Button>
      </div>
    </div>,
    document.body,
  );
}
