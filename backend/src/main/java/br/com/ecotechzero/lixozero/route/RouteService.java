package br.com.ecotechzero.lixozero.route;

import br.com.ecotechzero.lixozero.audit.AuditAction;
import br.com.ecotechzero.lixozero.audit.AuditService;
import br.com.ecotechzero.lixozero.collection.CollectionRequest;
import br.com.ecotechzero.lixozero.collection.CollectionRequestRepository;
import br.com.ecotechzero.lixozero.collection.CollectionRequestStatus;
import br.com.ecotechzero.lixozero.common.ApiException;
import br.com.ecotechzero.lixozero.common.GeoPoint;
import br.com.ecotechzero.lixozero.common.Numbers;
import br.com.ecotechzero.lixozero.common.Text;
import br.com.ecotechzero.lixozero.config.AppProperties;
import br.com.ecotechzero.lixozero.household.SmartBinService;
import br.com.ecotechzero.lixozero.route.RouteDtos.CreateRouteRequest;
import br.com.ecotechzero.lixozero.route.RouteDtos.OptimizeRequest;
import br.com.ecotechzero.lixozero.route.RouteDtos.OptimizedRoute;
import br.com.ecotechzero.lixozero.route.RouteDtos.OptimizedStop;
import br.com.ecotechzero.lixozero.route.RouteDtos.RouteDto;
import br.com.ecotechzero.lixozero.route.RouteDtos.RouteOptimizationDto;
import br.com.ecotechzero.lixozero.route.RouteDtos.RouteStopDto;
import br.com.ecotechzero.lixozero.security.AuthUser;
import br.com.ecotechzero.lixozero.user.Role;
import br.com.ecotechzero.lixozero.user.User;
import br.com.ecotechzero.lixozero.user.UserDtos.UserRef;
import br.com.ecotechzero.lixozero.user.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/** Planejamento (via {@link RouteOptimizer}) e execução das rotas de coleta. */
@Service
public class RouteService {

    public static final GeoPoint DEFAULT_DEPOT = new GeoPoint(-23.6019, -46.7526); // central de coleta (Taboão da Serra)
    public static final double DEFAULT_CAPACITY_KG = 1000;
    static final String ALGORITHM = "Vizinho mais próximo + 2-opt (com capacidade)";

    private final CollectionRouteRepository routes;
    private final CollectionRequestRepository requests;
    private final UserRepository users;
    private final SmartBinService smartBins;
    private final AuditService audit;
    private final AppProperties props;
    private final Clock clock;

    public RouteService(CollectionRouteRepository routes, CollectionRequestRepository requests, UserRepository users,
                        SmartBinService smartBins, AuditService audit, AppProperties props, Clock clock) {
        this.routes = routes;
        this.requests = requests;
        this.users = users;
        this.smartBins = smartBins;
        this.audit = audit;
        this.props = props;
        this.clock = clock;
    }

    /** Simula o plano de rotas sem gravar nada (pré-visualização no painel). */
    @Transactional(readOnly = true)
    public RouteOptimizationDto optimize(OptimizeRequest input) {
        List<CollectionRequest> selected = loadSchedulable(input.requestIds(), false);
        GeoPoint depot = input.depot() != null ? input.depot() : DEFAULT_DEPOT;
        RouteOptimizer.Plan plan = plan(selected, depot, input.vehicleCapacityKg());
        Map<UUID, CollectionRequest> byId = selected.stream().collect(Collectors.toMap(CollectionRequest::getId, Function.identity()));
        List<OptimizedRoute> optimized = plan.routes().stream().map(r -> {
            List<OptimizedStop> stops = new ArrayList<>();
            for (int i = 0; i < r.stops().size(); i++) {
                CollectionRequest req = byId.get(r.stops().get(i).id());
                stops.add(new OptimizedStop(req.getId(), i + 1, req.getLatitude(), req.getLongitude(), req.getAddress(), Numbers.round2(req.getEstimatedKg())));
            }
            return new OptimizedRoute(stops, r.distanceKm(), r.naiveDistanceKm(), r.estimatedMinutes(), r.loadKg());
        }).toList();
        return new RouteOptimizationDto(ALGORITHM, optimized, plan.totalDistanceKm(), plan.naiveTotalDistanceKm(), plan.savingsPercent(), depot);
    }

