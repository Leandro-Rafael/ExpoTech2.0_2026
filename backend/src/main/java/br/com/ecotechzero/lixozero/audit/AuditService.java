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

    private final AuditLogRepository repositorio;
    private final AuditChain cadeia;

    public AuditService(AuditLogRepository repositorio, AuditChain cadeia) {
        this.repositorio = repositorio;
        this.cadeia = cadeia;
    }

    /** Registra com o usuário autenticado atual como ator (ou "sistema"). */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void registrar(AuditAction acao, String entidade, Object idEntidade, String detalhes) {
        AuthUser ator = atorAtual();
        salvar(ator == null ? null : ator.id(), ator == null ? "sistema" : ator.name() + " <" + ator.email() + ">",
                acao, entidade, idEntidade, detalhes);
    }

    /** Registra com um ator explícito (ex.: login, quando ainda não há usuário autenticado). */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void registrarComo(UUID idAtor, String rotuloAtor, AuditAction acao, String entidade, Object idEntidade, String detalhes) {
        salvar(idAtor, rotuloAtor, acao, entidade, idEntidade, detalhes);
    }

    /** Máximo de ações por filtro (um grupo da tela de auditoria tem bem menos). */
    static final int MAX_ACTION_FILTERS = 50;
    private static final java.util.regex.Pattern CODIGO_ACAO = java.util.regex.Pattern.compile("[A-Z][A-Z0-9_]{0,59}");

    @Transactional(readOnly = true)
    public PageResponse<AuditEntryDto> pagina(Integer pagina, Integer tamanho) {
        return pagina(pagina, tamanho, null, null);
    }

    /**
     * Página da auditoria com filtros opcionais: {@code actions} (códigos de ação, ex.: DISPOSAL_APPROVED;
     * vários = OU) e {@code q} (texto em autor, detalhes, entidade ou IP; até 100 caracteres).
     */
    @Transactional(readOnly = true)
    public PageResponse<AuditEntryDto> pagina(Integer pagina, Integer tamanho, List<String> acoes, String busca) {
        List<String> codigos = acoes == null ? List.of() : acoes.stream()
                .flatMap(a -> java.util.Arrays.stream(a.split(",")))
                .map(String::trim).filter(a -> !a.isEmpty()).distinct().toList();
        if (codigos.size() > MAX_ACTION_FILTERS) {
            throw ApiException.campo("action", "no máximo " + MAX_ACTION_FILTERS + " ações por filtro");
        }
        for (String codigo : codigos) {
            if (!CODIGO_ACAO.matcher(codigo).matches()) {
                throw ApiException.campo("action", "ação inválida");
            }
        }
        String limpo = Text.limpar(busca);
        String padrao = limpo == null ? null : "%" + Text.truncar(limpo, 100).toLowerCase(java.util.Locale.ROOT)
                .replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
        var paginacao = Pagination.criar(pagina, tamanho, Sort.by(Sort.Direction.DESC, "createdAt"));
        // Lista vazia em "IN" não é SQL válido: passa um valor qualquer e liga o "anyAction".
        return PageResponse.of(repositorio.search(codigos.isEmpty(), codigos.isEmpty() ? List.of("-") : codigos, padrao, paginacao),
                AuditEntryDto::of);
    }

    @Transactional(readOnly = true)
    public List<AuditEntryDto> recentes() {
        return repositorio.findTop10ByOrderByCreatedAtDesc().stream().map(AuditEntryDto::of).toList();
    }

    private void salvar(UUID idAtor, String rotuloAtor, AuditAction acao, String entidade, Object idEntidade, String detalhes) {
        cadeia.anexar(new AuditRow(null, idAtor, Text.truncar(rotuloAtor, 160), acao.name(), entidade,
                idEntidade == null ? null : Text.truncar(idEntidade.toString(), 64), Text.truncar(detalhes, 1000),
                Text.truncar(RequestContext.ipAtual(), 64), Instant.now()));
        log.info("AUDIT {} entity={} id={} actor={}", acao, entidade, idEntidade, idAtor);
    }

    private static AuthUser atorAtual() {
        Authentication autenticacao = SecurityContextHolder.getContext().getAuthentication();
        return autenticacao != null && autenticacao.getPrincipal() instanceof AuthUser usuario ? usuario : null;
    }

    public record AuditEntryDto(UUID id, String actor, String action, String entity, String entityId,
                                String details, String ip, Instant createdAt) {
        static AuditEntryDto of(AuditLog a) {
            return new AuditEntryDto(a.getId(), a.getActorLabel(), a.getAction(), a.getEntity(), a.getEntityId(),
                    a.getDetails(), a.getIp(), a.getCreatedAt());
        }
    }
}
