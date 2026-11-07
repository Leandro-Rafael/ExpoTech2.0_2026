package br.com.ecotechzero.lixozero.disposal;

import br.com.ecotechzero.lixozero.ai.OrigemIa;
import br.com.ecotechzero.lixozero.category.CodigoCategoria;
import br.com.ecotechzero.lixozero.category.DtosCategoria.CategoryRef;
import br.com.ecotechzero.lixozero.common.Numeros;
import br.com.ecotechzero.lixozero.photo.ServicoFotos;
import br.com.ecotechzero.lixozero.user.DtosUsuario.UserRef;
import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Objetos de entrada e saída da API de descartes (as anotações já barram valores fora do limite). */
public final class DtosDescarte {

    private DtosDescarte() {
    }

    public record CreateDisposalRequest(
            @NotNull UUID categoryId,
            @NotNull @DecimalMin("0.01") @DecimalMax("1000") Double quantityKg,
            UUID photoId,
            @DecimalMin("-90") @DecimalMax("90") Double latitude,
            @DecimalMin("-180") @DecimalMax("180") Double longitude,
            UUID collectionPointId,
            Instant disposedAt,
            CodigoCategoria aiSuggestedCode,
            @DecimalMin("0") @DecimalMax("1") Double aiConfidence,
            OrigemIa aiSource,
            @Size(max = 500) String notes) {
    }

    public record ApproveRequest(UUID categoryId, @DecimalMin("0.01") @DecimalMax("1000") Double quantityKg) {
    }

    public record RejectRequest(@NotBlank @Size(min = 3, max = 300) String reason) {
    }

    public record PointRef(UUID id, String name) {
    }

    /** verified = classificação do servidor (vale o bônus); false = palpite do navegador, só informativo. */
    public record AiInfo(CodigoCategoria suggestedCode, Double confidence, OrigemIa source, boolean verified) {
    }

    public record FraudInfo(int score, List<String> flags) {
    }

    public record DisposalDto(UUID id, CategoryRef category, double quantityKg, StatusDescarte status, int pointsAwarded,
                              int estimatedPoints, String photoUrl, Double latitude, Double longitude, PointRef collectionPoint,
                              Instant disposedAt, Instant createdAt, Instant reviewedAt, String rejectionReason, String notes,
                              AiInfo ai,
                              @JsonInclude(JsonInclude.Include.NON_NULL) UserRef user,
                              @JsonInclude(JsonInclude.Include.NON_NULL) FraudInfo fraud) {

        /** adminView = inclui usuário (com e-mail) e dados antifraude. */
        public static DisposalDto of(Disposal d, boolean visaoAdmin) {
            var ecoponto = d.getCollectionPoint();
            AiInfo ai = d.getAiSuggestedCode() == null && d.getAiSource() == null ? null
                    : new AiInfo(d.getAiSuggestedCode(), d.getAiConfidence(), d.getAiSource(), d.isAiVerified());
            return new DisposalDto(d.getId(), CategoryRef.of(d.getCategory()), Numeros.arredondar(d.getQuantityKg(), 3), d.getStatus(),
                    d.getPointsAwarded(), d.getEstimatedPoints(),
                    d.getPhoto() == null ? null : ServicoFotos.url(d.getPhoto().getId()),
                    d.getLatitude(), d.getLongitude(), ecoponto == null ? null : new PointRef(ecoponto.getId(), ecoponto.getName()),
                    d.getDisposedAt(), d.getCreatedAt(), d.getReviewedAt(), d.getRejectionReason(), d.getNotes(), ai,
                    visaoAdmin ? UserRef.withEmail(d.getUser()) : null,
                    visaoAdmin ? new FraudInfo(d.getFraudScore(), d.getFraudFlagList()) : null);
        }
    }
}
