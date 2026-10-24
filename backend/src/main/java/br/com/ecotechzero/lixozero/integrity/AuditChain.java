package br.com.ecotechzero.lixozero.integrity;

import br.com.ecotechzero.lixozero.integrity.ChainHashes.AuditRow;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Grava a trilha de auditoria numa cadeia GLOBAL de hashes. As inserções são serializadas por um advisory
 * lock transacional do PostgreSQL (não trava tabela nenhuma e é liberado no commit): o custo extra é uma
 * consulta indexada ao último elo.
 * <p>
 * Também guarda em memória o último elo confirmado por este processo: se alguém apagar linhas do FIM da
 * cadeia (o que o hash sozinho não denuncia), a verificação percebe que esse elo sumiu.
 */
@Component
public class AuditChain {

    /** Chave fixa e arbitrária do advisory lock da auditoria. */
    private static final long LOCK_ID = 0x4C5A_4155_4449_5431L;

    private static final String INSERT = """
            insert into audit_log (id, actor_id, actor_label, action, entity, entity_id, details, ip,
                                   created_at, updated_at, seq, prev_hash, hash)
            values (:id, :actorId, :actorLabel, :action, :entity, :entityId, :details, :ip,
                    :createdAt, :createdAt, :seq, :prevHash, :hash)
            """;

    public record Head(long seq, String hash) {
    }

    private final NamedParameterJdbcTemplate jdbc;
    private final IntegrityKey key;
    private final AtomicReference<Head> lastCommitted = new AtomicReference<>();

    public AuditChain(NamedParameterJdbcTemplate jdbc, IntegrityKey key) {
        this.jdbc = jdbc;
        this.key = key;
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public UUID append(AuditRow input) {
        AuditRow r = new AuditRow(input.id() == null ? UUID.randomUUID() : input.id(), input.actorId(), input.actorLabel(),
                input.action(), input.entity(), input.entityId(), input.details(), input.ip(), ChainHashes.truncate(input.createdAt()));
        jdbc.query("select pg_advisory_xact_lock(:k)", new MapSqlParameterSource("k", LOCK_ID), rs -> null);
        List<Head> last = jdbc.query("select seq, hash from audit_log order by seq desc limit 1", new MapSqlParameterSource(),
                (rs, i) -> new Head(rs.getLong("seq"), rs.getString("hash")));
        Head prev = last.isEmpty() ? new Head(0, ChainHashes.GENESIS) : last.getFirst();
        long seq = prev.seq() + 1;
        String hash = IntegrityKey.sign(key.newMac(), ChainHashes.audit(seq, prev.hash(), r));
        jdbc.update(INSERT, new MapSqlParameterSource()
                .addValue("id", r.id()).addValue("actorId", r.actorId()).addValue("actorLabel", r.actorLabel())
                .addValue("action", r.action()).addValue("entity", r.entity()).addValue("entityId", r.entityId())
                .addValue("details", r.details()).addValue("ip", r.ip())
                .addValue("createdAt", OffsetDateTime.ofInstant(r.createdAt(), ZoneOffset.UTC))
                .addValue("seq", seq).addValue("prevHash", prev.hash()).addValue("hash", hash));
        Head appended = new Head(seq, hash);
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    lastCommitted.accumulateAndGet(appended, (a, b) -> a == null || b.seq() > a.seq() ? b : a);
                }
            });
        }
        return r.id();
    }

    /** Último elo gravado (e confirmado) por este processo. */
    public Optional<Head> lastCommitted() {
        return Optional.ofNullable(lastCommitted.get());
    }
}
