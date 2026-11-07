package br.com.ecotechzero.lixozero.integrity;

import br.com.ecotechzero.lixozero.integrity.HashesCadeia.LedgerRow;
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
 * Concorrência: quem chama já travou a linha do usuário (ServicoPontos.travarUsuario), então a leitura do
 * último elo e a inserção do próximo nunca correm em paralelo para o mesmo usuário.
 */
@Component
public class CadeiaExtrato {

    private static final String INSERCAO = """
            insert into point_transactions (id, user_id, type, amount, balance_after, description, disposal_id,
                                            challenge_id, redemption_id, created_at, updated_at, seq, prev_hash, hash)
            values (:id, :userId, :type, :amount, :balanceAfter, :description, :disposalId,
                    :challengeId, :redemptionId, :createdAt, :createdAt, :seq, :prevHash, :hash)
            """;

    private record Head(long seq, String hash) {
    }

    private final NamedParameterJdbcTemplate jdbc;
    private final ChaveIntegridade chave;
    private final EntityManager em;

    public CadeiaExtrato(NamedParameterJdbcTemplate jdbc, ChaveIntegridade chave, EntityManager em) {
        this.jdbc = jdbc;
        this.chave = chave;
        this.em = em;
    }

    /** Novo lançamento (id gerado aqui). A linha do usuário deve estar travada pelo chamador. */
    @Transactional(propagation = Propagation.MANDATORY)
    public UUID anexar(UUID idUsuario, String tipo, int valor, long saldoApos, String descricao,
                       UUID idDescarte, UUID idDesafio, UUID idResgate, Instant criadoEm) {
        LedgerRow linha = new LedgerRow(UUID.randomUUID(), idUsuario, tipo, valor, saldoApos, descricao,
                idDescarte, idDesafio, idResgate, criadoEm);
        anexarTodos(List.of(linha));
        return linha.id();
    }

    /** Vários lançamentos em lote (dados de demonstração), na ordem da lista dentro de cada usuário. */
    @Transactional(propagation = Propagation.MANDATORY)
    public void anexarTodos(List<LedgerRow> linhas) {
        if (linhas.isEmpty()) {
            return;
        }
        em.flush(); // descartes/resgates referenciados (FK) precisam existir antes do INSERT via JDBC
        Mac mac = chave.novoMac();
        Map<UUID, Head> cabecas = new HashMap<>();
        List<SqlParameterSource> lote = new ArrayList<>(linhas.size());
        for (LedgerRow entrada : linhas) {
            LedgerRow r = new LedgerRow(entrada.id() == null ? UUID.randomUUID() : entrada.id(), entrada.userId(), entrada.type(),
                    entrada.amount(), entrada.balanceAfter(), entrada.description(), entrada.disposalId(), entrada.challengeId(),
                    entrada.redemptionId(), HashesCadeia.truncar(entrada.createdAt()));
            Head cabeca = cabecas.computeIfAbsent(r.userId(), this::cabeca);
            long seq = cabeca.seq() + 1;
            String hash = ChaveIntegridade.assinar(mac, HashesCadeia.extrato(seq, cabeca.hash(), r));
            lote.add(new MapSqlParameterSource()
                    .addValue("id", r.id()).addValue("userId", r.userId()).addValue("type", r.type())
                    .addValue("amount", r.amount()).addValue("balanceAfter", r.balanceAfter())
                    .addValue("description", r.description()).addValue("disposalId", r.disposalId())
                    .addValue("challengeId", r.challengeId()).addValue("redemptionId", r.redemptionId())
                    .addValue("createdAt", OffsetDateTime.ofInstant(r.createdAt(), ZoneOffset.UTC))
                    .addValue("seq", seq).addValue("prevHash", cabeca.hash()).addValue("hash", hash));
            cabecas.put(r.userId(), new Head(seq, hash));
        }
        jdbc.batchUpdate(INSERCAO, lote.toArray(SqlParameterSource[]::new));
    }

    private Head cabeca(UUID idUsuario) {
        List<Head> ultimo = jdbc.query("select seq, hash from point_transactions where user_id = :u order by seq desc limit 1",
                new MapSqlParameterSource("u", idUsuario), (rs, i) -> new Head(rs.getLong("seq"), rs.getString("hash")));
        return ultimo.isEmpty() ? new Head(0, HashesCadeia.GENESIS) : ultimo.getFirst();
    }
}
