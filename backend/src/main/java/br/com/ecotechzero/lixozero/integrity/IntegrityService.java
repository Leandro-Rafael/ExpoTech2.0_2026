package br.com.ecotechzero.lixozero.integrity;

import br.com.ecotechzero.lixozero.integrity.ChainHashes.AuditRow;
import br.com.ecotechzero.lixozero.integrity.ChainHashes.LedgerRow;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.crypto.Mac;
import javax.sql.DataSource;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Clock;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.Objects;
import java.util.UUID;

/**
 * Verifica a integridade dos dados críticos, lendo as tabelas em fluxo (cursor do PostgreSQL, 1000 linhas
 * por vez — memória constante) na ordem da cadeia:
 * <ul>
 *   <li><b>Extrato</b>: para cada usuário, seq contínuo, prev_hash = hash da linha anterior, HMAC correto e
 *       saldo após = saldo anterior + valor.</li>
 *   <li><b>Auditoria</b>: a mesma checagem na cadeia global, e o último elo gravado por este processo ainda existe.</li>
 *   <li><b>Saldos</b>: pontos do usuário = último saldo do extrato = soma dos lançamentos; total ganho = soma dos créditos.</li>
 * </ul>
 */
@Service
public class IntegrityService {

    private static final Logger log = LoggerFactory.getLogger(IntegrityService.class);

    public record Break(String table, UUID id, UUID userId) {
    }

    public record ChainResult(boolean ok, long rowsChecked, Break brokenAt) {
    }

    public record BalanceResult(boolean ok, long mismatches) {
    }

    public record IntegrityReport(Instant checkedAt, ChainResult ledger, ChainResult audit, BalanceResult balances) {
        public boolean ok() {
            return ledger.ok() && audit.ok() && balances.ok();
        }
    }

    private final JdbcTemplate leitorFluxo;
    private final IntegrityKey chave;
    private final AuditChain cadeiaAuditoria;
    private final Clock relogio;

    public IntegrityService(DataSource fonteDados, IntegrityKey chave, AuditChain cadeiaAuditoria, Clock relogio) {
        this.leitorFluxo = new JdbcTemplate(fonteDados);
        this.leitorFluxo.setFetchSize(1000);
        this.chave = chave;
        this.cadeiaAuditoria = cadeiaAuditoria;
        this.relogio = relogio;
    }

    /** readOnly: conexão sem autocommit, o que permite o cursor (leitura em fluxo) do driver PostgreSQL. */
    @Transactional(readOnly = true)
    public IntegrityReport verificar() {
        IntegrityReport relatorio = new IntegrityReport(relogio.instant(), verificarExtrato(), verificarAuditoria(), verificarSaldos());
        if (!relatorio.ok()) {
            log.warn("INTEGRIDADE: falha detectada ledger={} audit={} balances={}", relatorio.ledger(), relatorio.audit(), relatorio.balances());
        }
        return relatorio;
    }

    private ChainResult verificarExtrato() {
        Mac mac = chave.novoMac();
        var estado = new Object() {
            long linhas;
            UUID usuario;
            long seqEsperada;
            String hashAnterior;
            long saldo;
            Break quebra;
        };
        leitorFluxo.query("""
                select id, user_id, type, amount, balance_after, description, disposal_id, challenge_id, redemption_id,
                       created_at, seq, prev_hash, hash
                from point_transactions order by user_id, seq
                """, (ResultSet rs) -> {
            estado.linhas++;
            UUID idUsuario = rs.getObject("user_id", UUID.class);
            // 1. Mudou de usuário: a corrente recomeça (seq 1, hash inicial, saldo 0).
            if (!idUsuario.equals(estado.usuario)) {
                estado.usuario = idUsuario;
                estado.seqEsperada = 1;
                estado.hashAnterior = ChainHashes.GENESIS;
                estado.saldo = 0;
            }
            LedgerRow linha = new LedgerRow(rs.getObject("id", UUID.class), idUsuario, rs.getString("type"), rs.getInt("amount"),
                    rs.getLong("balance_after"), rs.getString("description"), rs.getObject("disposal_id", UUID.class),
                    rs.getObject("challenge_id", UUID.class), rs.getObject("redemption_id", UUID.class), instante(rs));
            long seq = rs.getLong("seq");
            String anterior = rs.getString("prev_hash");
            String hash = rs.getString("hash");
            // 2. A linha só vale se a seq não pula, o prev_hash é o hash da anterior, o HMAC recalculado bate e o saldo fecha.
            boolean valido = seq == estado.seqEsperada
                    && IntegrityKey.iguais(anterior, estado.hashAnterior)
                    && IntegrityKey.iguais(hash, IntegrityKey.assinar(mac, ChainHashes.extrato(seq, anterior, linha)))
                    && linha.balanceAfter() == estado.saldo + linha.amount();
            if (!valido && estado.quebra == null) {
                estado.quebra = new Break("point_transactions", linha.id(), idUsuario);
            }
            // segue a cadeia gravada: só a PRIMEIRA linha inconsistente de cada usuário é apontada
            estado.seqEsperada = seq + 1;
            estado.hashAnterior = hash;
            estado.saldo = linha.balanceAfter();
        });
        return new ChainResult(estado.quebra == null, estado.linhas, estado.quebra);
    }

