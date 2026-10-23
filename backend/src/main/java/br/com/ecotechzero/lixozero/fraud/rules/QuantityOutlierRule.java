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
    public String code() {
        return "QUANTIDADE_ATIPICA";
    }

    @Override
    public Optional<FraudSignal> evaluate(FraudContext ctx) {
        if (ctx.categoryMaxKg() > 0 && ctx.quantityKg() > ctx.categoryMaxKg() * RATIO) {
            return Optional.of(new FraudSignal(code(), SCORE,
                    "Quantidade próxima do máximo permitido para a categoria (" + ctx.categoryMaxKg() + " kg)."));
        }
        return Optional.empty();
    }
}
