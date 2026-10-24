package br.com.ecotechzero.lixozero.disposal;

import br.com.ecotechzero.lixozero.ai.AiSource;
import br.com.ecotechzero.lixozero.audit.AuditAction;
import br.com.ecotechzero.lixozero.audit.AuditService;
import br.com.ecotechzero.lixozero.category.Category;
import br.com.ecotechzero.lixozero.category.CategoryCode;
import br.com.ecotechzero.lixozero.category.CategoryService;
import br.com.ecotechzero.lixozero.collection.CollectionPoint;
import br.com.ecotechzero.lixozero.collection.CollectionPointService;
import br.com.ecotechzero.lixozero.common.ApiException;
import br.com.ecotechzero.lixozero.common.Numbers;
import br.com.ecotechzero.lixozero.common.PageResponse;
import br.com.ecotechzero.lixozero.common.Pagination;
import br.com.ecotechzero.lixozero.common.Text;
import br.com.ecotechzero.lixozero.common.TokenBucketRateLimiter;
import br.com.ecotechzero.lixozero.config.AppProperties;
import br.com.ecotechzero.lixozero.disposal.DisposalDtos.CreateDisposalRequest;
import br.com.ecotechzero.lixozero.disposal.DisposalDtos.DisposalDto;
import br.com.ecotechzero.lixozero.fraud.FraudContext;
import br.com.ecotechzero.lixozero.fraud.FraudEngine;
import br.com.ecotechzero.lixozero.photo.PhotoMeta;
import br.com.ecotechzero.lixozero.photo.PhotoRepository;
import br.com.ecotechzero.lixozero.security.AuthUser;
import br.com.ecotechzero.lixozero.user.UserRepository;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Registro de descartes pelo morador: validação completa, avaliação antifraude e idempotência.
 * O descarte nasce PENDENTE; pontos só são concedidos na aprovação ({@link DisposalReviewService}).
 */
@Service
public class DisposalService {

    private static final Pattern IDEMPOTENCY_KEY = Pattern.compile("^[A-Za-z0-9_-]{8,64}$");
    private static final Duration MAX_AGE = Duration.ofDays(7);
    private static final Duration CLOCK_SKEW = Duration.ofMinutes(5);
    /** Limites da aprovação automática (quando APP_AUTO_APPROVE=true). */
    private static final int AUTO_APPROVE_MAX_SCORE = 20;
    private static final double AUTO_APPROVE_MAX_KG = 5;

    private final DisposalRepository disposals;
    private final CategoryService categories;
    private final CollectionPointService collectionPoints;
    private final PhotoRepository photos;
    private final UserRepository users;
    private final FraudEngine fraudEngine;
    private final DisposalReviewService review;
    private final AuditService audit;
    private final TokenBucketRateLimiter limiter;
    private final AppProperties props;
    private final Clock clock;

    public DisposalService(DisposalRepository disposals, CategoryService categories, CollectionPointService collectionPoints,
                           PhotoRepository photos, UserRepository users, FraudEngine fraudEngine, DisposalReviewService review,
                           AuditService audit, TokenBucketRateLimiter limiter, AppProperties props, Clock clock) {
        this.disposals = disposals;
        this.categories = categories;
        this.collectionPoints = collectionPoints;
        this.photos = photos;
        this.users = users;
        this.fraudEngine = fraudEngine;
        this.review = review;
        this.audit = audit;
        this.limiter = limiter;
        this.props = props;
        this.clock = clock;
    }

    /** Valida o formato do header Idempotency-Key (opcional). */
    public static String validateIdempotencyKey(String key) {
        if (key == null || key.isBlank()) {
            return null;
        }
        if (!IDEMPOTENCY_KEY.matcher(key.strip()).matches()) {
            throw ApiException.field("Idempotency-Key", "use de 8 a 64 caracteres (letras, números, - ou _)");
        }
        return key.strip();
    }

    /** Mesmo usuário + mesma chave = devolve o descarte original (clique duplo, nova tentativa de rede). */
    @Transactional(readOnly = true)
    public Optional<DisposalDto> findByIdempotencyKey(UUID userId, String key) {
        if (key == null) {
            return Optional.empty();
        }
        return disposals.findByUserIdAndIdempotencyKey(userId, key).map(d -> DisposalDto.of(d, false));
    }

