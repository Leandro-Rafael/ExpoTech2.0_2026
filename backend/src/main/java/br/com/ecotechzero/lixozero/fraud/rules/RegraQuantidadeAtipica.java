package br.com.ecotechzero.lixozero.fraud.rules;

import br.com.ecotechzero.lixozero.fraud.ContextoFraude;
import br.com.ecotechzero.lixozero.fraud.RegraFraude;
import br.com.ecotechzero.lixozero.fraud.SinalFraude;
import org.springframework.stereotype.Component;

import java.util.Optional;

/** Quantidade atípica: acima de 80% do máximo permitido para a categoria em um único descarte. */
@Component
public class RegraQuantidadeAtipica implements RegraFraude {

    static final double RATIO = 0.8;
    static final int SCORE = 20;

    @Override
    public String codigo() {
        return "QUANTIDADE_ATIPICA";
    }

    @Override
    public Optional<SinalFraude> avaliar(ContextoFraude contexto) {
        if (contexto.categoryMaxKg() > 0 && contexto.quantityKg() > contexto.categoryMaxKg() * RATIO) {
            return Optional.of(new SinalFraude(codigo(), SCORE,
                    "Quantidade próxima do máximo permitido para a categoria (" + contexto.categoryMaxKg() + " kg)."));
        }
        return Optional.empty();
    }
}
