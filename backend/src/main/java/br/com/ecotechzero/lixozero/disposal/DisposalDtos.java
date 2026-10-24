package br.com.ecotechzero.lixozero.disposal;

import br.com.ecotechzero.lixozero.ai.AiSource;
import br.com.ecotechzero.lixozero.category.CategoryCode;
import br.com.ecotechzero.lixozero.category.CategoryDtos.CategoryRef;
import br.com.ecotechzero.lixozero.common.Numbers;
import br.com.ecotechzero.lixozero.photo.PhotoService;
import br.com.ecotechzero.lixozero.user.UserDtos.UserRef;
import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public final class DisposalDtos {

    private DisposalDtos() {
    }

    public record CreateDisposalRequest(
            @NotNull UUID categoryId,
            @NotNull @DecimalMin("0.01") @DecimalMax("1000") Double quantityKg,
            UUID photoId,
            @DecimalMin("-90") @DecimalMax("90") Double latitude,
            @DecimalMin("-180") @DecimalMax("180") Double longitude,
            UUID collectionPointId,
            Instant disposedAt,
            CategoryCode aiSuggestedCode,
            @DecimalMin("0") @DecimalMax("1") Double aiConfidence,
            AiSource aiSource,
            @Size(max = 500) String notes) {
    }

    public record ApproveRequest(UUID categoryId, @DecimalMin("0.01") @DecimalMax("1000") Double quantityKg) {
    }

    public record RejectRequest(@NotBlank @Size(min = 3, max = 300) String reason) {
    }

    public record PointRef(UUID id, String name) {
    }

    public record AiInfo(CategoryCode suggestedCode, Double confidence, AiSource source) {
    }

    public record FraudInfo(int score, List<String> flags) {
    }

    public record DisposalDto(UUID id, CategoryRef category, double quantityKg, DisposalStatus status, int pointsAwarded,
                              int estimatedPoints, String photoUrl, Double latitude, Double longitude, PointRef collectionPoint,
                              Instant disposedAt, Instant createdAt, Instant reviewedAt, String rejectionReason, String notes,
                              AiInfo ai,
                              @JsonInclude(JsonInclude.Include.NON_NULL) UserRef user,
                              @JsonInclude(JsonInclude.Include.NON_NULL) FraudInfo fraud) {

        /** adminView = inclui usuário (com e-mail) e dados antifraude. */
        public static DisposalDto of(Disposal d, boolean adminView) {
            var point = d.getCollectionPoint();
            AiInfo ai = d.getAiSuggestedCode() == null && d.getAiSource() == null ? null
                    : new AiInfo(d.getAiSuggestedCode(), d.getAiConfidence(), d.getAiSource());
            return new DisposalDto(d.getId(), CategoryRef.of(d.getCategory()), Numbers.round(d.getQuantityKg(), 3), d.getStatus(),
                    d.getPointsAwarded(), d.getEstimatedPoints(),
                    d.getPhoto() == null ? null : PhotoService.url(d.getPhoto().getId()),
                    d.getLatitude(), d.getLongitude(), point == null ? null : new PointRef(point.getId(), point.getName()),
                    d.getDisposedAt(), d.getCreatedAt(), d.getReviewedAt(), d.getRejectionReason(), d.getNotes(), ai,
                    adminView ? UserRef.withEmail(d.getUser()) : null,
                    adminView ? new FraudInfo(d.getFraudScore(), d.getFraudFlagList()) : null);
        }
    }
}
