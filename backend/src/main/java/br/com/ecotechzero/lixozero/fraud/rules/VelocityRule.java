package br.com.ecotechzero.lixozero.fraud.rules;

import br.com.ecotechzero.lixozero.disposal.DisposalRepository;
import br.com.ecotechzero.lixozero.fraud.FraudContext;
import br.com.ecotechzero.lixozero.fraud.FraudRule;
import br.com.ecotechzero.lixozero.fraud.FraudSignal;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.Optional;

/** Rajada de registros: 4 ou mais descartes nos últimos 10 minutos indicam automação ou abuso. */
@Component
public class VelocityRule implements FraudRule {

    static final int MAX_IN_WINDOW = 4;
    static final Duration WINDOW = Duration.ofMinutes(10);
    static final int SCORE = 30;

    private final DisposalRepository descartes;

    public VelocityRule(DisposalRepository descartes) {
        this.descartes = descartes;
    }

    @Override
    public String codigo() {
        return "MUITOS_REGISTROS";
    }

    @Override
    public Optional<FraudSignal> avaliar(FraudContext contexto) {
        long recentes = descartes.countByUserIdAndCreatedAtAfter(contexto.userId(), contexto.now().minus(WINDOW));
        if (recentes >= MAX_IN_WINDOW) {
            return Optional.of(new FraudSignal(codigo(), SCORE,
                    "Muitos registros em pouco tempo (" + (recentes + 1) + " em " + WINDOW.toMinutes() + " minutos)."));
        }
        return Optional.empty();
    }
}
