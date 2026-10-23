package br.com.ecotechzero.lixozero.fraud.rules;

import br.com.ecotechzero.lixozero.fraud.FraudContext;
import br.com.ecotechzero.lixozero.fraud.FraudRule;
import br.com.ecotechzero.lixozero.fraud.FraudSignal;
import org.springframework.stereotype.Component;

import java.util.Optional;

/** Descartes volumosos (acima de 5 kg) sem foto como comprovação recebem um pequeno acréscimo de risco. */
@Component
public class MissingPhotoRule implements FraudRule {

    static final double MIN_KG = 5;
    static final int SCORE = 15;

    @Override
    public String code() {
        return "SEM_FOTO";
    }

    @Override
    public Optional<FraudSignal> evaluate(FraudContext ctx) {
        if (ctx.photo() == null && ctx.quantityKg() > MIN_KG) {
            return Optional.of(new FraudSignal(code(), SCORE, "Descarte acima de 5 kg sem foto de comprovação."));
        }
        return Optional.empty();
    }
}