    /** Cria uma rota por viagem do caminhão e agenda as solicitações escolhidas. */
    @Transactional
    public List<RouteDto> create(CreateRouteRequest input) {
        LocalDate today = LocalDate.now(clock.withZone(props.zoneId()));
        if (input.plannedDate().isBefore(today) || input.plannedDate().isAfter(today.plusDays(90))) {
            throw ApiException.field("plannedDate", "a data deve estar entre hoje e os próximos 90 dias");
        }
        User collector = null;
        if (input.collectorId() != null) {
            collector = users.findById(input.collectorId())
                    .filter(u -> u.isEnabled() && (u.getRole() == Role.COLLECTOR || u.getRole() == Role.ADMIN))
                    .orElseThrow(() -> ApiException.field("collectorId", "coletor não encontrado"));
        }
        List<CollectionRequest> selected = loadSchedulable(input.requestIds(), true);
        GeoPoint depot = input.depot() != null ? input.depot() : DEFAULT_DEPOT;
        RouteOptimizer.Plan plan = plan(selected, depot, input.vehicleCapacityKg());
        Map<UUID, CollectionRequest> byId = selected.stream().collect(Collectors.toMap(CollectionRequest::getId, Function.identity()));
        String baseName = Text.clean(input.name());

        List<CollectionRoute> created = new ArrayList<>();
        int index = 1;
        for (RouteOptimizer.PlannedRoute planned : plan.routes()) {
            String name = plan.routes().size() > 1 ? baseName + " (" + index++ + "/" + plan.routes().size() + ")" : baseName;
            CollectionRoute route = new CollectionRoute(Text.truncate(name, 120), collector, input.plannedDate(), depot.latitude(), depot.longitude());
            route.setMetrics(planned.distanceKm(), planned.naiveDistanceKm(), planned.estimatedMinutes(), planned.loadKg());
            routes.save(route);
            for (RouteOptimizer.Stop stop : planned.stops()) {
                CollectionRequest request = byId.get(stop.id());
                route.addStop(request);
                request.schedule(route, input.plannedDate());
            }
            created.add(route);
            audit.record(AuditAction.ROUTE_CREATED, "Route", route.getId(),
                    route.getStops().size() + " paradas, " + planned.distanceKm() + " km (economia de " + plan.savingsPercent() + "%)");
        }
        return created.stream().map(this::toDto).toList();
    }

    @Transactional(readOnly = true)
    public List<RouteDto> listAll() {
        return routes.findAllByOrderByPlannedDateDescCreatedAtDesc().stream().map(this::toDto).toList();
    }

    @Transactional(readOnly = true)
    public List<RouteDto> listForCollector(AuthUser me) {
        var list = me.isAdmin() ? routes.findAllByOrderByPlannedDateDescCreatedAtDesc() : routes.findForCollector(me.id());
        return list.stream().map(this::toDto).toList();
    }

    @Transactional
    public RouteDto start(AuthUser me, UUID routeId) {
        CollectionRoute route = requireForCollector(me, routeId);
        if (route.getStatus() == RouteStatus.DONE) {
            throw ApiException.conflict("Esta rota já foi concluída.");
        }
        if (route.getStatus() == RouteStatus.PLANNED) {
            route.start(users.getReferenceById(me.id()), clock.instant());
            route.getStops().forEach(s -> {
                if (s.getRequest().getStatus() == CollectionRequestStatus.SCHEDULED) {
                    s.getRequest().setStatus(CollectionRequestStatus.IN_ROUTE);
                }
            });
            audit.record(AuditAction.ROUTE_STARTED, "Route", routeId, route.getName());
        }
        return toDto(route);
    }

