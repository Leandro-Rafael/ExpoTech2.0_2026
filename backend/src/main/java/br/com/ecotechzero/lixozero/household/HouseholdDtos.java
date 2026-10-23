package br.com.ecotechzero.lixozero.household;

import br.com.ecotechzero.lixozero.category.CategoryDtos.CategoryRef;
import br.com.ecotechzero.lixozero.user.UserDtos.HouseholdRef;
import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public final class HouseholdDtos {

    private HouseholdDtos() {
    }

    /** Endereço e coordenadas são opcionais (usados nas coletas automáticas das lixeiras). */
    public record CreateHouseholdRequest(
            @NotBlank @Size(min = 2, max = 80) String name,
            @NotBlank @Size(min = 2, max = 80) String neighborhood,
            @NotBlank @Size(min = 2, max = 80) String city,
            @Size(max = 200) String address,
            @DecimalMin("-90") @DecimalMax("90") Double latitude,
            @DecimalMin("-180") @DecimalMax("180") Double longitude) {
    }

    public record JoinHouseholdRequest(@NotBlank @Pattern(regexp = "^[A-Za-z0-9]{6,12}$", message = "código de convite inválido") String inviteCode) {
    }

    public record HouseholdMember(UUID id, String name, long points, boolean isOwner) {
    }

    public record HouseholdStats(double totalKg, double monthKg, long points, double co2AvoidedKg) {
    }

    public record HouseholdDto(UUID id, String name, String neighborhood, String city, String inviteCode,
                               List<HouseholdMember> members, HouseholdStats stats) {
    }

    public record CreateBinRequest(
            @NotBlank @Size(min = 2, max = 60) String name,
            @NotNull UUID categoryId,
            @NotNull @Min(5) @Max(1000) Integer capacityLiters,
            @NotNull @Min(50) @Max(100) Integer autoRequestThreshold) {
    }

    public record ReadingPoint(int fillLevel, Instant at) {
    }

    public record SmartBinDto(UUID id, String name, CategoryRef category, int capacityLiters, int fillLevel,
                              int batteryLevel, SmartBinStatus status, int autoRequestThreshold, Instant lastReadingAt,
                              List<ReadingPoint> history,
                              @JsonInclude(JsonInclude.Include.NON_NULL) HouseholdRef household) {
    }

    public record SmartBinCreated(SmartBinDto bin, UUID deviceId, String deviceKey) {
    }

    /** Leitura enviada pelo dispositivo IoT. */
    public record ReadingRequest(
            @NotNull @DecimalMin("0") @DecimalMax("100") Double fillLevel,
            @NotNull @DecimalMin("0") @DecimalMax("100") Double batteryLevel) {
    }
}
