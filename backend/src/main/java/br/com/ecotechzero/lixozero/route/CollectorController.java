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

    private final RouteService routes;

    public CollectorController(RouteService routes) {
        this.routes = routes;
    }

    @GetMapping("/routes")
    public List<RouteDto> myRoutes(@AuthenticationPrincipal AuthUser me) {
        return routes.listForCollector(me);
    }

    @PostMapping("/routes/{id}/start")
    public RouteDto start(@AuthenticationPrincipal AuthUser me, @PathVariable UUID id) {
        return routes.start(me, id);
    }

    @PostMapping("/routes/{routeId}/stops/{stopId}/complete")
    public RouteDto completeStop(@AuthenticationPrincipal AuthUser me, @PathVariable UUID routeId, @PathVariable UUID stopId,
                                 @Valid @RequestBody(required = false) CompleteStopRequest body) {
        return routes.completeStop(me, routeId, stopId, body == null ? null : body.collectedKg());
    }
}
