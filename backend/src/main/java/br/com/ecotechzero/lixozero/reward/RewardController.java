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

/** Endpoints do morador para ver o catálogo, resgatar recompensas e ver os próprios resgates. */
@RestController
public class RewardController {

    private final RewardService servico;

    public RewardController(RewardService servico) {
        this.servico = servico;
    }

    @GetMapping("/api/rewards")
    public List<RewardDto> recompensas() {
        return servico.listarAtivas();
    }

    @PostMapping("/api/rewards/{id}/redeem")
    @ResponseStatus(HttpStatus.CREATED)
    public RedemptionDto resgatar(@AuthenticationPrincipal AuthUser logado, @PathVariable UUID id) {
        return servico.resgatar(logado.id(), id);
    }

    @GetMapping("/api/redemptions")
    public List<RedemptionDto> resgates(@AuthenticationPrincipal AuthUser logado) {
        return servico.historico(logado.id());
    }
}
