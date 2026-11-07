package br.com.ecotechzero.lixozero.points;

import br.com.ecotechzero.lixozero.common.RespostaPaginada;
import br.com.ecotechzero.lixozero.security.UsuarioAutenticado;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Extrato de pontos do usuário logado (GET /api/points/transactions). */
@RestController
public class ControladorPontos {

    private final ServicoPontos servico;

    public ControladorPontos(ServicoPontos servico) {
        this.servico = servico;
    }

    @GetMapping("/api/points/transactions")
    public RespostaPaginada<ServicoPontos.PointTransactionDto> transacoes(@AuthenticationPrincipal UsuarioAutenticado logado,
                                                                        @RequestParam(required = false) Integer page,
                                                                        @RequestParam(required = false) Integer size) {
        return servico.historico(logado.id(), page, size);
    }
}
