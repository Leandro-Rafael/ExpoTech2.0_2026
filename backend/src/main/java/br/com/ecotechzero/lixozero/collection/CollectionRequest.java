package br.com.ecotechzero.lixozero.collection;

import br.com.ecotechzero.lixozero.category.CodigoCategoria;
import br.com.ecotechzero.lixozero.common.BaseEntity;
import br.com.ecotechzero.lixozero.household.SmartBin;
import br.com.ecotechzero.lixozero.route.CollectionRoute;
import br.com.ecotechzero.lixozero.user.User;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import org.hibernate.annotations.DynamicUpdate;

import java.time.LocalDate;
import java.util.EnumSet;
import java.util.HashSet;
import java.util.Set;

/** Solicitação de coleta em domicílio (feita pelo morador ou automaticamente por uma lixeira inteligente). */
@Entity
@Table(name = "collection_requests")
@DynamicUpdate
public class CollectionRequest extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "requester_id")
    private User requester;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "smart_bin_id")
    private SmartBin smartBin;

    @Column(nullable = false, length = 200)
    private String address;

    @Column(nullable = false)
    private double latitude;

    @Column(nullable = false)
    private double longitude;

    @Column(name = "estimated_kg", nullable = false)
    private double estimatedKg;

    @Column(name = "collected_kg")
    private Double collectedKg;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 12)
    private StatusSolicitacaoColeta status = StatusSolicitacaoColeta.REQUESTED;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private OrigemColeta source;

    @Column(name = "preferred_date")
    private LocalDate preferredDate;

    @Column(name = "scheduled_for")
    private LocalDate scheduledFor;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "route_id")
    private CollectionRoute route;

    @Column(length = 500)
    private String notes;

    @ElementCollection
    @CollectionTable(name = "collection_request_categories", joinColumns = @JoinColumn(name = "collection_request_id"))
    @Enumerated(EnumType.STRING)
    @Column(name = "category_code", length = 20)
    private Set<CodigoCategoria> categories = new HashSet<>();

    @Version
    private long version;

    protected CollectionRequest() {
    }

    public CollectionRequest(OrigemColeta source, String address, double latitude, double longitude,
                             Set<CodigoCategoria> categories, double estimatedKg) {
        this.source = source;
        this.address = address;
        this.latitude = latitude;
        this.longitude = longitude;
        this.categories.addAll(categories);
        this.estimatedKg = estimatedKg;
    }

    public boolean isOpen() {
        return StatusSolicitacaoColeta.OPEN.contains(status);
    }

    public void schedule(CollectionRoute route, LocalDate date) {
        this.route = route;
        this.scheduledFor = date;
        this.status = StatusSolicitacaoColeta.SCHEDULED;
    }

    public void markCollected(Double kg) {
        this.status = StatusSolicitacaoColeta.COLLECTED;
        this.collectedKg = kg;
    }

    public void cancel() {
        this.status = StatusSolicitacaoColeta.CANCELLED;
        this.route = null;
    }

    public User getRequester() { return requester; }
    public void setRequester(User requester) { this.requester = requester; }
    public SmartBin getSmartBin() { return smartBin; }
    public void setSmartBin(SmartBin smartBin) { this.smartBin = smartBin; }
    public String getAddress() { return address; }
    public double getLatitude() { return latitude; }
    public double getLongitude() { return longitude; }
    public double getEstimatedKg() { return estimatedKg; }
    public void setEstimatedKg(double estimatedKg) { this.estimatedKg = estimatedKg; }
    public Double getCollectedKg() { return collectedKg; }
    public StatusSolicitacaoColeta getStatus() { return status; }
    public void setStatus(StatusSolicitacaoColeta status) { this.status = status; }
    public OrigemColeta getSource() { return source; }
    public LocalDate getPreferredDate() { return preferredDate; }
    public void setPreferredDate(LocalDate preferredDate) { this.preferredDate = preferredDate; }
    public LocalDate getScheduledFor() { return scheduledFor; }
    public CollectionRoute getRoute() { return route; }
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }

    public Set<CodigoCategoria> getCategories() {
        return categories.isEmpty() ? Set.of() : EnumSet.copyOf(categories);
    }
}
