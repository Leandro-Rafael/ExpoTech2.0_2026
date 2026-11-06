import { useState } from 'react';
import { useMinhasSolicitacoesColeta } from '@/api/queries';
import { CabecalhoPagina, PainelAba, Abas } from '@/components/ui';
import { Ecopontos } from '@/features/resident/map/Ecopoints';
import { MinhasSolicitacoes, FormularioSolicitacao } from '@/features/resident/map/Requests';

type Visao = 'points' | 'request' | 'mine';

export default function PaginaMapa() {
  const [visao, setVisao] = useState<Visao>('points');
  const solicitacoes = useMinhasSolicitacoesColeta();
  const abertas = solicitacoes.data?.filter((r) => r.status !== 'COLLECTED' && r.status !== 'CANCELLED').length ?? 0;
  return (
    <>
      <CabecalhoPagina sobretitulo="Mapa inteligente" title="Ecopontos e coletas"
        description="Encontre onde descartar cada material, veja horários e rotas — ou peça uma coleta na sua porta." />
      <Abas idBase="mp" aria-label="Seções do mapa" variant="underline" value={visao} onChange={setVisao} className="mb-6"
        itens={[
          { value: 'points', label: 'Ecopontos' },
          { value: 'request', label: 'Solicitar coleta' },
          { value: 'mine', label: 'Minhas solicitações', count: abertas || undefined },
        ]} />
      <PainelAba idBase="mp" value={visao}>
        {visao === 'points' && <Ecopontos />}
        {visao === 'request' && <FormularioSolicitacao aoCriar={() => setVisao('mine')} />}
        {visao === 'mine' && <MinhasSolicitacoes aoPedirNova={() => setVisao('request')} />}
      </PainelAba>
    </>
  );
}
