package br.com.ecotechzero.lixozero.collection;

import br.com.ecotechzero.lixozero.collection.DtosColeta.CollectionRequestDto;
import br.com.ecotechzero.lixozero.collection.DtosColeta.CreateCollectionRequest;
import br.com.ecotechzero.lixozero.collection.DtosColeta.SmartBinRef;
import br.com.ecotechzero.lixozero.common.ExcecaoApi;
import br.com.ecotechzero.lixozero.common.Numeros;
import br.com.ecotechzero.lixozero.common.Textos;
import br.com.ecotechzero.lixozero.common.LimitadorDeTaxa;
import br.com.ecotechzero.lixozero.config.PropriedadesApp;
import br.com.ecotechzero.lixozero.route.CollectionRoute;
import br.com.ecotechzero.lixozero.route.RepositorioRotasColeta;
import br.com.ecotechzero.lixozero.route.StatusRota;
import br.com.ecotechzero.lixozero.route.RepositorioParadas;
import br.com.ecotechzero.lixozero.security.UsuarioAutenticado;
import br.com.ecotechzero.lixozero.user.DtosUsuario.UserRef;
import br.com.ecotechzero.lixozero.user.RepositorioUsuarios;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

/** Solicitações de coleta: criação pelo morador, acompanhamento, cancelamento e visão do administrador. */
@Service
public class ServicoSolicitacoesColeta {

    static final int MAXIMO_ABERTAS_POR_USUARIO = 5;

    private final RepositorioSolicitacoesColeta repositorio;
    private final RepositorioUsuarios usuarios;
    private final RepositorioParadas paradas;
    private final RepositorioRotasColeta rotas;
    private final LimitadorDeTaxa limitador;
    private final PropriedadesApp propriedades;
    private final Clock relogio;

    public ServicoSolicitacoesColeta(RepositorioSolicitacoesColeta repositorio, RepositorioUsuarios usuarios, RepositorioParadas paradas,
                                    RepositorioRotasColeta rotas, LimitadorDeTaxa limitador, PropriedadesApp propriedades, Clock relogio) {
        this.repositorio = repositorio;
        this.usuarios = usuarios;
        this.paradas = paradas;
        this.rotas = rotas;
        this.limitador = limitador;
        this.propriedades = propriedades;
        this.relogio = relogio;
    }

    @Transactional
    public CollectionRequestDto criar(UsuarioAutenticado logado, CreateCollectionRequest entrada) {
        limitador.verificar(LimitadorDeTaxa.Policy.COLLECTION_REQUEST_USER, logado.id().toString());
        LocalDate hoje = LocalDate.now(relogio.withZone(propriedades.zoneId()));
        if (entrada.preferredDate() != null && (entrada.preferredDate().isBefore(hoje) || entrada.preferredDate().isAfter(hoje.plusDays(60)))) {
            throw ExcecaoApi.campo("preferredDate", "a data preferida deve estar entre hoje e os próximos 60 dias");
        }
        String endereco = Textos.limpar(entrada.address());
        if (endereco == null || endereco.length() < 5) {
            throw ExcecaoApi.campo("address", "informe o endereço completo");
        }
        if (repositorio.countByRequesterIdAndStatusIn(logado.id(), StatusSolicitacaoColeta.OPEN) >= MAXIMO_ABERTAS_POR_USUARIO) {
            throw ExcecaoApi.regraNegocio("Você já tem " + MAXIMO_ABERTAS_POR_USUARIO + " solicitações em aberto. Aguarde a conclusão de alguma delas.");
        }
        CollectionRequest solicitacao = new CollectionRequest(OrigemColeta.USER, endereco, entrada.latitude(), entrada.longitude(),
                entrada.categoryCodes(), Numeros.arredondar(entrada.estimatedKg(), 2));
        solicitacao.setRequester(usuarios.getReferenceById(logado.id()));
        solicitacao.setPreferredDate(entrada.preferredDate());
        solicitacao.setNotes(Textos.truncar(Textos.limpar(entrada.notes()), 500));
        repositorio.save(solicitacao);
        return paraDto(solicitacao, false);
    }

