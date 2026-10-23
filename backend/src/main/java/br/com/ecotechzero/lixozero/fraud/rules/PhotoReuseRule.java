package br.com.ecotechzero.lixozero.fraud.rules;

import br.com.ecotechzero.lixozero.fraud.FraudContext;
import br.com.ecotechzero.lixozero.fraud.FraudRule;
import br.com.ecotechzero.lixozero.fraud.FraudSignal;
import br.com.ecotechzero.lixozero.photo.PhotoRepository;
import org.springframework.stereotype.Component;

import java.util.Optional;

/**
 * Foto reutilizada: o MESMO arquivo (hash SHA-256 idêntico) já foi enviado antes, por qualquer usuário.
 * Sinal forte de tentativa de ganhar pontos várias vezes com a mesma prova.
 */
@Component
public class PhotoReuseRule implements FraudRule {

    static final int SCORE = 60;

    private final PhotoRepository photos;

    public PhotoReuseRule(PhotoRepository photos) {
        this.photos = photos;
    }

    @Override
    public String code() {
        return "FOTO_REPETIDA";
    }

    @Override
    public Optional<FraudSignal> evaluate(FraudContext ctx) {
        if (ctx.photo() == null) {
            return Optional.empty();
        }
        if (photos.existsSameContent(ctx.photo().sha256(), ctx.photo().id())) {
            return Optional.of(new FraudSignal(code(), SCORE, "A mesma foto já foi enviada anteriormente."));
        }
        return Optional.empty();
    }
}
