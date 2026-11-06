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
import { ErroApi, aoBloquearConta } from '@/api/client';
import { apiSeguranca } from '@/api/security';
import type { InspectionEventResult, InspectionTrigger } from '@/api/types';
import { useAutenticacao } from '@/auth/AuthProvider';
import { Botao, Modal, toast } from '@/components/ui';
import { usePrenderFoco, useTravarRolagem } from '@/components/ui/useFocusTrap';
import { iniciarDetectorDevtools } from './devtoolsDetector';
import { salvarAvisoBloqueio } from './lockNotice';
import { atalhoDeInspecao } from './shortcuts';

const MAX_AVISOS = 3;
const JANELA_REPETICAO_MS = 5000;
const REENVIO_MS = 5000;
const AVISO_MENU_MS = 10_000;
const SAIDA_AUTOMATICA_MS = 5000;
const BLOQUEIO_PADRAO_S = 30 * 60;

export function VigiaInspecao() {
  const { user: usuario, logout: sair } = useAutenticacao();
  const navegar = useNavigate();
  const [aviso, setAviso] = useState<number | null>(null);
  const [bloqueadoAte, setBloqueadoAte] = useState<number | null>(null);

  const avisosConhecidos = useRef(usuario?.securityWarnings ?? 0);
  const ultimaContagemLocal = useRef(-Infinity);
  const bloqueadoRef = useRef(false);
  const reenvio = useRef<{ trigger: InspectionTrigger; timer: number; onOnline: () => void } | null>(null);

  const bloquear = useCallback((ate: number) => {
    if (bloqueadoRef.current) return;
    bloqueadoRef.current = true;
    salvarAvisoBloqueio(ate); // mesmo que a sessão caia antes, a tela de login mostra o motivo
    setAviso(null);
    setBloqueadoAte(ate);
  }, []);

  const aplicarResultado = useCallback((r: InspectionEventResult) => {
    avisosConhecidos.current = r.warnings;
    if (r.locked) {
      bloquear(r.lockedUntil ? Date.parse(r.lockedUntil) : Date.now() + BLOQUEIO_PADRAO_S * 1000);
    } else if (r.warnings > 0) {
      setAviso(r.warnings);
    }
  }, [bloquear]);

  const cancelarReenvio = useCallback(() => {
    if (!reenvio.current) return;
    window.clearTimeout(reenvio.current.timer);
    window.removeEventListener('online', reenvio.current.onOnline);
    reenvio.current = null;
  }, []);

  // Cada tentativa vai para o servidor, que conta os avisos e decide o bloqueio (o navegador só mostra o resultado).
  const informar = useCallback(async (gatilho: InspectionTrigger, ehReenvio = false) => {
    // 1. Se já está bloqueado, não manda mais nada.
    if (bloqueadoRef.current) return;
    try {
      // 2. Envia a tentativa e mostra "Aviso N de 3" ou a tela de bloqueio, conforme a resposta.
      aplicarResultado(await apiSeguranca.reportarInspecao(gatilho));
    } catch (e) {
      // 3. 423 = a conta já estava bloqueada.
      if (e instanceof ErroApi && e.code === 'ACCOUNT_LOCKED') {
        bloquear(Date.now() + (e.retryAfter ?? BLOQUEIO_PADRAO_S) * 1000);
        return;
      }
      if (ehReenvio) return;
      // 4. Sem resposta do servidor: avisa localmente e reenvia uma vez depois.
      // Falhou (sem rede?): avisa mesmo assim e tenta enviar UMA vez de novo.
      const agora = Date.now();
      if (agora - ultimaContagemLocal.current > JANELA_REPETICAO_MS) {
        ultimaContagemLocal.current = agora;
        avisosConhecidos.current = Math.min(MAX_AVISOS, avisosConhecidos.current + 1);
      }
      setAviso(Math.max(1, avisosConhecidos.current));
      if (!reenvio.current) {
        const executar = () => { cancelarReenvio(); void informar(gatilho, true); };
        reenvio.current = { trigger: gatilho, timer: window.setTimeout(executar, REENVIO_MS), onOnline: executar };
        window.addEventListener('online', executar, { once: true });
      }
    }
  }, [aplicarResultado, bloquear, cancelarReenvio]);

  // Atalhos (fase de captura: antes de qualquer outro handler) e menu de contexto.
  useEffect(() => {
    let ultimoAvisoMenu = -Infinity;
    const aoTeclar = (e: KeyboardEvent) => {
      const gatilho = atalhoDeInspecao(e);
      if (!gatilho) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.repeat) return; // tecla segurada: um único evento
      void informar(gatilho);
    };
    const aoAbrirMenu = (e: MouseEvent) => {
      e.preventDefault();
      const agora = Date.now();
      if (agora - ultimoAvisoMenu > AVISO_MENU_MS) {
        ultimoAvisoMenu = agora;
        toast.message('O menu de contexto está desativado nesta área.');
      }
    };
    window.addEventListener('keydown', aoTeclar, { capture: true });
    window.addEventListener('contextmenu', aoAbrirMenu, { capture: true });
    const pararDetector = iniciarDetectorDevtools(() => void informar('DEVTOOLS_OPEN'));
    const desligarBloqueio = aoBloquearConta((err) => bloquear(Date.now() + (err.retryAfter ?? BLOQUEIO_PADRAO_S) * 1000));
    return () => {
      window.removeEventListener('keydown', aoTeclar, { capture: true });
      window.removeEventListener('contextmenu', aoAbrirMenu, { capture: true });
      pararDetector();
      desligarBloqueio();
      cancelarReenvio();
    };
  }, [informar, bloquear, cancelarReenvio]);

  const sairDaConta = useCallback(async () => {
    await sair(); // POST /auth/logout continua permitido durante o bloqueio
    navegar('/entrar', { replace: true });
  }, [sair, navegar]);

  return (
    <>
      <Modal
        open={aviso !== null && bloqueadoAte === null}
        onClose={() => setAviso(null)}
        title="Não tente novamente"
        size="sm"
        fecharAoClicarFora={false}
        esconderFechar
        rodape={<Botao data-autofocus onClick={() => setAviso(null)}>Entendi</Botao>}
      >
        <div className="flex gap-3">
          <ShieldAlert className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
          <p className="text-sm leading-relaxed text-fg-soft">
            A inspeção do sistema não é permitida.{' '}
            <strong className="font-semibold text-fg">Aviso {aviso ?? 1} de {MAX_AVISOS}</strong> — no {MAX_AVISOS}º aviso
            seu acesso será bloqueado por 30 minutos.
          </p>
        </div>
      </Modal>
      {bloqueadoAte !== null && <TelaBloqueio ate={bloqueadoAte} aoSair={sairDaConta} />}
    </>
  );
}

