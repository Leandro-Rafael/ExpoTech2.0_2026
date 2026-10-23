package br.com.ecotechzero.lixozero.route;

import br.com.ecotechzero.lixozero.common.GeoPoint;
import br.com.ecotechzero.lixozero.user.UserDtos.UserRef;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public final class RouteDtos {

    private RouteDtos() {
    }

    public record OptimizeRequest(
            @NotEmpty @Size(max = 200) List<@NotNull UUID> requestIds,
            @Valid GeoPoint depot,
            @DecimalMin("10") @DecimalMax("20000") Double vehicleCapacityKg) {
    }

    public record CreateRouteRequest(
            @NotBlank @Size(min = 3, max = 100) String name,
            UUID collectorId,
            @NotNull LocalDate plannedDate,
            @NotEmpty @Size(max = 200) List<@NotNull UUID> requestIds,
            @Valid GeoPoint depot,
            @DecimalMin("10") @DecimalMax("20000") Double vehicleCapacityKg) {
    }

    public record CompleteStopRequest(@DecimalMin("0") @DecimalMax("10000") Double collectedKg) {
    }

    public record OptimizedStop(UUID requestId, int sequence, double latitude, double longitude, String address, double estimatedKg) {
    }

    public record OptimizedRoute(List<OptimizedStop> stops, double distanceKm, double naiveDistanceKm, int estimatedMinutes, double loadKg) {
    }

    public record RouteOptimizationDto(String algorithm, List<OptimizedRoute> routes, double totalDistanceKm,
                                       double naiveTotalDistanceKm, double savingsPercent, GeoPoint depot) {
    }

    public record RouteStopDto(UUID id, int sequence, UUID requestId, String address, double latitude, double longitude,
                               double estimatedKg, StopStatus status, Instant completedAt) {
    }

    public record RouteDto(UUID id, String name, RouteStatus status, UserRef collector, LocalDate plannedDate,
                           double totalDistanceKm, double naiveDistanceKm, int estimatedMinutes, double loadKg,
                           GeoPoint depot, List<RouteStopDto> stops, Instant createdAt) {
    }
}
