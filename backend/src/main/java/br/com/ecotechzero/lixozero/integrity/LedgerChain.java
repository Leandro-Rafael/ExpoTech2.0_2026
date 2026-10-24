package br.com.ecotechzero.lixozero.integrity;

import br.com.ecotechzero.lixozero.integrity.ChainHashes.LedgerRow;
import jakarta.persistence.EntityManager;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.core.namedparam.SqlParameterSource;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import javax.crypto.Mac;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Grava lançamentos do extrato de pontos encadeados por usuário: cada linha guarda o hash da anterior
 * ({@code prev_hash}) e o seu próprio HMAC. A tabela é append-only (trigger no banco), então a única
 * operação possível é inserir no fim da cadeia.
 * <p>
 * Concorrência: quem chama já travou a linha do usuário (PointsService.lockUser), então a leitura do
 * último elo e a inserção do próximo nunca correm em paralelo para o mesmo usuário.
 */
@Component
public class LedgerChain {

    private static final String INSERT = """
            insert into point_transactions (id, user_id, type, amount, balance_after, description, disposal_id,
                                            challenge_id, redemption_id, created_at, updated_at, seq, prev_hash, hash)
            values (:id, :userId, :type, :amount, :balanceAfter, :description, :disposalId,
                    :challengeId, :redemptionId, :createdAt, :createdAt, :seq, :prevHash, :hash)
            """;

    private record Head(long seq, String hash) {
    }

    private final NamedParameterJdbcTemplate jdbc;
    private final IntegrityKey key;
    private final EntityManager em;

    public LedgerChain(NamedParameterJdbcTemplate jdbc, IntegrityKey key, EntityManager em) {
        this.jdbc = jdbc;
        this.key = key;
        this.em = em;
    }

    /** Novo lançamento (id gerado aqui). A linha do usuário deve estar travada pelo chamador. */
    @Transactional(propagation = Propagation.MANDATORY)
    public UUID append(UUID userId, String type, int amount, long balanceAfter, String description,
                       UUID disposalId, UUID challengeId, UUID redemptionId, Instant createdAt) {
        LedgerRow row = new LedgerRow(UUID.randomUUID(), userId, type, amount, balanceAfter, description,
                disposalId, challengeId, redemptionId, createdAt);
        appendAll(List.of(row));
        return row.id();
    }

    /** Vários lançamentos em lote (dados de demonstração), na ordem da lista dentro de cada usuário. */
    @Transactional(propagation = Propagation.MANDATORY)
    public void appendAll(List<LedgerRow> rows) {
        if (rows.isEmpty()) {
            return;
        }
        em.flush(); // descartes/resgates referenciados (FK) precisam existir antes do INSERT via JDBC
        Mac mac = key.newMac();
        Map<UUID, Head> heads = new HashMap<>();
        List<SqlParameterSource> batch = new ArrayList<>(rows.size());
        for (LedgerRow input : rows) {
            LedgerRow r = new LedgerRow(input.id() == null ? UUID.randomUUID() : input.id(), input.userId(), input.type(),
                    input.amount(), input.balanceAfter(), input.description(), input.disposalId(), input.challengeId(),
                    input.redemptionId(), ChainHashes.truncate(input.createdAt()));
            Head head = heads.computeIfAbsent(r.userId(), this::head);
            long seq = head.seq() + 1;
            String hash = IntegrityKey.sign(mac, ChainHashes.ledger(seq, head.hash(), r));
            batch.add(new MapSqlParameterSource()
                    .addValue("id", r.id()).addValue("userId", r.userId()).addValue("type", r.type())
                    .addValue("amount", r.amount()).addValue("balanceAfter", r.balanceAfter())
                    .addValue("description", r.description()).addValue("disposalId", r.disposalId())
                    .addValue("challengeId", r.challengeId()).addValue("redemptionId", r.redemptionId())
                    .addValue("createdAt", OffsetDateTime.ofInstant(r.createdAt(), ZoneOffset.UTC))
                    .addValue("seq", seq).addValue("prevHash", head.hash()).addValue("hash", hash));
            heads.put(r.userId(), new Head(seq, hash));
        }
        jdbc.batchUpdate(INSERT, batch.toArray(SqlParameterSource[]::new));
    }

    private Head head(UUID userId) {
        List<Head> last = jdbc.query("select seq, hash from point_transactions where user_id = :u order by seq desc limit 1",
                new MapSqlParameterSource("u", userId), (rs, i) -> new Head(rs.getLong("seq"), rs.getString("hash")));
        return last.isEmpty() ? new Head(0, ChainHashes.GENESIS) : last.getFirst();
    }
}