    @Transactional
    public DisposalDto create(AuthUser me, CreateDisposalRequest in, String idempotencyKey) {
        Optional<DisposalDto> existing = findByIdempotencyKey(me.id(), idempotencyKey);
        if (existing.isPresent()) {
            return existing.get();
        }
        limiter.check(TokenBucketRateLimiter.Policy.DISPOSAL_USER, me.id().toString());
        Instant now = clock.instant();

        Category category = categories.requireActive(in.categoryId(), "categoryId");
        double kg = Numbers.round(in.quantityKg(), 3);
        if (kg < 0.01) {
            throw ApiException.field("quantityKg", "a quantidade mínima é 0,01 kg");
        }
        if (kg > category.getMaxKgPerDisposal()) {
            throw ApiException.field("quantityKg", "máximo de " + category.getMaxKgPerDisposal() + " kg por descarte de " + category.getName());
        }
        if ((in.latitude() == null) != (in.longitude() == null)) {
            throw ApiException.field("latitude", "informe latitude e longitude juntas");
        }
        Instant disposedAt = in.disposedAt() == null ? now : in.disposedAt();
        if (disposedAt.isAfter(now.plus(CLOCK_SKEW))) {
            throw ApiException.field("disposedAt", "a data do descarte não pode ser no futuro");
        }
        if (disposedAt.isBefore(now.minus(MAX_AGE))) {
            throw ApiException.field("disposedAt", "só é possível registrar descartes dos últimos 7 dias");
        }

        PhotoMeta photo = null;
        if (in.photoId() != null) {
            photo = photos.findMeta(in.photoId())
                    .filter(p -> p.ownerId().equals(me.id()))
                    .orElseThrow(() -> ApiException.field("photoId", "foto não encontrada"));
            if (disposals.existsByPhotoId(photo.id())) {
                throw ApiException.field("photoId", "esta foto já foi usada em outro descarte");
            }
        }
        CollectionPoint point = null;
        if (in.collectionPointId() != null) {
            point = collectionPoints.requireActive(in.collectionPointId(), "collectionPointId");
            if (!point.accepts(category.getCode())) {
                throw ApiException.field("collectionPointId", "este ecoponto não recebe " + category.getName().toLowerCase());
            }
        }

        // Sugestão da IA: a do servidor (Claude) é confiável e prevalece; a do cliente nunca pode se passar por CLAUDE
        CategoryCode aiCode = in.aiSuggestedCode();
        Double aiConfidence = in.aiConfidence() == null ? null : Math.clamp(in.aiConfidence(), 0.0, 1.0);
        AiSource aiSource = in.aiSource();
        if (photo != null && photo.aiSource() == AiSource.CLAUDE && photo.aiCode() != null) {
            aiCode = photo.aiCode();
            aiConfidence = photo.aiConfidence();
            aiSource = AiSource.CLAUDE;
        } else if (aiSource == AiSource.CLAUDE) {
            aiSource = AiSource.LOCAL;
        }
        if (aiCode != null && aiSource == null) {
            aiSource = AiSource.LOCAL;
        }

        var fraud = fraudEngine.assess(new FraudContext(me.id(), category.getCode(), category.getMaxKgPerDisposal(), kg, photo,
                in.latitude(), in.longitude(), disposedAt, aiCode, aiConfidence, aiSource, now, props.zoneId()));

        Disposal disposal = new Disposal(users.getReferenceById(me.id()), category, kg, disposedAt);
        disposal.setLocation(in.latitude(), in.longitude());
        disposal.setCollectionPoint(point);
        if (photo != null) {
            disposal.setPhoto(photos.getReferenceById(photo.id()));
        }
        disposal.setAi(aiCode, aiConfidence, aiSource);
        disposal.setNotes(Text.truncate(Text.clean(in.notes()), 500));
        disposal.setIdempotencyKey(idempotencyKey);
        disposal.setFraud(fraud.score(), fraud.flags(), fraud.flagged());
        boolean aiConfirmed = photo != null && aiCode == category.getCode() && aiConfidence != null
                && aiConfidence >= PointsCalculator.AI_MIN_CONFIDENCE;
        disposal.setEstimatedPoints(PointsCalculator.points(category.getPointsPerKg(), kg, aiConfirmed));
        disposals.saveAndFlush(disposal);

        if (fraud.flagged()) {
            audit.record(AuditAction.DISPOSAL_FLAGGED, "Disposal", disposal.getId(), "risco " + fraud.score() + ": " + String.join("; ", fraud.flags()));
        } else if (props.autoApprove() && fraud.score() < AUTO_APPROVE_MAX_SCORE && kg <= AUTO_APPROVE_MAX_KG && photo != null) {
            int awarded = review.approveInternal(disposal, null);
            audit.record(AuditAction.DISPOSAL_AUTO_APPROVED, "Disposal", disposal.getId(), "+" + awarded + " pontos (baixo risco)");
        }
        return DisposalDto.of(disposal, false);
    }

    @Transactional(readOnly = true)
    public PageResponse<DisposalDto> listMine(UUID userId, DisposalStatus status, Integer page, Integer size) {
        var pageable = Pagination.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        var result = status == null ? disposals.findByUserId(userId, pageable) : disposals.findByUserIdAndStatus(userId, status, pageable);
        return PageResponse.of(result, d -> DisposalDto.of(d, false));
    }

    /** Detalhe: o dono vê o próprio descarte; o admin vê qualquer um (com dados antifraude). Outros: 404. */
    @Transactional(readOnly = true)
    public DisposalDto get(AuthUser me, UUID id) {
        Disposal d = disposals.findById(id)
                .filter(x -> me.isAdmin() || x.getUser().getId().equals(me.id()))
                .orElseThrow(() -> ApiException.notFound("Descarte não encontrado."));
        return DisposalDto.of(d, me.isAdmin());
    }
}
