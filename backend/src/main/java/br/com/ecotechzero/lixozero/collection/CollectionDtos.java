package br.com.ecotechzero.lixozero.collection;

import br.com.ecotechzero.lixozero.category.CategoryCode;
import br.com.ecotechzero.lixozero.user.UserDtos.UserRef;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import java.util.UUID;

public final class CollectionDtos {

    private CollectionDtos() {
    }

    public record CollectionPointDto(UUID id, String name, String address, String neighborhood, double latitude,
                                     double longitude, String openingHours, List<CategoryCode> categories,
                                     boolean active, Double distanceKm) {
    }

    public record CollectionPointInput(
            @NotBlank @Size(min = 3, max = 120) String name,
            @NotBlank @Size(min = 5, max = 200) String address,
            @NotBlank @Size(min = 2, max = 80) String neighborhood,
            @NotNull @DecimalMin("-90") @DecimalMax("90") Double latitude,
            @NotNull @DecimalMin("-180") @DecimalMax("180") Double longitude,
            @NotBlank @Size(max = 120) String openingHours,
            @NotEmpty @Size(max = 7) Set<@NotNull CategoryCode> categories,
            @NotNull Boolean active) {
    }

    public record CreateCollectionRequest(
            @NotBlank @Size(min = 5, max = 200) String address,
            @NotNull @DecimalMin("-90") @DecimalMax("90") Double latitude,
            @NotNull @DecimalMin("-180") @DecimalMax("180") Double longitude,
            @NotEmpty @Size(max = 7) Set<@NotNull CategoryCode> categoryCodes,
            @NotNull @DecimalMin("0.5") @DecimalMax("500") Double estimatedKg,
            LocalDate preferredDate,
            @Size(max = 500) String notes) {
    }

    public record SmartBinRef(UUID id, String name) {
    }

    public record CollectionRequestDto(UUID id, String address, double latitude, double longitude,
                                       List<CategoryCode> categoryCodes, double estimatedKg,
                                       CollectionRequestStatus status, CollectionSource source, int priority,
                                       LocalDate preferredDate, LocalDate scheduledFor, UUID routeId, String notes,
                                       Instant createdAt, Instant updatedAt, UserRef requester, SmartBinRef smartBin) {
    }
}
