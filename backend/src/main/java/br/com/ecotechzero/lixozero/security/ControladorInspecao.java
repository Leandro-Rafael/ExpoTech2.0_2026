package br.com.ecotechzero.lixozero.security;

import br.com.ecotechzero.lixozero.security.ServicoInspecao.InspectionEventRequest;
import br.com.ecotechzero.lixozero.security.ServicoInspecao.InspectionEventResult;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/** Avisos de inspeção enviados pelo guarda da área logada (autenticado + CSRF, como todo POST). */
@RestController
public class ControladorInspecao {

    private final ServicoInspecao servico;

    public ControladorInspecao(ServicoInspecao servico) {
        this.servico = servico;
    }

    @PostMapping("/api/security/inspection-events")
    public InspectionEventResult registrar(@AuthenticationPrincipal UsuarioAutenticado logado, @Valid @RequestBody InspectionEventRequest corpo) {
        return servico.registrarAviso(logado.id(), corpo.trigger());
    }
}
