package br.com.ecotechzero.lixozero.route;

import br.com.ecotechzero.lixozero.route.DtosRota.CompleteStopRequest;
import br.com.ecotechzero.lixozero.route.DtosRota.RouteDto;
import br.com.ecotechzero.lixozero.security.UsuarioAutenticado;
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

/** Área do coletor (perfil COLLECTOR ou ADMIN, garantido pelo ConfigSeguranca). */
@RestController
@RequestMapping("/api/collector")
public class ControladorColetor {

    private final ServicoRotas rotas;

    public ControladorColetor(ServicoRotas rotas) {
        this.rotas = rotas;
    }

    @GetMapping("/routes")
    public List<RouteDto> minhasRotas(@AuthenticationPrincipal UsuarioAutenticado logado) {
        return rotas.listarDoColetor(logado);
    }

    @PostMapping("/routes/{id}/start")
    public RouteDto iniciar(@AuthenticationPrincipal UsuarioAutenticado logado, @PathVariable UUID id) {
        return rotas.iniciar(logado, id);
    }

    @PostMapping("/routes/{routeId}/stops/{stopId}/complete")
    public RouteDto concluirParada(@AuthenticationPrincipal UsuarioAutenticado logado, @PathVariable UUID routeId, @PathVariable UUID stopId,
                                 @Valid @RequestBody(required = false) CompleteStopRequest corpo) {
        return rotas.concluirParada(logado, routeId, stopId, corpo == null ? null : corpo.collectedKg());
    }
}
