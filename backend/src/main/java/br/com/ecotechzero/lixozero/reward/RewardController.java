package br.com.ecotechzero.lixozero.reward;

import br.com.ecotechzero.lixozero.reward.RewardDtos.RedemptionDto;
import br.com.ecotechzero.lixozero.reward.RewardDtos.RewardDto;
import br.com.ecotechzero.lixozero.security.AuthUser;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
public class RewardController {

    private final RewardService service;

    public RewardController(RewardService service) {
        this.service = service;
    }

    @GetMapping("/api/rewards")
    public List<RewardDto> rewards() {
        return service.listActive();
    }

    @PostMapping("/api/rewards/{id}/redeem")
    @ResponseStatus(HttpStatus.CREATED)
    public RedemptionDto redeem(@AuthenticationPrincipal AuthUser me, @PathVariable UUID id) {
        return service.redeem(me.id(), id);
    }

    @GetMapping("/api/redemptions")
    public List<RedemptionDto> redemptions(@AuthenticationPrincipal AuthUser me) {
        return service.history(me.id());
    }
}
