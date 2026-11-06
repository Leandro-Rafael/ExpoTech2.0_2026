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
    private static final long ID_TRAVA = 0x4C5A_4155_4449_5431L;

    private static final String INSERCAO = """
            insert into audit_log (id, actor_id, actor_label, action, entity, entity_id, details, ip,
                                   created_at, updated_at, seq, prev_hash, hash)
            values (:id, :actorId, :actorLabel, :action, :entity, :entityId, :details, :ip,
                    :createdAt, :createdAt, :seq, :prevHash, :hash)
            """;

    public record Head(long seq, String hash) {
    }

    private final NamedParameterJdbcTemplate jdbc;
    private final IntegrityKey chave;
    private final AtomicReference<Head> ultimoConfirmado = new AtomicReference<>();

    public AuditChain(NamedParameterJdbcTemplate jdbc, IntegrityKey chave) {
        this.jdbc = jdbc;
        this.chave = chave;
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public UUID anexar(AuditRow entrada) {
        AuditRow r = new AuditRow(entrada.id() == null ? UUID.randomUUID() : entrada.id(), entrada.actorId(), entrada.actorLabel(),
                entrada.action(), entrada.entity(), entrada.entityId(), entrada.details(), entrada.ip(), ChainHashes.truncar(entrada.createdAt()));
        jdbc.query("select pg_advisory_xact_lock(:k)", new MapSqlParameterSource("k", ID_TRAVA), rs -> null);
        List<Head> ultimo = jdbc.query("select seq, hash from audit_log order by seq desc limit 1", new MapSqlParameterSource(),
                (rs, i) -> new Head(rs.getLong("seq"), rs.getString("hash")));
        Head anterior = ultimo.isEmpty() ? new Head(0, ChainHashes.GENESIS) : ultimo.getFirst();
        long seq = anterior.seq() + 1;
        String hash = IntegrityKey.assinar(chave.novoMac(), ChainHashes.auditoria(seq, anterior.hash(), r));
        jdbc.update(INSERCAO, new MapSqlParameterSource()
                .addValue("id", r.id()).addValue("actorId", r.actorId()).addValue("actorLabel", r.actorLabel())
                .addValue("action", r.action()).addValue("entity", r.entity()).addValue("entityId", r.entityId())
                .addValue("details", r.details()).addValue("ip", r.ip())
                .addValue("createdAt", OffsetDateTime.ofInstant(r.createdAt(), ZoneOffset.UTC))
                .addValue("seq", seq).addValue("prevHash", anterior.hash()).addValue("hash", hash));
        Head anexado = new Head(seq, hash);
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    ultimoConfirmado.accumulateAndGet(anexado, (a, b) -> a == null || b.seq() > a.seq() ? b : a);
                }
            });
        }
        return r.id();
    }

    /** Último elo gravado (e confirmado) por este processo. */
    public Optional<Head> ultimoConfirmado() {
        return Optional.ofNullable(ultimoConfirmado.get());
    }
}
