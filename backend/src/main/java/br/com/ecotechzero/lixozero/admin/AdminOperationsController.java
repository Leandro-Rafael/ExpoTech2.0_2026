package br.com.ecotechzero.lixozero.admin;

import br.com.ecotechzero.lixozero.collection.CollectionDtos.CollectionRequestDto;
import br.com.ecotechzero.lixozero.collection.CollectionRequestService;
import br.com.ecotechzero.lixozero.collection.CollectionRequestStatus;
import br.com.ecotechzero.lixozero.household.HouseholdDtos.SmartBinDto;
import br.com.ecotechzero.lixozero.household.SmartBinService;
import br.com.ecotechzero.lixozero.route.RouteDtos.CreateRouteRequest;
import br.com.ecotechzero.lixozero.route.RouteDtos.OptimizeRequest;
import br.com.ecotechzero.lixozero.route.RouteDtos.RouteDto;
import br.com.ecotechzero.lixozero.route.RouteDtos.RouteOptimizationDto;
import br.com.ecotechzero.lixozero.route.RouteService;
import br.com.ecotechzero.lixozero.user.UserDtos.UserRef;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** Operação de coletas: solicitações, coletores, otimização/criação de rotas e lixeiras. */
@RestController
@RequestMapping("/api/admin")
public class AdminOperationsController {

    private final CollectionRequestService solicitacoes;
    private final AdminService servicoAdmin;
    private final RouteService rotas;
    private final SmartBinService lixeiras;

    public AdminOperationsController(CollectionRequestService solicitacoes, AdminService servicoAdmin, RouteService rotas, SmartBinService lixeiras) {
        this.solicitacoes = solicitacoes;
        this.servicoAdmin = servicoAdmin;
        this.rotas = rotas;
        this.lixeiras = lixeiras;
    }

    @GetMapping("/collection-requests")
    public List<CollectionRequestDto> solicitacoesColeta(@RequestParam(required = false) CollectionRequestStatus status) {
        return solicitacoes.listarTodas(status);
    }

    @GetMapping("/collectors")
    public List<UserRef> coletores() {
        return servicoAdmin.coletores();
    }

    @PostMapping("/routes/optimize")
    public RouteOptimizationDto otimizar(@Valid @RequestBody OptimizeRequest corpo) {
        return rotas.otimizar(corpo);
    }

    @PostMapping("/routes")
    @ResponseStatus(HttpStatus.CREATED)
    public List<RouteDto> criarRotas(@Valid @RequestBody CreateRouteRequest corpo) {
        return rotas.criar(corpo);
    }

    @GetMapping("/routes")
    public List<RouteDto> listarRotas() {
        return rotas.listarTodas();
    }

    @GetMapping("/bins")
    public List<SmartBinDto> lixeiras() {
        return lixeiras.listarTodas();
    }
}