    @Transactional
    public RouteDto completeStop(AuthUser me, UUID routeId, UUID stopId, Double collectedKg) {
        CollectionRoute route = requireForCollector(me, routeId);
        if (route.getStatus() == RouteStatus.PLANNED) {
            throw ApiException.business("Inicie a rota antes de concluir as paradas.");
        }
        RouteStop stop = route.getStops().stream().filter(s -> s.getId().equals(stopId)).findFirst()
                .orElseThrow(() -> ApiException.notFound("Parada não encontrada nesta rota."));
        if (stop.getStatus() == StopStatus.DONE) {
            return toDto(route); // idempotente
        }
        Double kg = collectedKg == null ? null : Numbers.round2(collectedKg);
        stop.complete(kg, clock.instant());
        CollectionRequest request = stop.getRequest();
        request.markCollected(kg != null ? kg : request.getEstimatedKg());
        if (request.getSmartBin() != null) {
            smartBins.emptyAfterCollection(request.getSmartBin().getId());
        }
        if (route.allStopsDone()) {
            route.finish(clock.instant());
        }
        audit.record(AuditAction.ROUTE_STOP_COMPLETED, "RouteStop", stopId, "parada " + stop.getSequence() + " de " + route.getName());
        return toDto(route);
    }

    /** Coletor só acessa rotas atribuídas a ele (ou sem coletor); admin acessa todas. Demais: 404. */
    private CollectionRoute requireForCollector(AuthUser me, UUID routeId) {
        CollectionRoute route = routes.findByIdForUpdate(routeId).orElseThrow(() -> ApiException.notFound("Rota não encontrada."));
        boolean allowed = me.isAdmin() || route.getCollector() == null || route.getCollector().getId().equals(me.id());
        if (!allowed) {
            throw ApiException.notFound("Rota não encontrada.");
        }
        return route;
    }

    /** Carrega as solicitações; somente as que aguardam agendamento podem entrar em uma rota. */
    private List<CollectionRequest> loadSchedulable(List<UUID> ids, boolean lock) {
        var unique = new LinkedHashSet<>(ids);
        List<CollectionRequest> found = lock ? requests.findAllForUpdate(unique) : requests.findAllByIdOrdered(unique);
        if (found.size() != unique.size()) {
            var missing = new HashSet<>(unique);
            found.forEach(r -> missing.remove(r.getId()));
            throw ApiException.field("requestIds", "solicitações não encontradas: " + missing);
        }
        for (CollectionRequest r : found) {
            if (r.getStatus() != CollectionRequestStatus.REQUESTED) {
                throw ApiException.field("requestIds", "a solicitação " + r.getId() + " não está aguardando agendamento");
            }
        }
        return found; // já em ordem de criação
    }

    private static RouteOptimizer.Plan plan(List<CollectionRequest> selected, GeoPoint depot, Double capacity) {
        List<RouteOptimizer.Stop> stops = selected.stream()
                .map(r -> new RouteOptimizer.Stop(r.getId(), r.getLatitude(), r.getLongitude(), r.getEstimatedKg()))
                .toList();
        return RouteOptimizer.optimize(depot, stops, capacity != null ? capacity : DEFAULT_CAPACITY_KG);
    }

    RouteDto toDto(CollectionRoute r) {
        List<RouteStopDto> stops = r.getStops().stream().map(s -> {
            CollectionRequest req = s.getRequest();
            return new RouteStopDto(s.getId(), s.getSequence(), req.getId(), req.getAddress(), req.getLatitude(), req.getLongitude(),
                    Numbers.round2(req.getEstimatedKg()), s.getStatus(), s.getCompletedAt());
        }).toList();
        return new RouteDto(r.getId(), r.getName(), r.getStatus(), UserRef.of(r.getCollector()), r.getPlannedDate(),
                Numbers.round2(r.getTotalDistanceKm()), Numbers.round2(r.getNaiveDistanceKm()), r.getEstimatedMinutes(),
                Numbers.round2(r.getLoadKg()), new GeoPoint(r.getDepotLatitude(), r.getDepotLongitude()), stops, r.getCreatedAt());
    }
}
