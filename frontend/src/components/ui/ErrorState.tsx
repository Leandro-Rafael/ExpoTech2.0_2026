import { CloudOff, RefreshCw, ServerCrash, ShieldAlert } from 'lucide-react';
import { ErroApi, mensagemDeErro } from '@/api/client';
import { Botao } from './Button';
import { EstadoVazio } from './EmptyState';

export interface PropsEstadoErro {
  erro: unknown;
  aoTentarDeNovo?: () => void;
  title?: string;
  compacto?: boolean;
  className?: string;
}

/** Erro de carregamento com mensagem PT e "Tentar novamente". `<ErrorState error={q.error} onRetry={q.refetch} />` */
export function EstadoErro({ erro, aoTentarDeNovo, title, compacto, className }: PropsEstadoErro) {
  const api = erro instanceof ErroApi ? erro : null;
  const semConexao = api?.ehErroDeRede || (api && api.status >= 500 && api.status !== 503 && !api.detail);
  const Icone = api?.ehProibido ? ShieldAlert : semConexao ? CloudOff : ServerCrash;
  const titulo = title ?? (api?.ehProibido ? 'Acesso negado' : semConexao ? 'Servidor indisponível' : 'Não foi possível carregar');
  return (
    <EstadoVazio
      compacto={compacto}
      className={className}
      tone="danger"
      icon={Icone}
      title={titulo}
      description={semConexao ? 'Não conseguimos falar com o servidor agora. Verifique sua conexão e tente de novo.' : mensagemDeErro(erro)}
      acao={aoTentarDeNovo && <Botao variant="secondary" iconeEsquerda={RefreshCw} onClick={() => aoTentarDeNovo()}>Tentar novamente</Botao>}
    />
  );
}
