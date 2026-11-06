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

    public static final GeoPoint GARAGEM_PADRAO = new GeoPoint(-23.6019, -46.7526); // central de coleta (Taboão da Serra)
    public static final double CAPACIDADE_PADRAO_KG = 1000;
    static final String ALGORITMO = "Vizinho mais próximo + 2-opt (com capacidade)";

    private final CollectionRouteRepository rotas;
    private final CollectionRequestRepository solicitacoes;
    private final UserRepository usuarios;
    private final SmartBinService lixeiras;
    private final AuditService auditoria;
    private final AppProperties propriedades;
    private final Clock relogio;

    public RouteService(CollectionRouteRepository rotas, CollectionRequestRepository solicitacoes, UserRepository usuarios,
                        SmartBinService lixeiras, AuditService auditoria, AppProperties propriedades, Clock relogio) {
        this.rotas = rotas;
        this.solicitacoes = solicitacoes;
        this.usuarios = usuarios;
        this.lixeiras = lixeiras;
        this.auditoria = auditoria;
        this.propriedades = propriedades;
        this.relogio = relogio;
    }

    /** Simula o plano de rotas sem gravar nada (pré-visualização no painel). */
    @Transactional(readOnly = true)
    public RouteOptimizationDto otimizar(OptimizeRequest entrada) {
        List<CollectionRequest> selecionadas = carregarAgendaveis(entrada.requestIds(), false);
        GeoPoint garagem = entrada.depot() != null ? entrada.depot() : GARAGEM_PADRAO;
        RouteOptimizer.Plan plano = plano(selecionadas, garagem, entrada.vehicleCapacityKg());
        Map<UUID, CollectionRequest> porId = selecionadas.stream().collect(Collectors.toMap(CollectionRequest::getId, Function.identity()));
        List<OptimizedRoute> rotasOtimizadas = plano.routes().stream().map(r -> {
            List<OptimizedStop> paradas = new ArrayList<>();
            for (int i = 0; i < r.stops().size(); i++) {
                CollectionRequest solicitacao = porId.get(r.stops().get(i).id());
                paradas.add(new OptimizedStop(solicitacao.getId(), i + 1, solicitacao.getLatitude(), solicitacao.getLongitude(), solicitacao.getAddress(), Numbers.arredondar2(solicitacao.getEstimatedKg())));
            }
            return new OptimizedRoute(paradas, r.distanceKm(), r.naiveDistanceKm(), r.estimatedMinutes(), r.loadKg());
        }).toList();
        return new RouteOptimizationDto(ALGORITMO, rotasOtimizadas, plano.totalDistanceKm(), plano.naiveTotalDistanceKm(), plano.savingsPercent(), garagem);
    }

    /** Cria uma rota por viagem do caminhão e agenda as solicitações escolhidas. */
    @Transactional
    public List<RouteDto> criar(CreateRouteRequest entrada) {
        LocalDate hoje = LocalDate.now(relogio.withZone(propriedades.zoneId()));
        if (entrada.plannedDate().isBefore(hoje) || entrada.plannedDate().isAfter(hoje.plusDays(90))) {
            throw ApiException.campo("plannedDate", "a data deve estar entre hoje e os próximos 90 dias");
        }
        User coletor = null;
        if (entrada.collectorId() != null) {
            coletor = usuarios.findById(entrada.collectorId())
                    .filter(u -> u.isEnabled() && (u.getRole() == Role.COLLECTOR || u.getRole() == Role.ADMIN))
                    .orElseThrow(() -> ApiException.campo("collectorId", "coletor não encontrado"));
        }
        List<CollectionRequest> selecionadas = carregarAgendaveis(entrada.requestIds(), true);
        GeoPoint garagem = entrada.depot() != null ? entrada.depot() : GARAGEM_PADRAO;
        RouteOptimizer.Plan plano = plano(selecionadas, garagem, entrada.vehicleCapacityKg());
        Map<UUID, CollectionRequest> porId = selecionadas.stream().collect(Collectors.toMap(CollectionRequest::getId, Function.identity()));
        String nomeBase = Text.limpar(entrada.name());

        List<CollectionRoute> criadas = new ArrayList<>();
        int indice = 1;
        for (RouteOptimizer.PlannedRoute planejada : plano.routes()) {
            String nome = plano.routes().size() > 1 ? nomeBase + " (" + indice++ + "/" + plano.routes().size() + ")" : nomeBase;
            CollectionRoute rota = new CollectionRoute(Text.truncar(nome, 120), coletor, entrada.plannedDate(), garagem.latitude(), garagem.longitude());
            rota.setMetrics(planejada.distanceKm(), planejada.naiveDistanceKm(), planejada.estimatedMinutes(), planejada.loadKg());
            rotas.save(rota);
            for (RouteOptimizer.Stop parada : planejada.stops()) {
                CollectionRequest solicitacao = porId.get(parada.id());
                rota.addStop(solicitacao);
                solicitacao.schedule(rota, entrada.plannedDate());
            }
            criadas.add(rota);
            auditoria.registrar(AuditAction.ROUTE_CREATED, "Route", rota.getId(),
                    rota.getStops().size() + " paradas, " + planejada.distanceKm() + " km (economia de " + plano.savingsPercent() + "%)");
        }
        return criadas.stream().map(this::paraDto).toList();
    }

    @Transactional(readOnly = true)
    public List<RouteDto> listarTodas() {
        return rotas.findAllByOrderByPlannedDateDescCreatedAtDesc().stream().map(this::paraDto).toList();
    }

    @Transactional(readOnly = true)
    public List<RouteDto> listarDoColetor(AuthUser logado) {
        var lista = logado.isAdmin() ? rotas.findAllByOrderByPlannedDateDescCreatedAtDesc() : rotas.findForCollector(logado.id());
        return lista.stream().map(this::paraDto).toList();
    }

    @Transactional
    public RouteDto iniciar(AuthUser logado, UUID rotaId) {
        CollectionRoute rota = exigirDoColetor(logado, rotaId);
        if (rota.getStatus() == RouteStatus.DONE) {
            throw ApiException.conflito("Esta rota já foi concluída.");
        }
        if (rota.getStatus() == RouteStatus.PLANNED && rota.getStops().isEmpty()) {
            // todas as solicitações foram canceladas: a rota nunca terminaria
            throw ApiException.regraNegocio("Esta rota não tem mais paradas (as solicitações foram canceladas).");
        }
        if (rota.getStatus() == RouteStatus.PLANNED) {
            rota.start(usuarios.getReferenceById(logado.id()), relogio.instant());
            rota.getStops().forEach(s -> {
                if (s.getRequest().getStatus() == CollectionRequestStatus.SCHEDULED) {
                    s.getRequest().setStatus(CollectionRequestStatus.IN_ROUTE);
                }
            });
            auditoria.registrar(AuditAction.ROUTE_STARTED, "Route", rotaId, rota.getName());
        }
        return paraDto(rota);
    }

    @Transactional
    public RouteDto concluirParada(AuthUser logado, UUID rotaId, UUID paradaId, Double kgColetado) {
        CollectionRoute rota = exigirDoColetor(logado, rotaId);
        if (rota.getStatus() == RouteStatus.PLANNED) {
            throw ApiException.regraNegocio("Inicie a rota antes de concluir as paradas.");
        }
        RouteStop parada = rota.getStops().stream().filter(s -> s.getId().equals(paradaId)).findFirst()
                .orElseThrow(() -> ApiException.naoEncontrado("Parada não encontrada nesta rota."));
        if (parada.getStatus() == StopStatus.DONE) {
            return paraDto(rota); // idempotente
        }
        Double kg = kgColetado == null ? null : Numbers.arredondar2(kgColetado);
        parada.complete(kg, relogio.instant());
        CollectionRequest solicitacao = parada.getRequest();
        solicitacao.markCollected(kg != null ? kg : solicitacao.getEstimatedKg());
        if (solicitacao.getSmartBin() != null) {
            lixeiras.esvaziarAposColeta(solicitacao.getSmartBin().getId());
        }
        if (rota.allStopsDone()) {
            rota.finish(relogio.instant());
        }
        auditoria.registrar(AuditAction.ROUTE_STOP_COMPLETED, "RouteStop", paradaId, "parada " + parada.getSequence() + " de " + rota.getName());
        return paraDto(rota);
    }

    /** Coletor só acessa rotas atribuídas a ele (ou sem coletor); admin acessa todas. Demais: 404. */
    private CollectionRoute exigirDoColetor(AuthUser logado, UUID rotaId) {
        CollectionRoute rota = rotas.findByIdForUpdate(rotaId).orElseThrow(() -> ApiException.naoEncontrado("Rota não encontrada."));
        boolean permitido = logado.isAdmin() || rota.getCollector() == null || rota.getCollector().getId().equals(logado.id());
        if (!permitido) {
            throw ApiException.naoEncontrado("Rota não encontrada.");
        }
        return rota;
    }

    /** Carrega as solicitações; somente as que aguardam agendamento podem entrar em uma rota. */
    private List<CollectionRequest> carregarAgendaveis(List<UUID> ids, boolean comTrava) {
        var unicas = new LinkedHashSet<>(ids);
        List<CollectionRequest> encontradas = comTrava ? solicitacoes.findAllForUpdate(unicas) : solicitacoes.findAllByIdOrdered(unicas);
        if (encontradas.size() != unicas.size()) {
            var faltantes = new HashSet<>(unicas);
            encontradas.forEach(r -> faltantes.remove(r.getId()));
            throw ApiException.campo("requestIds", "solicitações não encontradas: " + faltantes);
        }
        for (CollectionRequest r : encontradas) {
            if (r.getStatus() != CollectionRequestStatus.REQUESTED) {
                throw ApiException.campo("requestIds", "a solicitação " + r.getId() + " não está aguardando agendamento");
            }
        }
        return encontradas; // já em ordem de criação
    }

    private static RouteOptimizer.Plan plano(List<CollectionRequest> selecionadas, GeoPoint garagem, Double capacidade) {
        List<RouteOptimizer.Stop> paradas = selecionadas.stream()
                .map(r -> new RouteOptimizer.Stop(r.getId(), r.getLatitude(), r.getLongitude(), r.getEstimatedKg()))
                .toList();
        return RouteOptimizer.otimizar(garagem, paradas, capacidade != null ? capacidade : CAPACIDADE_PADRAO_KG);
    }

    RouteDto paraDto(CollectionRoute r) {
        List<RouteStopDto> paradas = r.getStops().stream().map(s -> {
            CollectionRequest solicitacao = s.getRequest();
            return new RouteStopDto(s.getId(), s.getSequence(), solicitacao.getId(), solicitacao.getAddress(), solicitacao.getLatitude(), solicitacao.getLongitude(),
                    Numbers.arredondar2(solicitacao.getEstimatedKg()), s.getStatus(), s.getCompletedAt());
        }).toList();
        return new RouteDto(r.getId(), r.getName(), r.getStatus(), UserRef.of(r.getCollector()), r.getPlannedDate(),
                Numbers.arredondar2(r.getTotalDistanceKm()), Numbers.arredondar2(r.getNaiveDistanceKm()), r.getEstimatedMinutes(),
                Numbers.arredondar2(r.getLoadKg()), new GeoPoint(r.getDepotLatitude(), r.getDepotLongitude()), paradas, r.getCreatedAt());
    }
}
