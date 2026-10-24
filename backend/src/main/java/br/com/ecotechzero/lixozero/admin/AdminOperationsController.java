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

    private final CollectionRequestService requests;
    private final AdminService admin;
    private final RouteService routes;
    private final SmartBinService bins;

    public AdminOperationsController(CollectionRequestService requests, AdminService admin, RouteService routes, SmartBinService bins) {
        this.requests = requests;
        this.admin = admin;
        this.routes = routes;
        this.bins = bins;
    }

    @GetMapping("/collection-requests")
    public List<CollectionRequestDto> collectionRequests(@RequestParam(required = false) CollectionRequestStatus status) {
        return requests.listAll(status);
    }

    @GetMapping("/collectors")
    public List<UserRef> collectors() {
        return admin.collectors();
    }

    @PostMapping("/routes/optimize")
    public RouteOptimizationDto optimize(@Valid @RequestBody OptimizeRequest body) {
        return routes.optimize(body);
    }

    @PostMapping("/routes")
    @ResponseStatus(HttpStatus.CREATED)
    public List<RouteDto> createRoutes(@Valid @RequestBody CreateRouteRequest body) {
        return routes.create(body);
    }

    @GetMapping("/routes")
    public List<RouteDto> listRoutes() {
        return routes.listAll();
    }

    @GetMapping("/bins")
    public List<SmartBinDto> bins() {
        return bins.listAll();
    }
}
