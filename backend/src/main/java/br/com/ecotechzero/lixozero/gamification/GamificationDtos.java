package br.com.ecotechzero.lixozero.gamification;

import br.com.ecotechzero.lixozero.category.CategoryCode;
import br.com.ecotechzero.lixozero.gamification.badge.BadgeRule;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public final class GamificationDtos {

    private GamificationDtos() {
    }

    public record ChallengeInput(
            @NotBlank @Size(min = 3, max = 120) String title,
            @NotBlank @Size(max = 500) String description,
            CategoryCode categoryCode,
            @NotNull Challenge.Metric metric,
            @NotNull @DecimalMin("0.1") @DecimalMax("100000") Double target,
            @NotNull @Min(0) @Max(100000) Integer bonusPoints,
            @NotNull LocalDate startsAt,
            @NotNull LocalDate endsAt,
            @NotNull Boolean active) {
    }

    public record ChallengeDto(UUID id, String title, String description, CategoryCode categoryCode, Challenge.Metric metric,
                               double target, double progress, int bonusPoints, LocalDate startsAt, LocalDate endsAt,
                               boolean active, boolean completed) {
    }

    public record BadgeDto(String code, String name, String description, String icon, BadgeRule.Tier tier,
                           boolean earned, Instant awardedAt) {
    }

    public record LevelRef(int index, String name, long minPoints) {
    }

    public record GamificationSummary(long points, long totalEarned, LevelCatalog.LevelDto level, List<LevelRef> levels,
                                      List<BadgeDto> badges, List<ChallengeDto> challenges, int streakDays) {
    }

    public enum RankingScope { USER, HOUSEHOLD, NEIGHBORHOOD, ORGANIZATION }

    public enum RankingPeriod { WEEK, MONTH, YEAR, ALL }

    public record RankingEntry(int position, String id, String name, String subtitle, long points, double kg, boolean isMe) {
    }

    public record Ranking(RankingScope scope, RankingPeriod period, List<RankingEntry> entries, RankingEntry me) {
    }
}
