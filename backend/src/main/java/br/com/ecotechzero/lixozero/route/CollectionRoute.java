package br.com.ecotechzero.lixozero.route;

import br.com.ecotechzero.lixozero.collection.CollectionRequest;
import br.com.ecotechzero.lixozero.common.BaseEntity;
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
import java.util.List;

/** Rota de coleta planejada para um coletor (uma viagem do caminhão). */
@Entity
@Table(name = "routes")
public class CollectionRoute extends BaseEntity {

    @Column(nullable = false, length = 120)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 12)
    private RouteStatus status = RouteStatus.PLANNED;

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

    /** Remove uma parada (solicitação cancelada) e renumera as demais. */
    public void removeStop(RouteStop stop) {
        stops.remove(stop);
        for (int i = 0; i < stops.size(); i++) {
            stops.get(i).setSequence(i + 1);
        }
        this.loadKg = Math.max(0, loadKg - stop.getRequest().getEstimatedKg());
    }

    public boolean allStopsDone() {
        return stops.stream().allMatch(s -> s.getStatus() == StopStatus.DONE);
    }

    public void start(User collector, Instant at) {
        this.status = RouteStatus.IN_PROGRESS;
        this.startedAt = at;
        if (this.collector == null) {
            this.collector = collector;
        }
    }

    public void finish(Instant at) {
        this.status = RouteStatus.DONE;
        this.completedAt = at;
    }

    public String getName() { return name; }
    public RouteStatus getStatus() { return status; }
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
