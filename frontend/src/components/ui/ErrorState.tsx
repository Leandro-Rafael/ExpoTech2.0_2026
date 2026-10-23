import { CloudOff, RefreshCw, ServerCrash, ShieldAlert } from 'lucide-react';
import { ApiError, errorMessage } from '@/api/client';
import { Button } from './Button';
import { EmptyState } from './EmptyState';

export interface ErrorStateProps {
  error: unknown;
  onRetry?: () => void;
  title?: string;
  compact?: boolean;
  className?: string;
}

/** Erro de carregamento com mensagem PT e "Tentar novamente". `<ErrorState error={q.error} onRetry={q.refetch} />` */
export function ErrorState({ error, onRetry, title, compact, className }: ErrorStateProps) {
  const api = error instanceof ApiError ? error : null;
  const offline = api?.isNetwork || (api && api.status >= 500 && api.status !== 503 && !api.detail);
  const Icon = api?.isForbidden ? ShieldAlert : offline ? CloudOff : ServerCrash;
  const heading = title ?? (api?.isForbidden ? 'Acesso negado' : offline ? 'Servidor indisponível' : 'Não foi possível carregar');
  return (
    <EmptyState
      compact={compact}
      className={className}
      tone="danger"
      icon={Icon}
      title={heading}
      description={offline ? 'Não conseguimos falar com o servidor agora. Verifique sua conexão e tente de novo.' : errorMessage(error)}
      action={onRetry && <Button variant="secondary" leftIcon={RefreshCw} onClick={() => onRetry()}>Tentar novamente</Button>}
    />
  );
}
