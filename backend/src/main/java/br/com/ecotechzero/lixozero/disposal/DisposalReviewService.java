package br.com.ecotechzero.lixozero.disposal;

import br.com.ecotechzero.lixozero.audit.AuditAction;
import br.com.ecotechzero.lixozero.audit.AuditService;
import br.com.ecotechzero.lixozero.category.Category;
import br.com.ecotechzero.lixozero.category.CategoryRepository;
import br.com.ecotechzero.lixozero.common.ApiException;
import br.com.ecotechzero.lixozero.common.Numbers;
import br.com.ecotechzero.lixozero.common.PageResponse;
import br.com.ecotechzero.lixozero.common.Pagination;
import br.com.ecotechzero.lixozero.common.Text;
import br.com.ecotechzero.lixozero.disposal.DisposalDtos.ApproveRequest;
import br.com.ecotechzero.lixozero.disposal.DisposalDtos.DisposalDto;
import br.com.ecotechzero.lixozero.gamification.GamificationService;
import br.com.ecotechzero.lixozero.points.PointTransactionType;
import br.com.ecotechzero.lixozero.points.PointsService;
import br.com.ecotechzero.lixozero.security.AuthUser;
import br.com.ecotechzero.lixozero.user.User;
import br.com.ecotechzero.lixozero.user.UserRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.util.Locale;
import java.util.UUID;

/**
 * Moderação de descartes pelo administrador.
 * <p>
 * Regras garantidas: apenas descartes APROVADOS geram pontos, e cada descarte gera pontos UMA única vez.
 * Defesa em camadas: (1) lock pessimista na linha do descarte; (2) aprovar um descarte já aprovado
 * devolve o mesmo resultado sem pontuar de novo (idempotente); (3) índice único no banco impede dois
 * lançamentos EARN para o mesmo descarte, mesmo que tudo o mais falhe.
 */
@Service
public class DisposalReviewService {

    private final DisposalRepository disposals;
    private final CategoryRepository categories;
    private final UserRepository users;
    private final PointsService points;
    private final GamificationService gamification;
    private final AuditService audit;
    private final EntityManager em;
    private final Clock clock;

    public DisposalReviewService(DisposalRepository disposals, CategoryRepository categories, UserRepository users,
                                 PointsService points, GamificationService gamification, AuditService audit,
                                 EntityManager em, Clock clock) {
        this.disposals = disposals;
        this.categories = categories;
        this.users = users;
        this.points = points;
        this.gamification = gamification;
        this.audit = audit;
        this.em = em;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public PageResponse<DisposalDto> queue(DisposalStatus status, Boolean flagged, Integer page, Integer size) {
        Boolean flaggedFilter = Boolean.TRUE.equals(flagged) ? Boolean.TRUE : null;
        Sort sort = Sort.by(Sort.Direction.DESC, "createdAt");
        return PageResponse.of(disposals.adminSearch(status, flaggedFilter, Pagination.of(page, size, sort)), d -> DisposalDto.of(d, true));
    }

    @Transactional
    public DisposalDto approve(AuthUser admin, UUID id, ApproveRequest request) {
        Disposal disposal = lock(id);
        if (disposal.getStatus() == DisposalStatus.APPROVED) {
            return DisposalDto.of(disposal, true); // idempotente: não pontua de novo
        }
        if (disposal.getStatus() == DisposalStatus.REJECTED) {
            throw ApiException.conflict("Este descarte já foi recusado e não pode ser aprovado.");
        }
        if (disposal.getUser().getId().equals(admin.id())) {
            throw ApiException.business("Você não pode aprovar o seu próprio descarte.");
        }
        String correction = applyCorrection(disposal, request);
        int awarded = approveInternal(disposal, users.getReferenceById(admin.id()));
        audit.record(AuditAction.DISPOSAL_APPROVED, "Disposal", id, "+" + awarded + " pontos" + correction);
        return DisposalDto.of(disposal, true);
    }

    @Transactional
    public DisposalDto reject(AuthUser admin, UUID id, String reason) {
        Disposal disposal = lock(id);
        if (disposal.getStatus() == DisposalStatus.REJECTED) {
            return DisposalDto.of(disposal, true);
        }
        if (disposal.getStatus() == DisposalStatus.APPROVED) {
            throw ApiException.conflict("Este descarte já foi aprovado e não pode ser recusado.");
        }
        String cleanReason = Text.clean(reason);
        if (cleanReason == null || cleanReason.length() < 3) {
            throw ApiException.field("reason", "informe o motivo da recusa");
        }
        disposal.reject(Text.truncate(cleanReason, 300), users.getReferenceById(admin.id()), clock.instant());
        audit.record(AuditAction.DISPOSAL_REJECTED, "Disposal", id, cleanReason);
        return DisposalDto.of(disposal, true);
    }

    /**
     * Aprova e credita os pontos (usado pela moderação e pela aprovação automática).
     * O crédito é feito com a linha do usuário travada; o índice único garante pontuação única.
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public int approveInternal(Disposal disposal, User reviewer) {
        Instant now = clock.instant();
        Category category = disposal.getCategory();
        // bônus reavaliado AGORA, com a categoria final (o admin pode ter corrigido)
        int awarded = PointsCalculator.points(category.getPointsPerKg(), disposal.getQuantityKg(), disposal.aiBonusApplies());
        disposal.approve(awarded, reviewer, now);
        String description = String.format(Locale.forLanguageTag("pt-BR"), "Descarte aprovado: %.2f kg de %s",
                disposal.getQuantityKg(), category.getName());
        points.credit(disposal.getUser().getId(), awarded, PointTransactionType.EARN, description, disposal, null, now);
        gamification.onDisposalApproved(disposal.getUser().getId(), disposal.getDisposedAt());
        return awarded;
    }

    private String applyCorrection(Disposal disposal, ApproveRequest request) {
        if (request == null || (request.categoryId() == null && request.quantityKg() == null)) {
            return "";
        }
        Category category = request.categoryId() == null ? disposal.getCategory()
                : categories.findById(request.categoryId()).orElseThrow(() -> ApiException.field("categoryId", "categoria não encontrada"));
        double kg = request.quantityKg() == null ? disposal.getQuantityKg() : Numbers.round(request.quantityKg(), 3);
        if (kg > category.getMaxKgPerDisposal()) {
            throw ApiException.field("quantityKg", "máximo de " + category.getMaxKgPerDisposal() + " kg para " + category.getName());
        }
        String note = " (corrigido: " + disposal.getCategory().getCode() + " " + disposal.getQuantityKg() + " kg -> "
                + category.getCode() + " " + kg + " kg)";
        disposal.correct(category, kg);
        return note;
    }

    private Disposal lock(UUID id) {
        Disposal disposal = disposals.findById(id).orElseThrow(() -> ApiException.notFound("Descarte não encontrado."));
        em.refresh(disposal, LockModeType.PESSIMISTIC_WRITE);
        return disposal;
    }
}
