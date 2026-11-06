package br.com.ecotechzero.lixozero.fraud.rules;

import br.com.ecotechzero.lixozero.fraud.FraudContext;
import br.com.ecotechzero.lixozero.fraud.FraudRule;
import br.com.ecotechzero.lixozero.fraud.FraudSignal;
import br.com.ecotechzero.lixozero.photo.PerceptualHash;
import br.com.ecotechzero.lixozero.photo.PhotoHash;
import br.com.ecotechzero.lixozero.photo.PhotoRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.Optional;

/**
 * Foto muito parecida (hash perceptual dHash com distância de Hamming &lt;= 6) com outra enviada nos
 * últimos 180 dias. Pega fotos recortadas, recomprimidas ou tiradas da tela de outra foto.
 * Pontuação maior quando a foto parecida é de OUTRO usuário.
 */
@Component
public class SimilarPhotoRule implements FraudRule {

    static final int SCORE_SAME_USER = 30;
    static final int SCORE_OTHER_USER = 40;
    private static final Duration JANELA = Duration.ofDays(180);

    private final PhotoRepository fotos;

    public SimilarPhotoRule(PhotoRepository fotos) {
        this.fotos = fotos;
    }

    @Override
    public String codigo() {
        return "FOTO_SEMELHANTE";
    }

    @Override
    public Optional<FraudSignal> avaliar(FraudContext contexto) {
        if (contexto.photo() == null) {
            return Optional.empty();
        }
        long hash = contexto.photo().dhash();
        Optional<PhotoHash> parecida = fotos.recentHashes(contexto.now().minus(JANELA), contexto.photo().id(), PageRequest.of(0, 5000))
                .stream()
                .filter(h -> PerceptualHash.distanciaHamming(h.dhash(), hash) <= PerceptualHash.SIMILARITY_THRESHOLD)
                .min((a, b) -> Integer.compare(PerceptualHash.distanciaHamming(a.dhash(), hash), PerceptualHash.distanciaHamming(b.dhash(), hash)));
        return parecida.map(h -> h.ownerId().equals(contexto.userId())
                ? new FraudSignal(codigo(), SCORE_SAME_USER, "Foto muito parecida com outra que você já enviou.")
                : new FraudSignal(codigo(), SCORE_OTHER_USER, "Foto muito parecida com uma enviada por outro usuário."));
    }
}
