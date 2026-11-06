import { CheckCircle2, RefreshCw, ShieldAlert, ShieldCheck, XCircle } from 'lucide-react';
import { ErroApi, mensagemDeErro } from '@/api/client';
import { useRelatorioIntegridade } from '@/api/security';
import type { IntegrityBreak } from '@/api/types';
import { Botao, Esqueleto } from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatarDataHora, formatarNumero, formatarRelativo } from '@/lib/format';

const TABELAS: Record<IntegrityBreak['table'], string> = { point_transactions: 'extrato de pontos', audit_log: 'auditoria', users: 'usuários' };

/** Selo de integridade: cadeia HMAC do extrato e da auditoria + conferência de saldos. Roda sob demanda. */
export function CartaoIntegridade() {
  const q = useRelatorioIntegridade();
  const r = q.data;
  const tudoOk = r ? r.ledger.ok && r.audit.ok && r.balances.ok : null;
  const limiteAtingido = q.error instanceof ErroApi && (q.error.status === 429 || q.error.code === 'RATE_LIMITED');

  const linhas: { label: string; detalhe: string; ok: boolean; quebraEm?: IntegrityBreak | null }[] = r ? [
    { label: 'Extrato de pontos', detalhe: `${formatarNumero(r.ledger.rowsChecked)} lançamentos na cadeia`, ok: r.ledger.ok, quebraEm: r.ledger.brokenAt },
    { label: 'Auditoria', detalhe: `${formatarNumero(r.audit.rowsChecked)} eventos na cadeia`, ok: r.audit.ok, quebraEm: r.audit.brokenAt },
    { label: 'Saldos', detalhe: r.balances.ok ? 'Saldo de cada usuário = soma do extrato' : `${formatarNumero(r.balances.mismatches)} ${r.balances.mismatches === 1 ? 'saldo diverge' : 'saldos divergem'} do extrato`, ok: r.balances.ok },
  ] : [];

  return (
    <section aria-labelledby="int-title" className={cn('surface rounded-2xl', tudoOk === false && 'border-danger/40')}>
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
        <div className="flex items-start gap-3.5">
          <span className={cn('inline-flex size-10 shrink-0 items-center justify-center rounded-xl border',
            tudoOk === false ? 'border-danger/40 text-danger' : tudoOk ? 'border-success/35 text-success' : 'border-line-strong text-fg-soft')}>
            {tudoOk === false ? <ShieldAlert className="size-5" aria-hidden /> : <ShieldCheck className="size-5" aria-hidden />}
          </span>
          <div className="min-w-0">
            <h3 id="int-title" className="text-[15px] font-semibold text-fg">Integridade dos dados</h3>
            <p className="mt-0.5 max-w-[62ch] text-[13px] leading-relaxed text-muted" aria-live="polite">
              {q.isFetching ? 'Verificando a cadeia de registros…'
                : limiteAtingido ? `Verificação recente demais. Aguarde ${q.error instanceof ErroApi && q.error.retryAfter ? `${q.error.retryAfter}s` : 'alguns segundos'} e tente de novo.`
                  : q.error ? mensagemDeErro(q.error)
                    : !r ? 'Cada lançamento de pontos e de auditoria é encadeado com uma assinatura HMAC. Se alguém alterar um registro direto no banco, a cadeia quebra e aparece aqui.'
                      : tudoOk ? <>Tudo íntegro. Verificado {formatarRelativo(r.checkedAt)} <span className="font-mono text-[12px] text-subtle tabular">({formatarDataHora(r.checkedAt)})</span>.</>
                        : <span className="text-danger">Foram encontradas inconsistências: um registro foi alterado fora do sistema. Verificado {formatarRelativo(r.checkedAt)}.</span>}
            </p>
          </div>
        </div>
        <Botao variant="secondary" size="sm" iconeEsquerda={RefreshCw} carregando={q.isFetching} onClick={() => q.refetch()} className="shrink-0">
          {r ? 'Verificar de novo' : 'Verificar agora'}
        </Botao>
      </div>

      {(r || q.isFetching) && (
        <ul className="divide-y divide-line border-t border-line">
          {!r ? Array.from({ length: 3 }, (_, i) => <li key={i} className="px-5 py-3.5 sm:px-6"><Esqueleto className="h-4 w-1/2" /></li>)
            : linhas.map((linha) => <LinhaIntegridade key={linha.label} {...linha} />)}
        </ul>
      )}
    </section>
  );
}

function LinhaIntegridade({ label, detalhe, ok, quebraEm }: { label: string; detalhe: string; ok: boolean; quebraEm?: IntegrityBreak | null }) {
  return (
    <li className="flex items-start gap-3 px-5 py-3.5 sm:px-6">
      {ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-label="Íntegro" />
        : <XCircle className="mt-0.5 size-4 shrink-0 text-danger" aria-label="Inconsistente" />}
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-baseline justify-between gap-x-3 text-[13.5px]">
          <span className={ok ? 'text-fg' : 'font-medium text-danger'}>{label}</span>
          <span className={cn('font-mono text-[12px] tabular', ok ? 'text-muted' : 'text-danger')}>{ok ? 'íntegro' : 'violado'}</span>
        </p>
        <p className="mt-0.5 text-xs text-muted">{detalhe}</p>
        {!ok && quebraEm && (
          <p className="mt-1.5 rounded-md border border-danger/25 bg-danger/[0.06] px-2.5 py-1.5 font-mono text-[11.5px] break-all text-danger">
            quebra em {TABELAS[quebraEm.table]} · id {quebraEm.id}{quebraEm.userId ? ` · usuário ${quebraEm.userId}` : ''}
          </p>
        )}
      </div>
    </li>
  );
}

