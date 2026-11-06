import type { ReactNode } from 'react';
import { AlertTriangle, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Botao } from './Button';
import { Modal } from './Modal';

export interface PropsDialogoConfirmacao {
  open: boolean;
  onClose: () => void;
  aoConfirmar: () => void;
  title: ReactNode;
  description?: ReactNode;
  rotuloConfirmar?: string;
  rotuloCancelar?: string;
  /** danger: ação destrutiva (botão vermelho + ícone de alerta). */
  tone?: 'default' | 'danger';
  carregando?: boolean;
  /** Conteúdo extra (ex.: campo "motivo da recusa"). */
  children?: ReactNode;
  confirmarDesativado?: boolean;
}

/** Confirmação de ação. `<ConfirmDialog tone="danger" title="Excluir lixeira?" onConfirm={...} />` */
export function DialogoConfirmacao({
  open, onClose, aoConfirmar, title, description, rotuloConfirmar = 'Confirmar', rotuloCancelar = 'Cancelar',
  tone = 'default', carregando, children, confirmarDesativado,
}: PropsDialogoConfirmacao) {
  const Icone = tone === 'danger' ? AlertTriangle : HelpCircle;
  return (
    <Modal
      open={open}
      onClose={carregando ? () => {} : onClose}
      size="sm"
      esconderFechar
      title={
        <span className="flex items-center gap-3">
          <span className={cn('inline-flex size-10 items-center justify-center rounded-xl', tone === 'danger' ? 'bg-danger/10 text-danger' : 'border border-line text-fg-soft')}>
            <Icone className="size-5" aria-hidden />
          </span>
          {title}
        </span>
      }
      rodape={
        <>
          <Botao variant="ghost" onClick={onClose} disabled={carregando}>{rotuloCancelar}</Botao>
          <Botao variant={tone === 'danger' ? 'danger' : 'primary'} onClick={aoConfirmar} carregando={carregando} disabled={confirmarDesativado} data-autofocus>
            {rotuloConfirmar}
          </Botao>
        </>
      }
    >
      {description && <p className="text-sm leading-relaxed text-fg-soft">{description}</p>}
      {children && <div className={cn(description && 'mt-4')}>{children}</div>}
    </Modal>
  );
}
