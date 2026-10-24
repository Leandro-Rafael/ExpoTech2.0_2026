package br.com.ecotechzero.lixozero.audit;

import br.com.ecotechzero.lixozero.common.ApiException;
import br.com.ecotechzero.lixozero.common.PageResponse;
import br.com.ecotechzero.lixozero.common.Pagination;
import br.com.ecotechzero.lixozero.common.RequestContext;
import br.com.ecotechzero.lixozero.common.Text;
import br.com.ecotechzero.lixozero.integrity.AuditChain;
import br.com.ecotechzero.lixozero.integrity.ChainHashes.AuditRow;
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
 * Cada registro entra no fim da cadeia de hashes global ({@link AuditChain}); a tabela é append-only.
 */
@Service
public class AuditService {

    private static final Logger log = LoggerFactory.getLogger(AuditService.class);

    private final AuditLogRepository repository;
    private final AuditChain chain;

    public AuditService(AuditLogRepository repository, AuditChain chain) {
        this.repository = repository;
        this.chain = chain;
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

    /** Máximo de ações por filtro (um grupo da tela de auditoria tem bem menos). */
    static final int MAX_ACTION_FILTERS = 50;
    private static final java.util.regex.Pattern ACTION_CODE = java.util.regex.Pattern.compile("[A-Z][A-Z0-9_]{0,59}");

    @Transactional(readOnly = true)
    public PageResponse<AuditEntryDto> page(Integer page, Integer size) {
        return page(page, size, null, null);
    }

    /**
     * Página da auditoria com filtros opcionais: {@code actions} (códigos de ação, ex.: DISPOSAL_APPROVED;
     * vários = OU) e {@code q} (texto em autor, detalhes, entidade ou IP; até 100 caracteres).
     */
    @Transactional(readOnly = true)
    public PageResponse<AuditEntryDto> page(Integer page, Integer size, List<String> actions, String q) {
        List<String> codes = actions == null ? List.of() : actions.stream()
                .flatMap(a -> java.util.Arrays.stream(a.split(",")))
                .map(String::trim).filter(a -> !a.isEmpty()).distinct().toList();
        if (codes.size() > MAX_ACTION_FILTERS) {
            throw ApiException.field("action", "no máximo " + MAX_ACTION_FILTERS + " ações por filtro");
        }
        for (String code : codes) {
            if (!ACTION_CODE.matcher(code).matches()) {
                throw ApiException.field("action", "ação inválida");
            }
        }
        String cleaned = Text.clean(q);
        String pattern = cleaned == null ? null : "%" + Text.truncate(cleaned, 100).toLowerCase(java.util.Locale.ROOT)
                .replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
        var pageable = Pagination.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        // Lista vazia em "IN" não é SQL válido: passa um valor qualquer e liga o "anyAction".
        return PageResponse.of(repository.search(codes.isEmpty(), codes.isEmpty() ? List.of("-") : codes, pattern, pageable),
                AuditEntryDto::of);
    }

    @Transactional(readOnly = true)
    public List<AuditEntryDto> recent() {
        return repository.findTop10ByOrderByCreatedAtDesc().stream().map(AuditEntryDto::of).toList();
    }

    private void save(UUID actorId, String actorLabel, AuditAction action, String entity, Object entityId, String details) {
        chain.append(new AuditRow(null, actorId, Text.truncate(actorLabel, 160), action.name(), entity,
                entityId == null ? null : Text.truncate(entityId.toString(), 64), Text.truncate(details, 1000),
                Text.truncate(RequestContext.currentIp(), 64), Instant.now()));
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
