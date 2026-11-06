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

    public static String extrato(long seq, String hashAnterior, LedgerRow r) {
        return new Builder().adicionar("L1").adicionar(seq).adicionar(hashAnterior).adicionar(r.id()).adicionar(r.userId()).adicionar(r.type()).adicionar(r.amount())
                .adicionar(r.balanceAfter()).adicionar(r.disposalId()).adicionar(r.challengeId()).adicionar(r.redemptionId()).adicionar(r.description())
                .adicionar(micros(r.createdAt())).toString();
    }

    public static String auditoria(long seq, String hashAnterior, AuditRow r) {
        return new Builder().adicionar("A1").adicionar(seq).adicionar(hashAnterior).adicionar(r.id()).adicionar(r.actorId()).adicionar(r.actorLabel()).adicionar(r.action())
                .adicionar(r.entity()).adicionar(r.entityId()).adicionar(r.details()).adicionar(r.ip()).adicionar(micros(r.createdAt())).toString();
    }

    /** O banco guarda microssegundos: truncamos antes de gravar e de assinar. */
    public static Instant truncar(Instant t) {
        return t.truncatedTo(ChronoUnit.MICROS);
    }

    static long micros(Instant t) {
        return ChronoUnit.MICROS.between(Instant.EPOCH, t);
    }

    private static final class Builder {
        private final StringBuilder sb = new StringBuilder(256);

        Builder adicionar(Object valor) {
            if (valor == null) {
                sb.append("~|");
            } else {
                String s = valor.toString();
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
