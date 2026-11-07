package br.com.ecotechzero.lixozero.fraud.rules;

import br.com.ecotechzero.lixozero.fraud.ContextoFraude;
import br.com.ecotechzero.lixozero.fraud.RegraFraude;
import br.com.ecotechzero.lixozero.fraud.SinalFraude;
import br.com.ecotechzero.lixozero.photo.RepositorioFotos;
import org.springframework.stereotype.Component;

import java.util.Optional;

/**
 * Foto reutilizada: o MESMO arquivo (hash SHA-256 idêntico) já foi enviado antes, por qualquer usuário.
 * Sinal forte de tentativa de ganhar pontos várias vezes com a mesma prova.
 */
@Component
public class RegraFotoReutilizada implements RegraFraude {

    static final int SCORE = 60;

    private final RepositorioFotos fotos;

    public RegraFotoReutilizada(RepositorioFotos fotos) {
        this.fotos = fotos;
    }

    @Override
    public String codigo() {
        return "FOTO_REPETIDA";
    }

    @Override
    public Optional<SinalFraude> avaliar(ContextoFraude contexto) {
        if (contexto.photo() == null) {
            return Optional.empty();
        }
        if (fotos.existsSameContent(contexto.photo().sha256(), contexto.photo().id())) {
            return Optional.of(new SinalFraude(codigo(), SCORE, "A mesma foto já foi enviada anteriormente."));
        }
        return Optional.empty();
    }
}
