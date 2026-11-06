package br.com.ecotechzero.lixozero.security;

import br.com.ecotechzero.lixozero.security.InspectionService.InspectionEventRequest;
import br.com.ecotechzero.lixozero.security.InspectionService.InspectionEventResult;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/** Avisos de inspeção enviados pelo guarda da área logada (autenticado + CSRF, como todo POST). */
@RestController
public class InspectionController {

    private final InspectionService servico;

    public InspectionController(InspectionService servico) {
        this.servico = servico;
    }

    @PostMapping("/api/security/inspection-events")
    public InspectionEventResult registrar(@AuthenticationPrincipal AuthUser logado, @Valid @RequestBody InspectionEventRequest corpo) {
        return servico.registrarAviso(logado.id(), corpo.trigger());
    }
}
