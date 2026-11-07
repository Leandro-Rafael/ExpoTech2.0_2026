package br.com.ecotechzero.lixozero.audit;

import br.com.ecotechzero.lixozero.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import org.hibernate.annotations.Immutable;

import java.util.UUID;

/**
 * Registro de auditoria de ações sensíveis (quem, o quê, quando e de qual IP).
 * Somente leitura no JPA: gravado pela {@code CadeiaAuditoria} numa cadeia de hashes; append-only no banco.
 */
@Entity
@Immutable
@Table(name = "audit_log")
public class AuditLog extends BaseEntity {

    @Column(name = "actor_id")
    private UUID actorId;

    @Column(name = "actor_label", length = 160)
    private String actorLabel;

    @Column(nullable = false, length = 60)
    private String action;

    @Column(length = 60)
    private String entity;

    @Column(name = "entity_id", length = 64)
    private String entityId;

    @Column(length = 1000)
    private String details;

    @Column(length = 64)
    private String ip;

    @Column(nullable = false)
    private long seq;

    @Column(nullable = false, length = 64)
    private String hash;

    protected AuditLog() {
    }

    public UUID getActorId() { return actorId; }
    public String getActorLabel() { return actorLabel; }
    public String getAction() { return action; }
    public String getEntity() { return entity; }
    public String getEntityId() { return entityId; }
    public String getDetails() { return details; }
    public String getIp() { return ip; }
    public long getSeq() { return seq; }
    public String getHash() { return hash; }
}
