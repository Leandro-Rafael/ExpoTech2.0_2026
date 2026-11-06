package br.com.ecotechzero.lixozero.fraud.rules;

import br.com.ecotechzero.lixozero.fraud.FraudContext;
import br.com.ecotechzero.lixozero.fraud.FraudRule;
import br.com.ecotechzero.lixozero.fraud.FraudSignal;
import org.springframework.stereotype.Component;

import java.util.Optional;

/** Quantidade atípica: acima de 80% do máximo permitido para a categoria em um único descarte. */
@Component
public class QuantityOutlierRule implements FraudRule {

    static final double RATIO = 0.8;
    static final int SCORE = 20;

    @Override
    public String codigo() {
        return "QUANTIDADE_ATIPICA";
    }

    @Override
    public Optional<FraudSignal> avaliar(FraudContext contexto) {
        if (contexto.categoryMaxKg() > 0 && contexto.quantityKg() > contexto.categoryMaxKg() * RATIO) {
            return Optional.of(new FraudSignal(codigo(), SCORE,
                    "Quantidade próxima do máximo permitido para a categoria (" + contexto.categoryMaxKg() + " kg)."));
        }
        return Optional.empty();
    }
}
