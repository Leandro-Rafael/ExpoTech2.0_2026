package br.com.ecotechzero.lixozero.reward;

import br.com.ecotechzero.lixozero.reward.DtosRecompensa.RedemptionDto;
import br.com.ecotechzero.lixozero.reward.DtosRecompensa.RewardDto;
import br.com.ecotechzero.lixozero.security.UsuarioAutenticado;
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
public class ControladorRecompensas {

    private final ServicoRecompensas servico;

    public ControladorRecompensas(ServicoRecompensas servico) {
        this.servico = servico;
    }

    @GetMapping("/api/rewards")
    public List<RewardDto> recompensas() {
        return servico.listarAtivas();
    }

    @PostMapping("/api/rewards/{id}/redeem")
    @ResponseStatus(HttpStatus.CREATED)
    public RedemptionDto resgatar(@AuthenticationPrincipal UsuarioAutenticado logado, @PathVariable UUID id) {
        return servico.resgatar(logado.id(), id);
    }

    @GetMapping("/api/redemptions")
    public List<RedemptionDto> resgates(@AuthenticationPrincipal UsuarioAutenticado logado) {
        return servico.historico(logado.id());
    }
}