    @Transactional(readOnly = true)
    public List<CollectionRequestDto> listarMinhas(UsuarioAutenticado logado) {
        return repositorio.findByRequesterIdOrderByCreatedAtDesc(logado.id()).stream().map(r -> paraDto(r, false)).toList();
    }

    /** Cancela uma solicitação própria (ou qualquer uma, se admin) enquanto não saiu para coleta. */
    @Transactional
    public CollectionRequestDto cancelar(UsuarioAutenticado logado, UUID id) {
        CollectionRequest solicitacao = repositorio.findById(id)
                .filter(r -> logado.isAdmin() || (r.getRequester() != null && r.getRequester().getId().equals(logado.id())))
                .orElseThrow(() -> ExcecaoApi.naoEncontrado("Solicitação não encontrada."));
        if (solicitacao.getStatus() == StatusSolicitacaoColeta.CANCELLED) {
            return paraDto(solicitacao, false);
        }
        if (solicitacao.getStatus() != StatusSolicitacaoColeta.REQUESTED && solicitacao.getStatus() != StatusSolicitacaoColeta.SCHEDULED) {
            throw ExcecaoApi.regraNegocio("Não é possível cancelar uma coleta que já está em rota ou foi concluída.");
        }
        if (solicitacao.getRoute() != null) {
            // trava a rota: cancelamentos simultâneos não sobrescrevem as métricas recalculadas um do outro
            CollectionRoute rota = rotas.findByIdForUpdate(solicitacao.getRoute().getId())
                    .orElseThrow(() -> ExcecaoApi.naoEncontrado("Rota não encontrada."));
            if (rota.getStatus() != StatusRota.PLANNED) {
                throw ExcecaoApi.regraNegocio("Não é possível cancelar uma coleta que já está em rota ou foi concluída.");
            }
            paradas.findByRequestId(solicitacao.getId()).ifPresent(rota::removeStop);
        }
        solicitacao.cancel();
        return paraDto(solicitacao, false);
    }

    /** Visão do admin: ordenada por prioridade (mais urgente primeiro). */
    @Transactional(readOnly = true)
    public List<CollectionRequestDto> listarTodas(StatusSolicitacaoColeta situacao) {
        List<CollectionRequest> solicitacoes = situacao == null ? repositorio.findAllByOrderByCreatedAtDesc()
                : repositorio.findByStatusOrderByCreatedAt(situacao);
        return solicitacoes.stream().map(r -> paraDto(r, true))
                .sorted(Comparator.comparingInt(CollectionRequestDto::priority).reversed()
                        .thenComparing(CollectionRequestDto::createdAt))
                .toList();
    }

    public CollectionRequestDto paraDto(CollectionRequest r, boolean visaoAdmin) {
        Integer nivelEnchimento = r.getSmartBin() != null ? r.getSmartBin().getFillLevel() : null;
        int prioridade = r.isOpen()
                ? CalculadoraPrioridade.calcular(r.getEstimatedKg(), r.getCreatedAt(), r.getCategories(), nivelEnchimento,
                r.getPreferredDate(), relogio.instant(), LocalDate.now(relogio.withZone(propriedades.zoneId())))
                : 0;
        UserRef solicitante = r.getRequester() == null ? null
                : visaoAdmin ? UserRef.withEmail(r.getRequester()) : UserRef.of(r.getRequester());
        SmartBinRef lixeira = r.getSmartBin() == null ? null : new SmartBinRef(r.getSmartBin().getId(), r.getSmartBin().getName());
        return new CollectionRequestDto(r.getId(), r.getAddress(), r.getLatitude(), r.getLongitude(),
                r.getCategories().stream().sorted().toList(), Numeros.arredondar2(r.getEstimatedKg()), r.getStatus(), r.getSource(),
                prioridade, r.getPreferredDate(), r.getScheduledFor(), r.getRoute() == null ? null : r.getRoute().getId(),
                r.getNotes(), r.getCreatedAt(), r.getUpdatedAt(), solicitante, lixeira);
    }
}
