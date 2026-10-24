package br.com.ecotechzero.lixozero.impact;

import br.com.ecotechzero.lixozero.category.CategoryCode;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;
import java.util.UUID;

public final class ImpactDtos {

    private ImpactDtos() {
    }

    public enum Scope { ME, COMMUNITY }

    public record PublicStats(double totalKg, double recycledKg, double co2AvoidedKg, double treesEquivalent,
                              long users, long households, long disposals, long collectionPoints) {
    }

    public record GoalInput(
            @NotNull @Min(2000) @Max(2100) Integer year,
            @NotBlank @Size(min = 3, max = 120) String title,
            @NotNull @DecimalMin("0") @DecimalMax("1") Double targetRecyclingRate,
            @NotNull @DecimalMin("0") @DecimalMax("1000000000") Double targetKg) {
    }

    public record GoalDto(UUID id, int year, String title, double targetRecyclingRate, double targetKg,
                          double currentRate, double currentKg, double progress) {
    }

    public record CategorySlice(CategoryCode code, String name, String color, double kg, double percent) {
    }

    public record MonthPoint(String month, double kg, double recycledKg, double co2AvoidedKg) {
    }

    public record ImpactSummary(Scope scope, double totalKg, double recycledKg, double recyclingRate, double co2AvoidedKg,
                                double treesEquivalent, double energySavedKwh, double waterSavedLiters, long disposalsCount,
                                List<CategorySlice> byCategory, List<MonthPoint> byMonth, List<GoalDto> goals) {
    }

    public record SimulationInput(
            @NotNull @Min(1) @Max(50_000_000) Integer population,
            @NotNull @DecimalMin("0.1") @DecimalMax("5") Double kgPerCapitaDay,
            @NotNull @DecimalMin("0") @DecimalMax("1") Double currentRecyclingRate,
            @NotNull @DecimalMin("0") @DecimalMax("1") Double targetRecyclingRate,
            @NotNull @Min(2027) @Max(2050) Integer targetYear,
            @NotNull @DecimalMin("-0.05") @DecimalMax("0.10") Double annualGrowthRate) {
    }

    public record SimulationYear(int year, double generatedTons, double recyclingRate, double recycledTonsBaseline,
                                 double recycledTonsScenario, double landfillTonsBaseline, double landfillTonsScenario,
                                 double co2AvoidedTonsScenario) {
    }

    public record SimulationTotals(double landfillAvoidedTons, double co2AvoidedTons, double treesEquivalent,
                                   double truckloadsAvoided, double jobsCreated) {
    }

    public record SimulationResult(List<SimulationYear> years, SimulationTotals totals) {
    }
}
