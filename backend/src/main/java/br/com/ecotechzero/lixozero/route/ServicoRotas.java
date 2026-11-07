package br.com.ecotechzero.lixozero.route;

import br.com.ecotechzero.lixozero.audit.AcaoAuditoria;
import br.com.ecotechzero.lixozero.audit.ServicoAuditoria;
import br.com.ecotechzero.lixozero.collection.CollectionRequest;
import br.com.ecotechzero.lixozero.collection.RepositorioSolicitacoesColeta;
import br.com.ecotechzero.lixozero.collection.StatusSolicitacaoColeta;
import br.com.ecotechzero.lixozero.common.ExcecaoApi;
import br.com.ecotechzero.lixozero.common.PontoGeografico;
import br.com.ecotechzero.lixozero.common.Numeros;
import br.com.ecotechzero.lixozero.common.Textos;
import br.com.ecotechzero.lixozero.config.PropriedadesApp;
import br.com.ecotechzero.lixozero.household.ServicoLixeiras;
import br.com.ecotechzero.lixozero.route.DtosRota.CreateRouteRequest;
import br.com.ecotechzero.lixozero.route.DtosRota.OptimizeRequest;
import br.com.ecotechzero.lixozero.route.DtosRota.OptimizedRoute;
import br.com.ecotechzero.lixozero.route.DtosRota.OptimizedStop;
import br.com.ecotechzero.lixozero.route.DtosRota.RouteDto;
import br.com.ecotechzero.lixozero.route.DtosRota.RouteOptimizationDto;
import br.com.ecotechzero.lixozero.route.DtosRota.RouteStopDto;
import br.com.ecotechzero.lixozero.security.UsuarioAutenticado;
import br.com.ecotechzero.lixozero.user.PerfilUsuario;
import br.com.ecotechzero.lixozero.user.User;
import br.com.ecotechzero.lixozero.user.DtosUsuario.UserRef;
import br.com.ecotechzero.lixozero.user.RepositorioUsuarios;
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

/** Planejamento (via {@link OtimizadorRotas}) e execução das rotas de coleta. */
@Service
public class ServicoRotas {

    public static final PontoGeografico GARAGEM_PADRAO = new PontoGeografico(-23.6019, -46.7526); // central de coleta (Taboão da Serra)
    public static final double CAPACIDADE_PADRAO_KG = 1000;
    static final String ALGORITMO = "Vizinho mais próximo + 2-opt (com capacidade)";

    private final RepositorioRotasColeta rotas;
    private final RepositorioSolicitacoesColeta solicitacoes;
    private final RepositorioUsuarios usuarios;
    private final ServicoLixeiras lixeiras;
    private final ServicoAuditoria auditoria;
    private final PropriedadesApp propriedades;
    private final Clock relogio;

