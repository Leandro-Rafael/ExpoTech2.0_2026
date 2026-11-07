package br.com.ecotechzero.lixozero.route;

import br.com.ecotechzero.lixozero.collection.CollectionRequest;
import br.com.ecotechzero.lixozero.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.time.Instant;

/** Parada de uma rota (uma solicitação de coleta), na ordem definida pelo otimizador. */
@Entity
@Table(name = "route_stops")
public class RouteStop extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "route_id", nullable = false)
    private CollectionRoute route;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "request_id", nullable = false)
    private CollectionRequest request;

    @Column(nullable = false)
    private int sequence;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private StatusParada status = StatusParada.PENDING;

    @Column(name = "completed_at")
    private Instant completedAt;

    @Column(name = "collected_kg")
    private Double collectedKg;

    protected RouteStop() {
    }

    RouteStop(CollectionRoute route, CollectionRequest request, int sequence) {
        this.route = route;
        this.request = request;
        this.sequence = sequence;
    }

    public void complete(Double kg, Instant at) {
        this.status = StatusParada.DONE;
        this.collectedKg = kg;
        this.completedAt = at;
    }

    public CollectionRoute getRoute() { return route; }
    public CollectionRequest getRequest() { return request; }
    public int getSequence() { return sequence; }
    void setSequence(int sequence) { this.sequence = sequence; }
    public StatusParada getStatus() { return status; }
    public Instant getCompletedAt() { return completedAt; }
    public Double getCollectedKg() { return collectedKg; }
}
