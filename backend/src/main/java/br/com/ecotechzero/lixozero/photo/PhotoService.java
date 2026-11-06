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

    private static final Duration JANELA_DUPLICATA = Duration.ofDays(180);
    private static final int MAX_HASHES_COMPARADOS = 5000;

    private final PhotoRepository fotos;
    private final UserRepository usuarios;
    private final ImageProcessor processador;
    private final WasteClassifier classificador;
    private final TokenBucketRateLimiter limitador;
    private final TransactionTemplate tx;
    private final Clock relogio;

    public PhotoService(PhotoRepository fotos, UserRepository usuarios, ImageProcessor processador, WasteClassifier classificador,
                        TokenBucketRateLimiter limitador, TransactionTemplate tx, Clock relogio) {
        this.fotos = fotos;
        this.usuarios = usuarios;
        this.processador = processador;
        this.classificador = classificador;
        this.limitador = limitador;
        this.tx = tx;
        this.relogio = relogio;
    }

    /** verified = classificação feita pelo servidor (fica gravada na foto e é a única que vale para o bônus). */
    public record AiSuggestion(boolean available, CategoryCode categoryCode, Double confidence, String reasoning, AiSource source,
                               boolean verified) {
    }

    public record PhotoUpload(UUID id, String url, int width, int height, boolean duplicateSuspected, AiSuggestion ai) {
    }

    public PhotoUpload enviar(AuthUser logado, MultipartFile arquivo) {
        limitador.verificar(TokenBucketRateLimiter.Policy.PHOTO_UPLOAD_USER, logado.id().toString());
        if (arquivo == null || arquivo.isEmpty()) {
            throw new ApiException(ErrorCode.INVALID_IMAGE, "Selecione uma imagem para enviar.");
        }
        if (arquivo.getSize() > ImageProcessor.MAX_BYTES) {
            throw new ApiException(ErrorCode.INVALID_IMAGE, "A imagem deve ter no máximo 5 MB.");
        }
        byte[] bytes;
        try {
            bytes = arquivo.getBytes();
        } catch (IOException e) {
            throw new ApiException(ErrorCode.INVALID_IMAGE, "Não foi possível ler o arquivo enviado.");
        }
        ImageProcessor.ProcessedImage imagem = processador.processar(bytes);
        Optional<Classification> classificacao = classificador.classificar(imagem.aiJpeg());

        return tx.execute(status -> {
            Photo foto = new Photo(usuarios.getReferenceById(logado.id()), imagem.jpeg(), imagem.width(), imagem.height(), imagem.dHash(), imagem.sha256());
            classificacao.ifPresent(c -> foto.setServerAi(c.categoryCode(), c.confidence(), c.reasoning(), c.source(), c.model(), relogio.instant()));
            fotos.save(foto);
            boolean duplicada = suspeitaDeDuplicata(foto.getId(), imagem.sha256(), imagem.dHash());
            AiSuggestion sugestao = classificacao
                    .map(c -> new AiSuggestion(true, c.categoryCode(), c.confidence(), c.reasoning(), c.source(), foto.isAiVerified()))
                    .orElse(new AiSuggestion(false, null, null, null, null, false));
            return new PhotoUpload(foto.getId(), url(foto.getId()), imagem.width(), imagem.height(), duplicada, sugestao);
        });
    }

    /** Foto idêntica (SHA-256) ou visualmente parecida (dHash) com outra enviada nos últimos 180 dias. */
    boolean suspeitaDeDuplicata(UUID idFoto, String sha256, long dHash) {
        if (fotos.existsSameContent(sha256, idFoto)) {
            return true;
        }
        return fotos.recentHashes(relogio.instant().minus(JANELA_DUPLICATA), idFoto, PageRequest.of(0, MAX_HASHES_COMPARADOS))
                .stream()
                .anyMatch(h -> PerceptualHash.distanciaHamming(h.dhash(), dHash) <= PerceptualHash.SIMILARITY_THRESHOLD);
    }

    /** Bytes da foto: apenas o dono ou um administrador. Para os demais, 404 (não revela que existe). */
    @Transactional(readOnly = true)
    public Photo buscarParaVisualizar(AuthUser logado, UUID id) {
        return fotos.findById(id)
                .filter(p -> logado.isAdmin() || p.getOwner().getId().equals(logado.id()))
                .orElseThrow(() -> ApiException.naoEncontrado("Foto não encontrada."));
    }

    public static String url(UUID idFoto) {
        return idFoto == null ? null : "/api/photos/" + idFoto;
    }
}
