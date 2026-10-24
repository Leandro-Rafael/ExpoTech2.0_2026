import type { ReactNode } from 'react';
import { AlertTriangle, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from './Button';
import { Modal } from './Modal';

export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** danger: ação destrutiva (botão vermelho + ícone de alerta). */
  tone?: 'default' | 'danger';
  loading?: boolean;
  /** Conteúdo extra (ex.: campo "motivo da recusa"). */
  children?: ReactNode;
  confirmDisabled?: boolean;
}

/** Confirmação de ação. `<ConfirmDialog tone="danger" title="Excluir lixeira?" onConfirm={...} />` */
export function ConfirmDialog({
  open, onClose, onConfirm, title, description, confirmLabel = 'Confirmar', cancelLabel = 'Cancelar',
  tone = 'default', loading, children, confirmDisabled,
}: ConfirmDialogProps) {
  const Icon = tone === 'danger' ? AlertTriangle : HelpCircle;
  return (
    <Modal
      open={open}
      onClose={loading ? () => {} : onClose}
      size="sm"
      hideClose
      title={
        <span className="flex items-center gap-3">
          <span className={cn('inline-flex size-10 items-center justify-center rounded-xl', tone === 'danger' ? 'bg-danger/10 text-danger' : 'border border-line text-fg-soft')}>
            <Icon className="size-5" aria-hidden />
          </span>
          {title}
        </span>
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>{cancelLabel}</Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm} loading={loading} disabled={confirmDisabled} data-autofocus>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {description && <p className="text-sm leading-relaxed text-fg-soft">{description}</p>}
      {children && <div className={cn(description && 'mt-4')}>{children}</div>}
    </Modal>
  );
}
