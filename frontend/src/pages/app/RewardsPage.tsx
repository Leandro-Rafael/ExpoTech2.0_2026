import { useMemo, useState } from 'react';
import { Gift, PackageX } from 'lucide-react';
import { mensagemDeErro } from '@/api';
import { useResgatarRecompensa, useResgates, useRecompensas } from '@/api/queries';
import type { Redemption, Reward } from '@/api/types';
import { useUsuario } from '@/auth/AuthProvider';
import { iconePorNome } from '@/components/icons';
import {
  Botao, DialogoConfirmacao, EstadoVazio, EstadoErro, Modal, CabecalhoPagina, BarraProgresso, EsqueletoTexto, PilulaStatus, toast,
} from '@/components/ui';
import { BotaoCopiar } from '@/features/resident/shared';
import { useContagemTexto } from '@/hooks/useCountUp';
import { cn } from '@/lib/cn';
import { formatarData, formatarNumero } from '@/lib/format';
import { statusResgate } from '@/lib/labels';

/** Catálogo e resgates na mesma tela: o código do voucher aparece no próprio item resgatado. */
export default function PaginaRecompensas() {
  const usuario = useUsuario();
  const recompensas = useRecompensas();
  const resgates = useResgates();
  const resgatar = useResgatarRecompensa();
  const [recompensaConfirmar, setRecompensaConfirmar] = useState<Reward | null>(null);
  const [cupom, setCupom] = useState<Redemption | null>(null);
  const refSaldo = useContagemTexto<HTMLSpanElement>(usuario.points, (v) => formatarNumero(v), { duration: 900 });

  // 1. Catálogo: só recompensas ativas, da mais barata para a mais cara; a próxima que o morador
  //    ainda não alcança vira a "meta" da barra de progresso.
  const catalogo = useMemo(() => [...(recompensas.data ?? [])].filter((r) => r.active).sort((a, b) => a.costPoints - b.costPoints), [recompensas.data]);
  const proximaMeta = catalogo.find((r) => r.costPoints > usuario.points && r.stock > 0);
  const disponiveis = catalogo.filter((r) => r.costPoints <= usuario.points && r.stock > 0).length;
  // 2. Códigos ainda válidos ficam no item do catálogo; o resto (usados ou de recompensas que saíram) vai para o histórico.
  const noCatalogo = new Set(catalogo.map((r) => r.id));
  const codigosAtivos = (idRecompensa: string) => (resgates.data ?? []).filter((r) => r.reward.id === idRecompensa && r.status === 'ISSUED');
  const anteriores = (resgates.data ?? []).filter((r) => r.status !== 'ISSUED' || !noCatalogo.has(r.reward.id));

  // 3. Resgate: depois da confirmação, o servidor desconta os pontos e gera o código do voucher,
  //    que aparece num modal e passa a ficar também no item do catálogo.
  const fazerResgate = () => {
    if (!recompensaConfirmar) return;
    resgatar.mutate(recompensaConfirmar.id, {
      onSuccess: (r) => { setRecompensaConfirmar(null); setCupom(r); toast.success('Resgate concluído!'); },
      onError: (e) => { setRecompensaConfirmar(null); toast.error(mensagemDeErro(e)); },
    });
  };

  return (
    <>
      <CabecalhoPagina sobretitulo="Recompensas" title="Troque pontos por benefícios reais"
        description="Parceiros locais oferecem descontos, ingressos e produtos sustentáveis. Depois do resgate, o código fica no próprio item, pronto para copiar." />

      <section aria-label="Saldo" className="mb-10 grid grid-cols-1 gap-6 border-y border-line py-6 sm:grid-cols-[auto_1fr] sm:items-center sm:gap-12">
        <div>
          <p className="label-mono">Seu saldo</p>
          <p className="mt-2 flex items-baseline gap-2">
            <span ref={refSaldo} className="font-mono text-[44px] leading-none font-medium tracking-[-0.04em] text-fg" />
            <span className="text-sm text-muted">pts</span>
          </p>
        </div>
        <div className="max-w-lg">
          {proximaMeta ? (
            <>
              <p className="text-sm text-fg-soft">
                Faltam <span className="font-mono text-fg tabular">{formatarNumero(proximaMeta.costPoints - usuario.points)} pts</span> para <span className="text-fg">{proximaMeta.name}</span>.
              </p>
              <BarraProgresso className="mt-2.5" value={usuario.points / proximaMeta.costPoints} rotuloValor={null} size="xs" />
              <p className="mt-2 text-xs text-subtle">{disponiveis > 0 ? `${disponiveis} ${disponiveis === 1 ? 'recompensa já está' : 'recompensas já estão'} ao seu alcance.` : 'Cada kg aprovado soma pontos ao seu saldo.'}</p>
            </>
          ) : (
            <p className="text-sm text-fg-soft">{catalogo.length ? 'Você já pode resgatar qualquer recompensa do catálogo.' : ' '}</p>
          )}
        </div>
      </section>

      {recompensas.isPending ? <EsqueletoTexto linhas={8} /> : recompensas.error ? <EstadoErro erro={recompensas.error} aoTentarDeNovo={recompensas.refetch} /> :
        catalogo.length === 0 ? <EstadoVazio icon={Gift} title="Catálogo vazio no momento" description="Novas recompensas de parceiros chegam em breve." /> : (
          <ul className="grid grid-cols-1 gap-x-12 lg:grid-cols-2">
            {catalogo.map((r) => <ItemRecompensa key={r.id} r={r} codigos={codigosAtivos(r.id)} saldo={usuario.points} aoResgatar={() => setRecompensaConfirmar(r)} />)}
          </ul>
        )}

      {anteriores.length > 0 && (
        <section aria-labelledby="past-h" className="mt-12">
          <h2 id="past-h" className="label-mono mb-2">Resgates anteriores</h2>
          <ul className="divide-y divide-line border-y border-line">
            {anteriores.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3.5">
                <p className="min-w-0 flex-1 text-sm text-fg">{r.reward.name}
                  <span className="ml-2 text-xs text-subtle">{formatarData(r.createdAt)} · <span className="font-mono tabular">{formatarNumero(r.cost)} pts</span></span>
                </p>
                <code className={cn('font-mono text-sm tracking-wider', r.status === 'ISSUED' ? 'text-fg' : 'text-subtle line-through')}>{r.code}</code>
                {r.status === 'ISSUED' && <BotaoCopiar value={r.code} />}
                <PilulaStatus mapa={statusResgate} value={r.status} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <DialogoConfirmacao
        open={!!recompensaConfirmar}
        onClose={() => !resgatar.isPending && setRecompensaConfirmar(null)}
        aoConfirmar={fazerResgate}
        carregando={resgatar.isPending}
        title={recompensaConfirmar ? `Resgatar ${recompensaConfirmar.name}?` : ''}
        description="Os pontos são descontados agora e o voucher é gerado na hora. Esta ação não pode ser desfeita."
        rotuloConfirmar="Confirmar resgate"
      >
        {recompensaConfirmar && (
          <dl className="mt-1 divide-y divide-line border-y border-line text-sm">
            <div className="flex justify-between py-2.5"><dt className="text-muted">Custo</dt><dd className="font-mono text-fg tabular">−{formatarNumero(recompensaConfirmar.costPoints)} pts</dd></div>
            <div className="flex justify-between py-2.5"><dt className="text-muted">Saldo depois</dt><dd className="font-mono text-fg tabular">{formatarNumero(usuario.points - recompensaConfirmar.costPoints)} pts</dd></div>
            {recompensaConfirmar.partner && <div className="flex justify-between py-2.5"><dt className="text-muted">Parceiro</dt><dd className="text-fg-soft">{recompensaConfirmar.partner}</dd></div>}
          </dl>
        )}
      </DialogoConfirmacao>

      <Modal open={!!cupom} onClose={() => setCupom(null)} title="Seu voucher está pronto" size="sm"
        description={cupom ? cupom.reward.name : undefined}
        rodape={<Botao onClick={() => setCupom(null)}>Concluir</Botao>}>
        {cupom && (
          <div className="text-center">
            <p className="label-mono">Código</p>
            <p className="mt-3 rounded-xl border border-dashed border-line-strong bg-bg-deep px-4 py-5 font-mono text-[26px] font-medium tracking-[0.12em] text-fg select-all">{cupom.code}</p>
            <div className="mt-3 flex justify-center"><BotaoCopiar value={cupom.code} label="Copiar código" size="md" /></div>
            <p className="mt-5 text-sm leading-relaxed text-muted">Apresente este código no parceiro. Ele fica no próprio item do catálogo até ser utilizado.</p>
          </div>
        )}
      </Modal>
    </>
  );
}

function ItemRecompensa({ r, codigos, saldo, aoResgatar }: { r: Reward; codigos: Redemption[]; saldo: number; aoResgatar: () => void }) {
  const Icone = iconePorNome(r.icon, Gift);
  const esgotado = r.stock <= 0;
  const alcancavel = saldo >= r.costPoints;
  const poucas = !esgotado && r.stock <= 5;
  const resgatada = codigos.length > 0;
  return (
    <li className="flex gap-4 border-b border-line py-5">
      <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl border border-line bg-surface-2 text-fg-soft">
        <Icone className="size-5" strokeWidth={1.6} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-[15px] font-semibold text-fg">{r.name}</h3>
            {r.partner && <p className="text-xs text-subtle">{r.partner}</p>}
          </div>
          <p className="shrink-0 font-mono text-[15px] text-fg tabular">{formatarNumero(r.costPoints)}<span className="ml-1 text-xs text-muted">pts</span></p>
        </div>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">{r.description}</p>

        {codigos.map((c) => (
          <div key={c.id} className="mt-3 flex items-center gap-2">
            <code className="rounded-lg border border-line bg-bg-deep px-3 py-1.5 font-mono text-sm tracking-wider text-fg">{c.code}</code>
            <BotaoCopiar value={c.code} label="Copiar código" />
          </div>
        ))}

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <span className={cn('font-mono text-xs tabular', esgotado ? 'text-danger' : poucas ? 'text-warning' : 'text-subtle')}>
            {esgotado ? 'Esgotado' : poucas ? `Últimas ${r.stock} unidades` : `${formatarNumero(r.stock)} em estoque`}
          </span>
          {esgotado ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-subtle"><PackageX className="size-3.5" aria-hidden />Volta em breve</span>
          ) : alcancavel ? (
            <Botao size="sm" variant={resgatada ? 'ghost' : 'secondary'} onClick={aoResgatar}>{resgatada ? 'Resgatar outro' : 'Resgatar'}</Botao>
          ) : (
            <span className="text-xs text-subtle">faltam <span className="font-mono text-fg-soft tabular">{formatarNumero(r.costPoints - saldo)}</span> pts</span>
          )}
        </div>
      </div>
    </li>
  );
}
