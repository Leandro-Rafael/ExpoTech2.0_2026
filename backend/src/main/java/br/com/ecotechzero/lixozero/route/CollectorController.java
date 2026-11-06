package br.com.ecotechzero.lixozero.route;

import br.com.ecotechzero.lixozero.route.RouteDtos.CompleteStopRequest;
import br.com.ecotechzero.lixozero.route.RouteDtos.RouteDto;
import br.com.ecotechzero.lixozero.security.AuthUser;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/** Área do coletor (perfil COLLECTOR ou ADMIN, garantido pelo SecurityConfig). */
@RestController
@RequestMapping("/api/collector")
public class CollectorController {

    private final RouteService rotas;

    public CollectorController(RouteService rotas) {
        this.rotas = rotas;
    }

    @GetMapping("/routes")
    public List<RouteDto> minhasRotas(@AuthenticationPrincipal AuthUser logado) {
        return rotas.listarDoColetor(logado);
    }

    @PostMapping("/routes/{id}/start")
    public RouteDto iniciar(@AuthenticationPrincipal AuthUser logado, @PathVariable UUID id) {
        return rotas.iniciar(logado, id);
    }

    @PostMapping("/routes/{routeId}/stops/{stopId}/complete")
    public RouteDto concluirParada(@AuthenticationPrincipal AuthUser logado, @PathVariable UUID routeId, @PathVariable UUID stopId,
                                 @Valid @RequestBody(required = false) CompleteStopRequest corpo) {
        return rotas.concluirParada(logado, routeId, stopId, corpo == null ? null : corpo.collectedKg());
    }
}
