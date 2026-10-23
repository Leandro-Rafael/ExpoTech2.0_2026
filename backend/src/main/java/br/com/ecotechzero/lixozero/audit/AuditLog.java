package br.com.ecotechzero.lixozero.audit;

import br.com.ecotechzero.lixozero.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

import java.util.UUID;

/** Registro de auditoria de ações sensíveis (quem, o quê, quando e de qual IP). */
@Entity
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

    protected AuditLog() {
    }

    public AuditLog(UUID actorId, String actorLabel, String action, String entity, String entityId, String details, String ip) {
        this.actorId = actorId;
        this.actorLabel = actorLabel;
        this.action = action;
        this.entity = entity;
        this.entityId = entityId;
        this.details = details;
        this.ip = ip;
    }

    public UUID getActorId() { return actorId; }
    public String getActorLabel() { return actorLabel; }
    public String getAction() { return action; }
    public String getEntity() { return entity; }
    public String getEntityId() { return entityId; }
    public String getDetails() { return details; }
    public String getIp() { return ip; }
}
