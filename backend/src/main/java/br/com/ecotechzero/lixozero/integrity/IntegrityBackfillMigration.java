package br.com.ecotechzero.lixozero.integrity;

import br.com.ecotechzero.lixozero.integrity.HashesCadeia.AuditRow;
import br.com.ecotechzero.lixozero.integrity.HashesCadeia.LedgerRow;
import org.flywaydb.core.api.MigrationVersion;
import org.flywaydb.core.api.migration.Context;
import org.flywaydb.core.api.migration.JavaMigration;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import javax.crypto.Mac;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.UUID;

/**
 * Migração V5 (Java, executada uma única vez pelo Flyway entre a V4 e a V6): sela as linhas JÁ existentes
 * do extrato e da auditoria com a cadeia HMAC, para que bancos criados antes desta versão também verifiquem.
 * Bancos novos não têm linhas aqui (os dados de demonstração já nascem encadeados).
 * <p>
 * No extrato, a ordem de cada usuário segue a data e, em empates/desvios, o saldo: escolhe-se sempre a
 * próxima linha cujo saldo após = saldo atual + valor, reconstruindo a sequência real dos lançamentos.
 */
@Component
public class IntegrityBackfillMigration implements JavaMigration {

    private static final Logger log = LoggerFactory.getLogger(IntegrityBackfillMigration.class);

    private final ChaveIntegridade chave;

    public IntegrityBackfillMigration(ChaveIntegridade chave) {
        this.chave = chave;
    }

    @Override
    public MigrationVersion getVersion() {
        return MigrationVersion.fromVersion("5");
    }

    @Override
    public String getDescription() {
        return "integrity backfill";
    }

    @Override
    public Integer getChecksum() {
        return null;
    }

    @Override
    public boolean canExecuteInTransaction() {
        return true;
    }

    @Override
    public void migrate(Context contexto) throws Exception {
        Connection c = contexto.getConnection();
        Mac mac = chave.novoMac();
        int extrato = selarExtrato(c, mac);
        int auditoria = selarAuditoria(c, mac);
        if (extrato + auditoria > 0) {
            log.info("Cadeia de integridade: {} lançamentos e {} registros de auditoria selados", extrato, auditoria);
        }
    }

    private int selarExtrato(Connection c, Mac mac) throws SQLException {
        List<LedgerRow> linhas = new ArrayList<>();
        try (PreparedStatement ps = c.prepareStatement("""
                select id, user_id, type, amount, balance_after, description, disposal_id, challenge_id, redemption_id, created_at
                from point_transactions order by user_id, created_at, id
                """); ResultSet rs = ps.executeQuery()) {
            while (rs.next()) {
                linhas.add(new LedgerRow(rs.getObject("id", UUID.class), rs.getObject("user_id", UUID.class), rs.getString("type"),
                        rs.getInt("amount"), rs.getLong("balance_after"), rs.getString("description"),
                        rs.getObject("disposal_id", UUID.class), rs.getObject("challenge_id", UUID.class),
                        rs.getObject("redemption_id", UUID.class), rs.getObject("created_at", OffsetDateTime.class).toInstant()));
            }
        }
        try (PreparedStatement atualizacao = c.prepareStatement("update point_transactions set seq = ?, prev_hash = ?, hash = ? where id = ?")) {
            int i = 0;
            while (i < linhas.size()) {
                UUID usuario = linhas.get(i).userId();
                List<LedgerRow> doUsuario = new ArrayList<>();
                while (i < linhas.size() && linhas.get(i).userId().equals(usuario)) {
                    doUsuario.add(linhas.get(i++));
                }
                long seq = 0;
                long saldo = 0;
                String anterior = HashesCadeia.GENESIS;
                while (!doUsuario.isEmpty()) {
                    LedgerRow proxima = escolherProxima(doUsuario, saldo);
                    seq++;
                    String hash = ChaveIntegridade.assinar(mac, HashesCadeia.extrato(seq, anterior, proxima));
                    atualizacao.setLong(1, seq);
                    atualizacao.setString(2, anterior);
                    atualizacao.setString(3, hash);
                    atualizacao.setObject(4, proxima.id());
                    atualizacao.addBatch();
                    anterior = hash;
                    saldo = proxima.balanceAfter();
                }
            }
            atualizacao.executeBatch();
        }
        return linhas.size();
    }

    /** Primeira linha (em ordem de data) que continua o saldo; se nenhuma continuar, a mais antiga. */
    private static LedgerRow escolherProxima(List<LedgerRow> restantes, long saldo) {
        for (Iterator<LedgerRow> it = restantes.iterator(); it.hasNext(); ) {
            LedgerRow r = it.next();
            if (r.balanceAfter() == saldo + r.amount()) {
                it.remove();
                return r;
            }
        }
        return restantes.removeFirst();
    }

    private int selarAuditoria(Connection c, Mac mac) throws SQLException {
        int contador = 0;
        try (PreparedStatement ps = c.prepareStatement("""
                select id, actor_id, actor_label, action, entity, entity_id, details, ip, created_at
                from audit_log order by created_at, id
                """);
             PreparedStatement atualizacao = c.prepareStatement("update audit_log set seq = ?, prev_hash = ?, hash = ? where id = ?")) {
            ps.setFetchSize(1000);
            String anterior = HashesCadeia.GENESIS;
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    AuditRow linha = new AuditRow(rs.getObject("id", UUID.class), rs.getObject("actor_id", UUID.class),
                            rs.getString("actor_label"), rs.getString("action"), rs.getString("entity"), rs.getString("entity_id"),
                            rs.getString("details"), rs.getString("ip"), rs.getObject("created_at", OffsetDateTime.class).toInstant());
                    contador++;
                    String hash = ChaveIntegridade.assinar(mac, HashesCadeia.auditoria(contador, anterior, linha));
                    atualizacao.setLong(1, contador);
                    atualizacao.setString(2, anterior);
                    atualizacao.setString(3, hash);
                    atualizacao.setObject(4, linha.id());
                    atualizacao.addBatch();
                    anterior = hash;
                }
            }
            atualizacao.executeBatch();
        }
        return contador;
    }
}
