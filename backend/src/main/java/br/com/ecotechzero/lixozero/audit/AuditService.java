package br.com.ecotechzero.lixozero.audit;

import br.com.ecotechzero.lixozero.common.PageResponse;
import br.com.ecotechzero.lixozero.common.Pagination;
import br.com.ecotechzero.lixozero.common.RequestContext;
import br.com.ecotechzero.lixozero.common.Text;
import br.com.ecotechzero.lixozero.security.AuthUser;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Sort;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Registra ações sensíveis. Usa REQUIRES_NEW: o registro é gravado numa transação própria e
 * permanece mesmo que a operação principal falhe (ex.: tentativa de login com senha errada).
 */
@Service
public class AuditService {

    private static final Logger log = LoggerFactory.getLogger(AuditService.class);

    private final AuditLogRepository repository;

    public AuditService(AuditLogRepository repository) {
        this.repository = repository;
    }

    /** Registra com o usuário autenticado atual como ator (ou "sistema"). */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void record(AuditAction action, String entity, Object entityId, String details) {
        AuthUser actor = currentActor();
        save(actor == null ? null : actor.id(), actor == null ? "sistema" : actor.name() + " <" + actor.email() + ">",
                action, entity, entityId, details);
    }

    /** Registra com um ator explícito (ex.: login, quando ainda não há usuário autenticado). */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordAs(UUID actorId, String actorLabel, AuditAction action, String entity, Object entityId, String details) {
        save(actorId, actorLabel, action, entity, entityId, details);
    }

    @Transactional(readOnly = true)
    public PageResponse<AuditEntryDto> page(Integer page, Integer size) {
        return PageResponse.of(repository.findAll(Pagination.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"))), AuditEntryDto::of);
    }

    @Transactional(readOnly = true)
    public List<AuditEntryDto> recent() {
        return repository.findTop10ByOrderByCreatedAtDesc().stream().map(AuditEntryDto::of).toList();
    }

    private void save(UUID actorId, String actorLabel, AuditAction action, String entity, Object entityId, String details) {
        AuditLog entry = new AuditLog(actorId, Text.truncate(actorLabel, 160), action.name(), entity,
                entityId == null ? null : Text.truncate(entityId.toString(), 64), Text.truncate(details, 1000),
                Text.truncate(RequestContext.currentIp(), 64));
        entry.setCreatedAt(Instant.now());
        repository.save(entry);
        log.info("AUDIT {} entity={} id={} actor={}", action, entity, entityId, actorId);
    }

    private static AuthUser currentActor() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null && auth.getPrincipal() instanceof AuthUser user ? user : null;
    }

    public record AuditEntryDto(UUID id, String actor, String action, String entity, String entityId,
                                String details, String ip, Instant createdAt) {
        static AuditEntryDto of(AuditLog a) {
            return new AuditEntryDto(a.getId(), a.getActorLabel(), a.getAction(), a.getEntity(), a.getEntityId(),
                    a.getDetails(), a.getIp(), a.getCreatedAt());
        }
    }
}
