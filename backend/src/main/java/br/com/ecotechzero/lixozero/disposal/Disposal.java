package br.com.ecotechzero.lixozero.disposal;

import br.com.ecotechzero.lixozero.ai.AiSource;
import br.com.ecotechzero.lixozero.category.Category;
import br.com.ecotechzero.lixozero.category.CategoryCode;
import br.com.ecotechzero.lixozero.collection.CollectionPoint;
import br.com.ecotechzero.lixozero.common.BaseEntity;
import br.com.ecotechzero.lixozero.photo.Photo;
import br.com.ecotechzero.lixozero.user.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

import java.time.Instant;
import java.util.Arrays;
import java.util.List;

/**
 * Registro de descarte feito por um morador. Começa PENDENTE e só gera pontos quando aprovado.
 * As transições de estado ficam encapsuladas nos métodos {@link #approve} e {@link #reject}.
 */
@Entity
@Table(name = "disposals")
public class Disposal extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "category_id", nullable = false)
    private Category category;

    @Column(name = "quantity_kg", nullable = false)
    private double quantityKg;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private DisposalStatus status = DisposalStatus.PENDING;

    @Column(name = "points_awarded", nullable = false)
    private int pointsAwarded;

    @Column(name = "estimated_points", nullable = false)
    private int estimatedPoints;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "photo_id")
    private Photo photo;

    private Double latitude;

    private Double longitude;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "collection_point_id")
    private CollectionPoint collectionPoint;

    @Column(name = "disposed_at", nullable = false)
    private Instant disposedAt;

    @Column(name = "reviewed_at")
    private Instant reviewedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reviewed_by")
    private User reviewedBy;

    @Column(name = "rejection_reason", length = 300)
    private String rejectionReason;

    @Column(length = 500)
    private String notes;

    @Enumerated(EnumType.STRING)
    @Column(name = "ai_suggested_code", length = 20)
    private CategoryCode aiSuggestedCode;

    @Column(name = "ai_confidence")
    private Double aiConfidence;

    @Enumerated(EnumType.STRING)
    @Column(name = "ai_source", length = 10)
    private AiSource aiSource;

    @Column(name = "fraud_score", nullable = false)
    private int fraudScore;

    @Column(name = "fraud_flags", columnDefinition = "text")
    private String fraudFlags;

    @Column(nullable = false)
    private boolean flagged;

    @Column(name = "idempotency_key", length = 64)
    private String idempotencyKey;

    @Version
    private long version;

    protected Disposal() {
    }

    public Disposal(User user, Category category, double quantityKg, Instant disposedAt) {
        this.user = user;
        this.category = category;
        this.quantityKg = quantityKg;
        this.disposedAt = disposedAt;
    }

    public boolean isPending() {
        return status == DisposalStatus.PENDING;
    }

    /** Aprova e registra os pontos concedidos. Só é chamado para descartes pendentes. */
    public void approve(int points, User reviewer, Instant at) {
        if (status != DisposalStatus.PENDING) {
            throw new IllegalStateException("Somente descartes pendentes podem ser aprovados");
        }
        this.status = DisposalStatus.APPROVED;
        this.pointsAwarded = points;
        this.estimatedPoints = points;
        this.reviewedBy = reviewer;
        this.reviewedAt = at;
        this.rejectionReason = null;
    }

    public void reject(String reason, User reviewer, Instant at) {
        if (status != DisposalStatus.PENDING) {
            throw new IllegalStateException("Somente descartes pendentes podem ser recusados");
        }
        this.status = DisposalStatus.REJECTED;
        this.pointsAwarded = 0;
        this.rejectionReason = reason;
        this.reviewedBy = reviewer;
        this.reviewedAt = at;
    }

    /** Correção feita pelo administrador durante a revisão. */
    public void correct(Category category, double quantityKg) {
        this.category = category;
        this.quantityKg = quantityKg;
    }

    public void setFraud(int score, List<String> flags, boolean flagged) {
        this.fraudScore = score;
        this.fraudFlags = flags.isEmpty() ? null : String.join("\n", flags);
        this.flagged = flagged;
    }

    public List<String> getFraudFlagList() {
        return fraudFlags == null || fraudFlags.isBlank() ? List.of() : Arrays.asList(fraudFlags.split("\n"));
    }

    public void setLocation(Double latitude, Double longitude) {
        this.latitude = latitude;
        this.longitude = longitude;
    }

    public void setAi(CategoryCode code, Double confidence, AiSource source) {
        this.aiSuggestedCode = code;
        this.aiConfidence = confidence;
        this.aiSource = source;
    }

    public User getUser() { return user; }
    public Category getCategory() { return category; }
    public double getQuantityKg() { return quantityKg; }
    public DisposalStatus getStatus() { return status; }
    public void setStatus(DisposalStatus status) { this.status = status; }
    public int getPointsAwarded() { return pointsAwarded; }
    public void setPointsAwarded(int pointsAwarded) { this.pointsAwarded = pointsAwarded; }
    public int getEstimatedPoints() { return estimatedPoints; }
    public void setEstimatedPoints(int estimatedPoints) { this.estimatedPoints = estimatedPoints; }
    public Photo getPhoto() { return photo; }
    public void setPhoto(Photo photo) { this.photo = photo; }
    public Double getLatitude() { return latitude; }
    public Double getLongitude() { return longitude; }
    public CollectionPoint getCollectionPoint() { return collectionPoint; }
    public void setCollectionPoint(CollectionPoint collectionPoint) { this.collectionPoint = collectionPoint; }
    public Instant getDisposedAt() { return disposedAt; }
    public Instant getReviewedAt() { return reviewedAt; }
    public void setReviewedAt(Instant reviewedAt) { this.reviewedAt = reviewedAt; }
    public String getRejectionReason() { return rejectionReason; }
    public void setRejectionReason(String rejectionReason) { this.rejectionReason = rejectionReason; }
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
    public CategoryCode getAiSuggestedCode() { return aiSuggestedCode; }
    public Double getAiConfidence() { return aiConfidence; }
    public AiSource getAiSource() { return aiSource; }
    public int getFraudScore() { return fraudScore; }
    public boolean isFlagged() { return flagged; }
    public String getIdempotencyKey() { return idempotencyKey; }
    public void setIdempotencyKey(String idempotencyKey) { this.idempotencyKey = idempotencyKey; }
}
