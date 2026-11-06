package br.com.ecotechzero.lixozero.points;

import br.com.ecotechzero.lixozero.common.PageResponse;
import br.com.ecotechzero.lixozero.security.AuthUser;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Extrato de pontos do usuário logado (GET /api/points/transactions). */
@RestController
public class PointsController {

    private final PointsService servico;

    public PointsController(PointsService servico) {
        this.servico = servico;
    }

    @GetMapping("/api/points/transactions")
    public PageResponse<PointsService.PointTransactionDto> transacoes(@AuthenticationPrincipal AuthUser logado,
                                                                        @RequestParam(required = false) Integer page,
                                                                        @RequestParam(required = false) Integer size) {
        return servico.historico(logado.id(), page, size);
    }
}
