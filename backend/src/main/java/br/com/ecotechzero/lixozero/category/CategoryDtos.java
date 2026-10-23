package br.com.ecotechzero.lixozero.category;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.List;
import java.util.UUID;

public final class CategoryDtos {

    private CategoryDtos() {
    }

    public record CategoryDto(UUID id, CategoryCode code, String name, String description, List<String> guidance,
                              int pointsPerKg, double co2FactorKg, boolean recyclable, String color, String icon,
                              double maxKgPerDisposal, boolean active) {
        public static CategoryDto of(Category c) {
            return new CategoryDto(c.getId(), c.getCode(), c.getName(), c.getDescription(), c.getGuidance(),
                    c.getPointsPerKg(), c.getCo2FactorKg(), c.isRecyclable(), c.getColor(), c.getIcon(),
                    c.getMaxKgPerDisposal(), c.isActive());
        }
    }

    /** Referência compacta usada em descartes e lixeiras. */
    public record CategoryRef(UUID id, CategoryCode code, String name, String color, String icon) {
        public static CategoryRef of(Category c) {
            return c == null ? null : new CategoryRef(c.getId(), c.getCode(), c.getName(), c.getColor(), c.getIcon());
        }
    }

    public record CategoryInput(
            @NotNull CategoryCode code,
            @NotBlank @Size(min = 2, max = 60) String name,
            @NotBlank @Size(max = 500) String description,
            @NotNull @Size(min = 1, max = 10) List<@NotBlank @Size(max = 200) String> guidance,
            @NotNull @Min(0) @Max(1000) Integer pointsPerKg,
            @NotNull @DecimalMin("0") @DecimalMax("50") Double co2FactorKg,
            @NotNull Boolean recyclable,
            @NotNull @Pattern(regexp = "^#[0-9A-Fa-f]{6}$", message = "cor deve estar no formato #RRGGBB") String color,
            @NotNull @Pattern(regexp = "^[a-z0-9-]{1,40}$", message = "nome de ícone inválido") String icon,
            @NotNull @DecimalMin("0.1") @DecimalMax("1000") Double maxKgPerDisposal,
            @NotNull Boolean active) {
    }
}
