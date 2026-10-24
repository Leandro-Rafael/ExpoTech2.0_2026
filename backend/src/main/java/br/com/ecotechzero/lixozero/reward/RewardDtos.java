package br.com.ecotechzero.lixozero.reward;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.UUID;

public final class RewardDtos {

    private RewardDtos() {
    }

    public record RewardDto(UUID id, String name, String description, int costPoints, int stock, String icon,
                            String partner, boolean active) {
        public static RewardDto of(Reward r) {
            return new RewardDto(r.getId(), r.getName(), r.getDescription(), r.getCostPoints(), r.getStock(), r.getIcon(),
                    r.getPartner(), r.isActive());
        }
    }

    public record RewardInput(
            @NotBlank @Size(min = 2, max = 120) String name,
            @NotBlank @Size(max = 500) String description,
            @NotNull @Min(1) @Max(1_000_000) Integer costPoints,
            @NotNull @Min(0) @Max(1_000_000) Integer stock,
            @NotNull @Pattern(regexp = "^[a-z0-9-]{1,40}$", message = "nome de ícone inválido") String icon,
            @Size(max = 120) String partner,
            @NotNull Boolean active) {
    }

    public record RewardRef(UUID id, String name, String icon) {
    }

    public record RedemptionDto(UUID id, RewardRef reward, int cost, String code, Redemption.Status status, Instant createdAt) {
        public static RedemptionDto of(Redemption r) {
            Reward reward = r.getReward();
            return new RedemptionDto(r.getId(), new RewardRef(reward.getId(), reward.getName(), reward.getIcon()),
                    r.getCost(), r.getCode(), r.getStatus(), r.getCreatedAt());
        }
    }
}
