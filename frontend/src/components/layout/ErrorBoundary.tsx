import { Component, type ErrorInfo, type ReactNode } from 'react';
import { isRouteErrorResponse, useRouteError } from 'react-router';
import { Bug, RefreshCw } from 'lucide-react';
import { Button, ButtonLink, EmptyState } from '@/components/ui';

interface Props { children: ReactNode; resetKey?: unknown; fallback?: ReactNode }
interface State { error: Error | null }

function isChunkError(e: unknown) {
  return e instanceof Error && /dynamically imported module|Importing a module script failed|Failed to fetch dynamically/i.test(e.message);
}

function CrashScreen({ error, onReset }: { error: unknown; onReset?: () => void }) {
  const chunk = isChunkError(error);
  return (
    <EmptyState
      tone="danger"
      icon={Bug}
      title={chunk ? 'Nova versão disponível' : 'Algo saiu do lugar'}
      description={chunk
        ? 'O aplicativo foi atualizado. Recarregue a página para continuar.'
        : 'Um erro inesperado aconteceu nesta tela. Você pode tentar de novo ou voltar ao início.'}
      action={
        <>
          <Button variant="secondary" leftIcon={RefreshCw} onClick={() => (chunk ? window.location.reload() : onReset ? onReset() : window.location.reload())}>
            {chunk ? 'Recarregar' : 'Tentar novamente'}
          </Button>
          <ButtonLink to="/app" variant="ghost">Ir para o início</ButtonLink>
        </>
      }
    />
  );
}

/** Captura erros de renderização de uma árvore (reseta quando `resetKey` muda, ex.: rota). */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };
  static getDerivedStateFromError(error: Error): State { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) console.error('[ErrorBoundary]', error, info.componentStack);
  }
  componentDidUpdate(prev: Props) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }
  render() {
    if (this.state.error) return this.props.fallback ?? <CrashScreen error={this.state.error} onReset={() => this.setState({ error: null })} />;
    return this.props.children;
  }
}

/** errorElement das rotas (erros de roteamento/carregamento). */
export function RouteErrorPage() {
  const error = useRouteError();
  if (isRouteErrorResponse(error) && error.status === 404) {
    return <div className="container-app py-20"><EmptyState title="Página não encontrada" description="O endereço acessado não existe." action={<ButtonLink to="/">Voltar ao início</ButtonLink>} /></div>;
  }
  return <div className="container-app py-20"><CrashScreen error={error} /></div>;
}
