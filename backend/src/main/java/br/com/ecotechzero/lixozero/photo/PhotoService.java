package br.com.ecotechzero.lixozero.photo;

import br.com.ecotechzero.lixozero.ai.AiSource;
import br.com.ecotechzero.lixozero.ai.WasteClassifier;
import br.com.ecotechzero.lixozero.ai.WasteClassifier.Classification;
import br.com.ecotechzero.lixozero.category.CategoryCode;
import br.com.ecotechzero.lixozero.common.ApiException;
import br.com.ecotechzero.lixozero.common.ErrorCode;
import br.com.ecotechzero.lixozero.common.TokenBucketRateLimiter;
import br.com.ecotechzero.lixozero.security.AuthUser;
import br.com.ecotechzero.lixozero.user.UserRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.Clock;
import java.time.Duration;
import java.util.Optional;
import java.util.UUID;

/**
 * Upload de fotos: valida/sanitiza a imagem, consulta a IA (fora da transação, pois é uma chamada de rede)
 * e grava a foto com o hash perceptual para a checagem antifraude.
 */
@Service
public class PhotoService {

    private static final Duration DUPLICATE_WINDOW = Duration.ofDays(180);
    private static final int MAX_HASHES_COMPARED = 5000;

    private final PhotoRepository photos;
    private final UserRepository users;
    private final ImageProcessor processor;
    private final WasteClassifier classifier;
    private final TokenBucketRateLimiter limiter;
    private final TransactionTemplate tx;
    private final Clock clock;

    public PhotoService(PhotoRepository photos, UserRepository users, ImageProcessor processor, WasteClassifier classifier,
                        TokenBucketRateLimiter limiter, TransactionTemplate tx, Clock clock) {
        this.photos = photos;
        this.users = users;
        this.processor = processor;
        this.classifier = classifier;
        this.limiter = limiter;
        this.tx = tx;
        this.clock = clock;
    }

    /** verified = classificação feita pelo servidor (fica gravada na foto e é a única que vale para o bônus). */
    public record AiSuggestion(boolean available, CategoryCode categoryCode, Double confidence, String reasoning, AiSource source,
                               boolean verified) {
    }

    public record PhotoUpload(UUID id, String url, int width, int height, boolean duplicateSuspected, AiSuggestion ai) {
    }

    public PhotoUpload upload(AuthUser me, MultipartFile file) {
        limiter.check(TokenBucketRateLimiter.Policy.PHOTO_UPLOAD_USER, me.id().toString());
        if (file == null || file.isEmpty()) {
            throw new ApiException(ErrorCode.INVALID_IMAGE, "Selecione uma imagem para enviar.");
        }
        if (file.getSize() > ImageProcessor.MAX_BYTES) {
            throw new ApiException(ErrorCode.INVALID_IMAGE, "A imagem deve ter no máximo 5 MB.");
        }
        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (IOException e) {
            throw new ApiException(ErrorCode.INVALID_IMAGE, "Não foi possível ler o arquivo enviado.");
        }
        ImageProcessor.ProcessedImage image = processor.process(bytes);
        Optional<Classification> ai = classifier.classify(image.aiJpeg());

        return tx.execute(status -> {
            Photo photo = new Photo(users.getReferenceById(me.id()), image.jpeg(), image.width(), image.height(), image.dHash(), image.sha256());
            ai.ifPresent(c -> photo.setServerAi(c.categoryCode(), c.confidence(), c.reasoning(), c.source(), c.model(), clock.instant()));
            photos.save(photo);
            boolean duplicate = isDuplicateSuspected(photo.getId(), image.sha256(), image.dHash());
            AiSuggestion suggestion = ai
                    .map(c -> new AiSuggestion(true, c.categoryCode(), c.confidence(), c.reasoning(), c.source(), photo.isAiVerified()))
                    .orElse(new AiSuggestion(false, null, null, null, null, false));
            return new PhotoUpload(photo.getId(), url(photo.getId()), image.width(), image.height(), duplicate, suggestion);
        });
    }

    /** Foto idêntica (SHA-256) ou visualmente parecida (dHash) com outra enviada nos últimos 180 dias. */
    boolean isDuplicateSuspected(UUID photoId, String sha256, long dHash) {
        if (photos.existsSameContent(sha256, photoId)) {
            return true;
        }
        return photos.recentHashes(clock.instant().minus(DUPLICATE_WINDOW), photoId, PageRequest.of(0, MAX_HASHES_COMPARED))
                .stream()
                .anyMatch(h -> PerceptualHash.hammingDistance(h.dhash(), dHash) <= PerceptualHash.SIMILARITY_THRESHOLD);
    }

    /** Bytes da foto: apenas o dono ou um administrador. Para os demais, 404 (não revela que existe). */
    @Transactional(readOnly = true)
    public Photo getForViewer(AuthUser me, UUID id) {
        return photos.findById(id)
                .filter(p -> me.isAdmin() || p.getOwner().getId().equals(me.id()))
                .orElseThrow(() -> ApiException.notFound("Foto não encontrada."));
    }

    public static String url(UUID photoId) {
        return photoId == null ? null : "/api/photos/" + photoId;
    }
}
