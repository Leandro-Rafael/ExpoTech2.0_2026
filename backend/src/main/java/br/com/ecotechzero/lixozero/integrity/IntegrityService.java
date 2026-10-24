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

    private final JdbcTemplate streaming;
    private final IntegrityKey key;
    private final AuditChain auditChain;
    private final Clock clock;

    public IntegrityService(DataSource dataSource, IntegrityKey key, AuditChain auditChain, Clock clock) {
        this.streaming = new JdbcTemplate(dataSource);
        this.streaming.setFetchSize(1000);
        this.key = key;
        this.auditChain = auditChain;
        this.clock = clock;
    }

    /** readOnly: conexão sem autocommit, o que permite o cursor (leitura em fluxo) do driver PostgreSQL. */
    @Transactional(readOnly = true)
    public IntegrityReport verify() {
        IntegrityReport report = new IntegrityReport(clock.instant(), verifyLedger(), verifyAudit(), verifyBalances());
        if (!report.ok()) {
            log.warn("INTEGRIDADE: falha detectada ledger={} audit={} balances={}", report.ledger(), report.audit(), report.balances());
        }
        return report;
    }

    private ChainResult verifyLedger() {
        Mac mac = key.newMac();
        var state = new Object() {
            long rows;
            UUID user;
            long expectedSeq;
            String prevHash;
            long balance;
            Break broken;
        };
        streaming.query("""
                select id, user_id, type, amount, balance_after, description, disposal_id, challenge_id, redemption_id,
                       created_at, seq, prev_hash, hash
                from point_transactions order by user_id, seq
                """, (ResultSet rs) -> {
            state.rows++;
            UUID userId = rs.getObject("user_id", UUID.class);
            if (!userId.equals(state.user)) {
                state.user = userId;
                state.expectedSeq = 1;
                state.prevHash = ChainHashes.GENESIS;
                state.balance = 0;
            }
            LedgerRow row = new LedgerRow(rs.getObject("id", UUID.class), userId, rs.getString("type"), rs.getInt("amount"),
                    rs.getLong("balance_after"), rs.getString("description"), rs.getObject("disposal_id", UUID.class),
                    rs.getObject("challenge_id", UUID.class), rs.getObject("redemption_id", UUID.class), instant(rs));
            long seq = rs.getLong("seq");
            String prev = rs.getString("prev_hash");
            String hash = rs.getString("hash");
            boolean valid = seq == state.expectedSeq
                    && IntegrityKey.same(prev, state.prevHash)
                    && IntegrityKey.same(hash, IntegrityKey.sign(mac, ChainHashes.ledger(seq, prev, row)))
                    && row.balanceAfter() == state.balance + row.amount();
            if (!valid && state.broken == null) {
                state.broken = new Break("point_transactions", row.id(), userId);
            }
            // segue a cadeia gravada: só a PRIMEIRA linha inconsistente de cada usuário é apontada
            state.expectedSeq = seq + 1;
            state.prevHash = hash;
            state.balance = row.balanceAfter();
        });
        return new ChainResult(state.broken == null, state.rows, state.broken);
    }

    private ChainResult verifyAudit() {
        Mac mac = key.newMac();
        AuditChain.Head expectedTail = auditChain.lastCommitted().orElse(null);
        var state = new Object() {
            long rows;
            long expectedSeq = 1;
            String prevHash = ChainHashes.GENESIS;
            UUID lastId;
            boolean tailSeen;
            Break broken;
        };
        streaming.query("""
                select id, actor_id, actor_label, action, entity, entity_id, details, ip, created_at, seq, prev_hash, hash
                from audit_log order by seq
                """, (ResultSet rs) -> {
            state.rows++;
            AuditRow row = new AuditRow(rs.getObject("id", UUID.class), rs.getObject("actor_id", UUID.class),
                    rs.getString("actor_label"), rs.getString("action"), rs.getString("entity"), rs.getString("entity_id"),
                    rs.getString("details"), rs.getString("ip"), instant(rs));
            long seq = rs.getLong("seq");
            String prev = rs.getString("prev_hash");
            String hash = rs.getString("hash");
            boolean valid = seq == state.expectedSeq
                    && IntegrityKey.same(prev, state.prevHash)
                    && IntegrityKey.same(hash, IntegrityKey.sign(mac, ChainHashes.audit(seq, prev, row)));
            if (!valid && state.broken == null) {
                state.broken = new Break("audit_log", row.id(), row.actorId());
            }
            if (expectedTail != null && seq == expectedTail.seq()) {
                state.tailSeen = IntegrityKey.same(hash, expectedTail.hash());
            }
            state.expectedSeq = seq + 1;
            state.prevHash = hash;
            state.lastId = row.id();
        });
        if (state.broken == null && expectedTail != null && !state.tailSeen) {
            // o último elo gravado por este processo sumiu ou mudou: linhas do fim foram removidas/trocadas
            state.broken = new Break("audit_log", state.lastId, null);
        }
        return new ChainResult(state.broken == null, state.rows, state.broken);
    }

    private BalanceResult verifyBalances() {
        Long mismatches = streaming.queryForObject("""
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
        long count = Objects.requireNonNullElse(mismatches, 0L);
        return new BalanceResult(count == 0, count);
    }

    private static Instant instant(ResultSet rs) throws SQLException {
        return rs.getObject("created_at", OffsetDateTime.class).toInstant();
    }
}