    private ChainResult verificarAuditoria() {
        Mac mac = chave.novoMac();
        AuditChain.Head fimEsperado = cadeiaAuditoria.ultimoConfirmado().orElse(null);
        var estado = new Object() {
            long linhas;
            long seqEsperada = 1;
            String hashAnterior = ChainHashes.GENESIS;
            UUID ultimoId;
            boolean fimEncontrado;
            Break quebra;
        };
        leitorFluxo.query("""
                select id, actor_id, actor_label, action, entity, entity_id, details, ip, created_at, seq, prev_hash, hash
                from audit_log order by seq
                """, (ResultSet rs) -> {
            estado.linhas++;
            AuditRow linha = new AuditRow(rs.getObject("id", UUID.class), rs.getObject("actor_id", UUID.class),
                    rs.getString("actor_label"), rs.getString("action"), rs.getString("entity"), rs.getString("entity_id"),
                    rs.getString("details"), rs.getString("ip"), instante(rs));
            long seq = rs.getLong("seq");
            String anterior = rs.getString("prev_hash");
            String hash = rs.getString("hash");
            boolean valido = seq == estado.seqEsperada
                    && IntegrityKey.iguais(anterior, estado.hashAnterior)
                    && IntegrityKey.iguais(hash, IntegrityKey.assinar(mac, ChainHashes.auditoria(seq, anterior, linha)));
            if (!valido && estado.quebra == null) {
                estado.quebra = new Break("audit_log", linha.id(), linha.actorId());
            }
            if (fimEsperado != null && seq == fimEsperado.seq()) {
                estado.fimEncontrado = IntegrityKey.iguais(hash, fimEsperado.hash());
            }
            estado.seqEsperada = seq + 1;
            estado.hashAnterior = hash;
            estado.ultimoId = linha.id();
        });
        if (estado.quebra == null && fimEsperado != null && !estado.fimEncontrado) {
            // o último elo gravado por este processo sumiu ou mudou: linhas do fim foram removidas/trocadas
            estado.quebra = new Break("audit_log", estado.ultimoId, null);
        }
        return new ChainResult(estado.quebra == null, estado.linhas, estado.quebra);
    }

    private BalanceResult verificarSaldos() {
        Long divergencias = leitorFluxo.queryForObject("""
                with agg as (
                    select user_id, sum(amount) as total, sum(case when amount > 0 then amount else 0 end) as earned,
                           max(seq) as last_seq
                    from point_transactions group by user_id
                ), last as (
                    select t.user_id, t.balance_after from point_transactions t
                    join agg on agg.user_id = t.user_id and t.seq = agg.last_seq
                )
                select count(*) from users u
                left join agg on agg.user_id = u.id
                left join last on last.user_id = u.id
                where u.points <> coalesce(agg.total, 0)
                   or u.points <> coalesce(last.balance_after, 0)
                   or u.total_earned <> coalesce(agg.earned, 0)
                """, Long.class);
        long total = Objects.requireNonNullElse(divergencias, 0L);
        return new BalanceResult(total == 0, total);
    }

    private static Instant instante(ResultSet rs) throws SQLException {
        return rs.getObject("created_at", OffsetDateTime.class).toInstant();
    }
}
