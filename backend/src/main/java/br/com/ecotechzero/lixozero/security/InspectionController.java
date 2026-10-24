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

    private final InspectionService service;

    public InspectionController(InspectionService service) {
        this.service = service;
    }

    @PostMapping("/api/security/inspection-events")
    public InspectionEventResult report(@AuthenticationPrincipal AuthUser me, @Valid @RequestBody InspectionEventRequest body) {
        return service.report(me.id(), body.trigger());
    }
}
