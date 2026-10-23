package br.com.ecotechzero.lixozero.collection;

import br.com.ecotechzero.lixozero.collection.CollectionDtos.CollectionRequestDto;
import br.com.ecotechzero.lixozero.collection.CollectionDtos.CreateCollectionRequest;
import br.com.ecotechzero.lixozero.collection.CollectionDtos.SmartBinRef;
import br.com.ecotechzero.lixozero.common.ApiException;
import br.com.ecotechzero.lixozero.common.Numbers;
import br.com.ecotechzero.lixozero.common.Text;
import br.com.ecotechzero.lixozero.common.TokenBucketRateLimiter;
import br.com.ecotechzero.lixozero.config.AppProperties;
import br.com.ecotechzero.lixozero.route.RouteStopRepository;
import br.com.ecotechzero.lixozero.security.AuthUser;
import br.com.ecotechzero.lixozero.user.UserDtos.UserRef;
import br.com.ecotechzero.lixozero.user.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

/** Solicitações de coleta: criação pelo morador, acompanhamento, cancelamento e visão do administrador. */
@Service
public class CollectionRequestService {

    static final int MAX_OPEN_PER_USER = 5;

    private final CollectionRequestRepository repository;
    private final UserRepository users;
    private final RouteStopRepository stops;
    private final TokenBucketRateLimiter limiter;
    private final AppProperties props;
    private final Clock clock;

    public CollectionRequestService(CollectionRequestRepository repository, UserRepository users, RouteStopRepository stops,
                                    TokenBucketRateLimiter limiter, AppProperties props, Clock clock) {
        this.repository = repository;
        this.users = users;
        this.stops = stops;
        this.limiter = limiter;
        this.props = props;
        this.clock = clock;
    }

    @Transactional
    public CollectionRequestDto create(AuthUser me, CreateCollectionRequest input) {
        limiter.check(TokenBucketRateLimiter.Policy.COLLECTION_REQUEST_USER, me.id().toString());
        LocalDate today = LocalDate.now(clock.withZone(props.zoneId()));
        if (input.preferredDate() != null && (input.preferredDate().isBefore(today) || input.preferredDate().isAfter(today.plusDays(60)))) {
            throw ApiException.field("preferredDate", "a data preferida deve estar entre hoje e os próximos 60 dias");
        }
        String address = Text.clean(input.address());
        if (address == null || address.length() < 5) {
            throw ApiException.field("address", "informe o endereço completo");
        }
        if (repository.countByRequesterIdAndStatusIn(me.id(), CollectionRequestStatus.OPEN) >= MAX_OPEN_PER_USER) {
            throw ApiException.business("Você já tem " + MAX_OPEN_PER_USER + " solicitações em aberto. Aguarde a conclusão de alguma delas.");
        }
        CollectionRequest request = new CollectionRequest(CollectionSource.USER, address, input.latitude(), input.longitude(),
                input.categoryCodes(), Numbers.round(input.estimatedKg(), 2));
        request.setRequester(users.getReferenceById(me.id()));
        request.setPreferredDate(input.preferredDate());
        request.setNotes(Text.truncate(Text.clean(input.notes()), 500));
        repository.save(request);
        return toDto(request, false);
    }

    @Transactional(readOnly = true)
    public List<CollectionRequestDto> listMine(AuthUser me) {
        return repository.findByRequesterIdOrderByCreatedAtDesc(me.id()).stream().map(r -> toDto(r, false)).toList();
    }

    /** Cancela uma solicitação própria (ou qualquer uma, se admin) enquanto não saiu para coleta. */
    @Transactional
    public CollectionRequestDto cancel(AuthUser me, UUID id) {
        CollectionRequest request = repository.findById(id)
                .filter(r -> me.isAdmin() || (r.getRequester() != null && r.getRequester().getId().equals(me.id())))
                .orElseThrow(() -> ApiException.notFound("Solicitação não encontrada."));
        if (request.getStatus() == CollectionRequestStatus.CANCELLED) {
            return toDto(request, false);
        }
        if (request.getStatus() != CollectionRequestStatus.REQUESTED && request.getStatus() != CollectionRequestStatus.SCHEDULED) {
            throw ApiException.business("Não é possível cancelar uma coleta que já está em rota ou foi concluída.");
        }
        if (request.getRoute() != null) {
            stops.findByRequestId(request.getId()).ifPresent(stop -> stop.getRoute().removeStop(stop));
        }
        request.cancel();
        return toDto(request, false);
    }

    /** Visão do admin: ordenada por prioridade (mais urgente primeiro). */
    @Transactional(readOnly = true)
    public List<CollectionRequestDto> listAll(CollectionRequestStatus status) {
        List<CollectionRequest> requests = status == null ? repository.findAllByOrderByCreatedAtDesc()
                : repository.findByStatusOrderByCreatedAt(status);
        return requests.stream().map(r -> toDto(r, true))
                .sorted(Comparator.comparingInt(CollectionRequestDto::priority).reversed()
                        .thenComparing(CollectionRequestDto::createdAt))
                .toList();
    }

    public CollectionRequestDto toDto(CollectionRequest r, boolean adminView) {
        Integer fill = r.getSmartBin() != null ? r.getSmartBin().getFillLevel() : null;
        int priority = r.isOpen()
                ? PriorityCalculator.priority(r.getEstimatedKg(), r.getCreatedAt(), r.getCategories(), fill,
                r.getPreferredDate(), clock.instant(), LocalDate.now(clock.withZone(props.zoneId())))
                : 0;
        UserRef requester = r.getRequester() == null ? null
                : adminView ? UserRef.withEmail(r.getRequester()) : UserRef.of(r.getRequester());
        SmartBinRef bin = r.getSmartBin() == null ? null : new SmartBinRef(r.getSmartBin().getId(), r.getSmartBin().getName());
        return new CollectionRequestDto(r.getId(), r.getAddress(), r.getLatitude(), r.getLongitude(),
                r.getCategories().stream().sorted().toList(), Numbers.round2(r.getEstimatedKg()), r.getStatus(), r.getSource(),
                priority, r.getPreferredDate(), r.getScheduledFor(), r.getRoute() == null ? null : r.getRoute().getId(),
                r.getNotes(), r.getCreatedAt(), r.getUpdatedAt(), requester, bin);
    }
}
