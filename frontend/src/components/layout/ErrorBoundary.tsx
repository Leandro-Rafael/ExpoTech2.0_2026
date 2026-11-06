// Se uma tela quebrar, mostra uma mensagem com botão de tentar de novo em vez de deixar a página em branco.
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { isRouteErrorResponse, useRouteError } from 'react-router';
import { Bug, RefreshCw } from 'lucide-react';
import { Botao, LinkBotao, EstadoVazio } from '@/components/ui';

interface PropsLimiteErro { children: ReactNode; chaveReinicio?: unknown; fallback?: ReactNode }
interface EstadoLimiteErro { erro: Error | null }

function ehErroDeVersao(e: unknown) {
  return e instanceof Error && /dynamically imported module|Importing a module script failed|Failed to fetch dynamically/i.test(e.message);
}

function TelaFalha({ erro, aoReiniciar }: { erro: unknown; aoReiniciar?: () => void }) {
  const novaVersao = ehErroDeVersao(erro);
  return (
    <EstadoVazio
      tone="danger"
      icon={Bug}
      title={novaVersao ? 'Nova versão disponível' : 'Algo saiu do lugar'}
      description={novaVersao
        ? 'O aplicativo foi atualizado. Recarregue a página para continuar.'
        : 'Um erro inesperado aconteceu nesta tela. Você pode tentar de novo ou voltar ao início.'}
      acao={
        <>
          <Botao variant="secondary" iconeEsquerda={RefreshCw} onClick={() => (novaVersao ? window.location.reload() : aoReiniciar ? aoReiniciar() : window.location.reload())}>
            {novaVersao ? 'Recarregar' : 'Tentar novamente'}
          </Botao>
          <LinkBotao to="/app" variant="ghost">Ir para o início</LinkBotao>
        </>
      }
    />
  );
}

/** Captura erros de renderização de uma árvore (reseta quando `resetKey` muda, ex.: rota). */
export class LimiteDeErro extends Component<PropsLimiteErro, EstadoLimiteErro> {
  state: EstadoLimiteErro = { erro: null };
  static getDerivedStateFromError(error: Error): EstadoLimiteErro { return { erro: error }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) console.error('[ErrorBoundary]', error, info.componentStack);
  }
  componentDidUpdate(prev: PropsLimiteErro) {
    if (this.state.erro && prev.chaveReinicio !== this.props.chaveReinicio) this.setState({ erro: null });
  }
  render() {
    if (this.state.erro) return this.props.fallback ?? <TelaFalha erro={this.state.erro} aoReiniciar={() => this.setState({ erro: null })} />;
    return this.props.children;
  }
}

/** errorElement das rotas (erros de roteamento/carregamento). */
export function PaginaErroRota() {
  const erro = useRouteError();
  if (isRouteErrorResponse(erro) && erro.status === 404) {
    return <div className="container-app py-20"><EstadoVazio title="Página não encontrada" description="O endereço acessado não existe." acao={<LinkBotao to="/">Voltar ao início</LinkBotao>} /></div>;
  }
  return <div className="container-app py-20"><TelaFalha erro={erro} /></div>;
}
