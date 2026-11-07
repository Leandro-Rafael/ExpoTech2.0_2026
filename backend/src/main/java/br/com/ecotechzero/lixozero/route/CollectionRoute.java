package br.com.ecotechzero.lixozero.route;

import br.com.ecotechzero.lixozero.collection.CollectionRequest;
import br.com.ecotechzero.lixozero.common.BaseEntity;
import br.com.ecotechzero.lixozero.common.PontoGeografico;
import br.com.ecotechzero.lixozero.common.Numeros;
import br.com.ecotechzero.lixozero.user.User;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/** Rota de coleta planejada para um coletor (uma viagem do caminhão). */
@Entity
@Table(name = "routes")
public class CollectionRoute extends BaseEntity {

    @Column(nullable = false, length = 120)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 12)
    private StatusRota status = StatusRota.PLANNED;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "collector_id")
    private User collector;

    @Column(name = "planned_date", nullable = false)
    private LocalDate plannedDate;

    @Column(name = "total_distance_km", nullable = false)
    private double totalDistanceKm;

    @Column(name = "naive_distance_km", nullable = false)
    private double naiveDistanceKm;

    @Column(name = "estimated_minutes", nullable = false)
    private int estimatedMinutes;

    @Column(name = "load_kg", nullable = false)
    private double loadKg;

    @Column(name = "depot_latitude", nullable = false)
    private double depotLatitude;

    @Column(name = "depot_longitude", nullable = false)
    private double depotLongitude;

    @Column(name = "started_at")
    private Instant startedAt;

    @Column(name = "completed_at")
    private Instant completedAt;

    @OneToMany(mappedBy = "route", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("sequence")
    private List<RouteStop> stops = new ArrayList<>();

    protected CollectionRoute() {
    }

    public CollectionRoute(String name, User collector, LocalDate plannedDate, double depotLatitude, double depotLongitude) {
        this.name = name;
        this.collector = collector;
        this.plannedDate = plannedDate;
        this.depotLatitude = depotLatitude;
        this.depotLongitude = depotLongitude;
    }

    public void setMetrics(double totalDistanceKm, double naiveDistanceKm, int estimatedMinutes, double loadKg) {
        this.totalDistanceKm = totalDistanceKm;
        this.naiveDistanceKm = naiveDistanceKm;
        this.estimatedMinutes = estimatedMinutes;
        this.loadKg = loadKg;
    }

    public RouteStop addStop(CollectionRequest request) {
        RouteStop stop = new RouteStop(this, request, stops.size() + 1);
        stops.add(stop);
        return stop;
    }

    /**
     * Remove uma parada (solicitação cancelada), renumera as demais e RECALCULA as métricas:
     * a ordem otimizada das paradas restantes é mantida (pular uma parada nunca deixa o percurso maior,
     * pela desigualdade triangular) e a distância, o tempo e a carga passam a refletir o novo trajeto.
     */
    public void removeStop(RouteStop stop) {
        stops.remove(stop);
        for (int i = 0; i < stops.size(); i++) {
            stops.get(i).setSequence(i + 1);
        }
        PontoGeografico garagem = new PontoGeografico(depotLatitude, depotLongitude);
        List<PontoGeografico> ordemOtimizada = stops.stream().map(s -> pontoDe(s.getRequest())).toList();
        List<PontoGeografico> ordemDeCriacao = stops.stream()
                .sorted(Comparator.comparing((RouteStop s) -> s.getRequest().getCreatedAt(), Comparator.nullsLast(Comparator.naturalOrder())))
                .map(s -> pontoDe(s.getRequest()))
                .toList();
        this.totalDistanceKm = Numeros.arredondar2(OtimizadorRotas.kmRotaFechada(garagem, ordemOtimizada));
        this.naiveDistanceKm = Math.max(totalDistanceKm, Numeros.arredondar2(OtimizadorRotas.kmRotaFechada(garagem, ordemDeCriacao)));
        this.estimatedMinutes = OtimizadorRotas.estimarMinutos(totalDistanceKm, stops.size());
        this.loadKg = Numeros.arredondar2(stops.stream().mapToDouble(s -> s.getRequest().getEstimatedKg()).sum());
    }

    private static PontoGeografico pontoDe(CollectionRequest request) {
        return new PontoGeografico(request.getLatitude(), request.getLongitude());
    }

    public boolean allStopsDone() {
        return stops.stream().allMatch(s -> s.getStatus() == StatusParada.DONE);
    }

    public void start(User collector, Instant at) {
        this.status = StatusRota.IN_PROGRESS;
        this.startedAt = at;
        if (this.collector == null) {
            this.collector = collector;
        }
    }

    public void finish(Instant at) {
        this.status = StatusRota.DONE;
        this.completedAt = at;
    }

    public String getName() { return name; }
    public StatusRota getStatus() { return status; }
    public User getCollector() { return collector; }
    public LocalDate getPlannedDate() { return plannedDate; }
    public double getTotalDistanceKm() { return totalDistanceKm; }
    public double getNaiveDistanceKm() { return naiveDistanceKm; }
    public int getEstimatedMinutes() { return estimatedMinutes; }
    public double getLoadKg() { return loadKg; }
    public double getDepotLatitude() { return depotLatitude; }
    public double getDepotLongitude() { return depotLongitude; }
    public Instant getStartedAt() { return startedAt; }
    public Instant getCompletedAt() { return completedAt; }
    public List<RouteStop> getStops() { return stops; }
}
