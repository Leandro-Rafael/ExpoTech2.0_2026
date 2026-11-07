package br.com.ecotechzero.lixozero.fraud.rules;

import br.com.ecotechzero.lixozero.fraud.ContextoFraude;
import br.com.ecotechzero.lixozero.fraud.RegraFraude;
import br.com.ecotechzero.lixozero.fraud.SinalFraude;
import org.springframework.stereotype.Component;

import java.util.Optional;

/** Descartes volumosos (acima de 5 kg) sem foto como comprovação recebem um pequeno acréscimo de risco. */
@Component
public class RegraFotoAusente implements RegraFraude {

    static final double MIN_KG = 5;
    static final int SCORE = 15;

    @Override
    public String codigo() {
        return "SEM_FOTO";
    }

    @Override
    public Optional<SinalFraude> avaliar(ContextoFraude contexto) {
        if (contexto.photo() == null && contexto.quantityKg() > MIN_KG) {
            return Optional.of(new SinalFraude(codigo(), SCORE, "Descarte acima de 5 kg sem foto de comprovação."));
        }
        return Optional.empty();
    }
}