    public ServicoRotas(RepositorioRotasColeta rotas, RepositorioSolicitacoesColeta solicitacoes, RepositorioUsuarios usuarios,
                        ServicoLixeiras lixeiras, ServicoAuditoria auditoria, PropriedadesApp propriedades, Clock relogio) {
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
        PontoGeografico garagem = entrada.depot() != null ? entrada.depot() : GARAGEM_PADRAO;
        OtimizadorRotas.Plan plano = plano(selecionadas, garagem, entrada.vehicleCapacityKg());
        Map<UUID, CollectionRequest> porId = selecionadas.stream().collect(Collectors.toMap(CollectionRequest::getId, Function.identity()));
        List<OptimizedRoute> rotasOtimizadas = plano.routes().stream().map(r -> {
            List<OptimizedStop> paradas = new ArrayList<>();
            for (int i = 0; i < r.stops().size(); i++) {
                CollectionRequest solicitacao = porId.get(r.stops().get(i).id());
                paradas.add(new OptimizedStop(solicitacao.getId(), i + 1, solicitacao.getLatitude(), solicitacao.getLongitude(), solicitacao.getAddress(), Numeros.arredondar2(solicitacao.getEstimatedKg())));
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
            throw ExcecaoApi.campo("plannedDate", "a data deve estar entre hoje e os próximos 90 dias");
        }
        User coletor = null;
        if (entrada.collectorId() != null) {
            coletor = usuarios.findById(entrada.collectorId())
                    .filter(u -> u.isEnabled() && (u.getRole() == PerfilUsuario.COLLECTOR || u.getRole() == PerfilUsuario.ADMIN))
                    .orElseThrow(() -> ExcecaoApi.campo("collectorId", "coletor não encontrado"));
        }
        List<CollectionRequest> selecionadas = carregarAgendaveis(entrada.requestIds(), true);
        PontoGeografico garagem = entrada.depot() != null ? entrada.depot() : GARAGEM_PADRAO;
        OtimizadorRotas.Plan plano = plano(selecionadas, garagem, entrada.vehicleCapacityKg());
        Map<UUID, CollectionRequest> porId = selecionadas.stream().collect(Collectors.toMap(CollectionRequest::getId, Function.identity()));
        String nomeBase = Textos.limpar(entrada.name());

        List<CollectionRoute> criadas = new ArrayList<>();
        int indice = 1;
        for (OtimizadorRotas.PlannedRoute planejada : plano.routes()) {
            String nome = plano.routes().size() > 1 ? nomeBase + " (" + indice++ + "/" + plano.routes().size() + ")" : nomeBase;
            CollectionRoute rota = new CollectionRoute(Textos.truncar(nome, 120), coletor, entrada.plannedDate(), garagem.latitude(), garagem.longitude());
            rota.setMetrics(planejada.distanceKm(), planejada.naiveDistanceKm(), planejada.estimatedMinutes(), planejada.loadKg());
            rotas.save(rota);
            for (OtimizadorRotas.Stop parada : planejada.stops()) {
                CollectionRequest solicitacao = porId.get(parada.id());
                rota.addStop(solicitacao);
                solicitacao.schedule(rota, entrada.plannedDate());
            }
            criadas.add(rota);
            auditoria.registrar(AcaoAuditoria.ROUTE_CREATED, "Route", rota.getId(),
                    rota.getStops().size() + " paradas, " + planejada.distanceKm() + " km (economia de " + plano.savingsPercent() + "%)");
        }
        return criadas.stream().map(this::paraDto).toList();
    }

    @Transactional(readOnly = true)
    public List<RouteDto> listarTodas() {
        return rotas.findAllByOrderByPlannedDateDescCreatedAtDesc().stream().map(this::paraDto).toList();
    }

    @Transactional(readOnly = true)
    public List<RouteDto> listarDoColetor(UsuarioAutenticado logado) {
        var lista = logado.isAdmin() ? rotas.findAllByOrderByPlannedDateDescCreatedAtDesc() : rotas.findForCollector(logado.id());
        return lista.stream().map(this::paraDto).toList();
    }

    @Transactional
    public RouteDto iniciar(UsuarioAutenticado logado, UUID rotaId) {
        CollectionRoute rota = exigirDoColetor(logado, rotaId);
        if (rota.getStatus() == StatusRota.DONE) {
            throw ExcecaoApi.conflito("Esta rota já foi concluída.");
        }
        if (rota.getStatus() == StatusRota.PLANNED && rota.getStops().isEmpty()) {
            // todas as solicitações foram canceladas: a rota nunca terminaria
            throw ExcecaoApi.regraNegocio("Esta rota não tem mais paradas (as solicitações foram canceladas).");
        }
        if (rota.getStatus() == StatusRota.PLANNED) {
            rota.start(usuarios.getReferenceById(logado.id()), relogio.instant());
            rota.getStops().forEach(s -> {
                if (s.getRequest().getStatus() == StatusSolicitacaoColeta.SCHEDULED) {
                    s.getRequest().setStatus(StatusSolicitacaoColeta.IN_ROUTE);
                }
            });
            auditoria.registrar(AcaoAuditoria.ROUTE_STARTED, "Route", rotaId, rota.getName());
        }
        return paraDto(rota);
    }

    @Transactional
    public RouteDto concluirParada(UsuarioAutenticado logado, UUID rotaId, UUID paradaId, Double kgColetado) {
        CollectionRoute rota = exigirDoColetor(logado, rotaId);
        if (rota.getStatus() == StatusRota.PLANNED) {
            throw ExcecaoApi.regraNegocio("Inicie a rota antes de concluir as paradas.");
        }
        RouteStop parada = rota.getStops().stream().filter(s -> s.getId().equals(paradaId)).findFirst()
                .orElseThrow(() -> ExcecaoApi.naoEncontrado("Parada não encontrada nesta rota."));
        if (parada.getStatus() == StatusParada.DONE) {
            return paraDto(rota); // idempotente
        }
        Double kg = kgColetado == null ? null : Numeros.arredondar2(kgColetado);
        parada.complete(kg, relogio.instant());
        CollectionRequest solicitacao = parada.getRequest();
        solicitacao.markCollected(kg != null ? kg : solicitacao.getEstimatedKg());
        if (solicitacao.getSmartBin() != null) {
            lixeiras.esvaziarAposColeta(solicitacao.getSmartBin().getId());
        }
        if (rota.allStopsDone()) {
            rota.finish(relogio.instant());
        }
        auditoria.registrar(AcaoAuditoria.ROUTE_STOP_COMPLETED, "RouteStop", paradaId, "parada " + parada.getSequence() + " de " + rota.getName());
        return paraDto(rota);
    }

    /** Coletor só acessa rotas atribuídas a ele (ou sem coletor); admin acessa todas. Demais: 404. */
    private CollectionRoute exigirDoColetor(UsuarioAutenticado logado, UUID rotaId) {
        CollectionRoute rota = rotas.findByIdForUpdate(rotaId).orElseThrow(() -> ExcecaoApi.naoEncontrado("Rota não encontrada."));
        boolean permitido = logado.isAdmin() || rota.getCollector() == null || rota.getCollector().getId().equals(logado.id());
        if (!permitido) {
            throw ExcecaoApi.naoEncontrado("Rota não encontrada.");
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
            throw ExcecaoApi.campo("requestIds", "solicitações não encontradas: " + faltantes);
        }
        for (CollectionRequest r : encontradas) {
            if (r.getStatus() != StatusSolicitacaoColeta.REQUESTED) {
                throw ExcecaoApi.campo("requestIds", "a solicitação " + r.getId() + " não está aguardando agendamento");
            }
        }
        return encontradas; // já em ordem de criação
    }

    private static OtimizadorRotas.Plan plano(List<CollectionRequest> selecionadas, PontoGeografico garagem, Double capacidade) {
        List<OtimizadorRotas.Stop> paradas = selecionadas.stream()
                .map(r -> new OtimizadorRotas.Stop(r.getId(), r.getLatitude(), r.getLongitude(), r.getEstimatedKg()))
                .toList();
        return OtimizadorRotas.otimizar(garagem, paradas, capacidade != null ? capacidade : CAPACIDADE_PADRAO_KG);
    }

    RouteDto paraDto(CollectionRoute r) {
        List<RouteStopDto> paradas = r.getStops().stream().map(s -> {
            CollectionRequest solicitacao = s.getRequest();
            return new RouteStopDto(s.getId(), s.getSequence(), solicitacao.getId(), solicitacao.getAddress(), solicitacao.getLatitude(), solicitacao.getLongitude(),
                    Numeros.arredondar2(solicitacao.getEstimatedKg()), s.getStatus(), s.getCompletedAt());
        }).toList();
        return new RouteDto(r.getId(), r.getName(), r.getStatus(), UserRef.of(r.getCollector()), r.getPlannedDate(),
                Numeros.arredondar2(r.getTotalDistanceKm()), Numeros.arredondar2(r.getNaiveDistanceKm()), r.getEstimatedMinutes(),
                Numeros.arredondar2(r.getLoadKg()), new PontoGeografico(r.getDepotLatitude(), r.getDepotLongitude()), paradas, r.getCreatedAt());
    }
}
