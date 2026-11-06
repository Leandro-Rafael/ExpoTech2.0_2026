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

    private final PhotoRepository fotos;

    public PhotoReuseRule(PhotoRepository fotos) {
        this.fotos = fotos;
    }

    @Override
    public String codigo() {
        return "FOTO_REPETIDA";
    }

    @Override
    public Optional<FraudSignal> avaliar(FraudContext contexto) {
        if (contexto.photo() == null) {
            return Optional.empty();
        }
        if (fotos.existsSameContent(contexto.photo().sha256(), contexto.photo().id())) {
            return Optional.of(new FraudSignal(codigo(), SCORE, "A mesma foto já foi enviada anteriormente."));
        }
        return Optional.empty();
    }
}
