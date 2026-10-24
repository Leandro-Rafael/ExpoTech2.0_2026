package br.com.ecotechzero.lixozero.integrity;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

/**
 * Forma canônica das linhas encadeadas. Cada campo é codificado como {@code tamanho:valor|} (nulo = {@code ~|}),
 * então não há ambiguidade de separador. As datas entram em microssegundos (precisão do PostgreSQL).
 */
public final class ChainHashes {

    /** prev_hash da primeira linha de cada cadeia. */
    public static final String GENESIS = "0".repeat(64);

    private ChainHashes() {
    }

    public record LedgerRow(UUID id, UUID userId, String type, int amount, long balanceAfter, String description,
                            UUID disposalId, UUID challengeId, UUID redemptionId, Instant createdAt) {
    }

    public record AuditRow(UUID id, UUID actorId, String actorLabel, String action, String entity, String entityId,
                           String details, String ip, Instant createdAt) {
    }

    public static String ledger(long seq, String prevHash, LedgerRow r) {
        return new Builder().add("L1").add(seq).add(prevHash).add(r.id()).add(r.userId()).add(r.type()).add(r.amount())
                .add(r.balanceAfter()).add(r.disposalId()).add(r.challengeId()).add(r.redemptionId()).add(r.description())
                .add(micros(r.createdAt())).toString();
    }

    public static String audit(long seq, String prevHash, AuditRow r) {
        return new Builder().add("A1").add(seq).add(prevHash).add(r.id()).add(r.actorId()).add(r.actorLabel()).add(r.action())
                .add(r.entity()).add(r.entityId()).add(r.details()).add(r.ip()).add(micros(r.createdAt())).toString();
    }

    /** O banco guarda microssegundos: truncamos antes de gravar e de assinar. */
    public static Instant truncate(Instant t) {
        return t.truncatedTo(ChronoUnit.MICROS);
    }

    static long micros(Instant t) {
        return ChronoUnit.MICROS.between(Instant.EPOCH, t);
    }

    private static final class Builder {
        private final StringBuilder sb = new StringBuilder(256);

        Builder add(Object value) {
            if (value == null) {
                sb.append("~|");
            } else {
                String s = value.toString();
                sb.append(s.length()).append(':').append(s).append('|');
            }
            return this;
        }

        @Override
        public String toString() {
            return sb.toString();
        }
    }
}