function formatarRelogio(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function TelaBloqueio({ ate, aoSair }: { ate: number; aoSair: () => Promise<void> }) {
  const ref = useRef<HTMLDivElement>(null);
  const [agora, setAgora] = useState(() => Date.now());
  const [saindo, setSaindo] = useState(false);
  const jaSaiu = useRef(false);
  usePrenderFoco(ref, true);
  useTravarRolagem(true);

  const sairAgora = useCallback(() => {
    if (jaSaiu.current) return;
    jaSaiu.current = true;
    setSaindo(true);
    void aoSair();
  }, [aoSair]);

  useEffect(() => {
    const relogio = window.setInterval(() => setAgora(Date.now()), 1000);
    const automatico = window.setTimeout(sairAgora, SAIDA_AUTOMATICA_MS);
    return () => { window.clearInterval(relogio); window.clearTimeout(automatico); };
  }, [sairAgora]);

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
        <p className="mt-6 font-mono text-4xl tabular-nums text-fg" aria-live="off">{formatarRelogio(ate - agora)}</p>
        <p className="label-mono mt-1 text-subtle">tempo restante</p>
        <Botao variant="secondary" className="mt-7" larguraTotal carregando={saindo} onClick={sairAgora}>Sair agora</Botao>
      </div>
    </div>,
    document.body,
  );
}
