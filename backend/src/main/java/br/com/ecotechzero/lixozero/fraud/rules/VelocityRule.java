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

    private final DisposalRepository disposals;

    public VelocityRule(DisposalRepository disposals) {
        this.disposals = disposals;
    }

    @Override
    public String code() {
        return "MUITOS_REGISTROS";
    }

    @Override
    public Optional<FraudSignal> evaluate(FraudContext ctx) {
        long recent = disposals.countByUserIdAndCreatedAtAfter(ctx.userId(), ctx.now().minus(WINDOW));
        if (recent >= MAX_IN_WINDOW) {
            return Optional.of(new FraudSignal(code(), SCORE,
                    "Muitos registros em pouco tempo (" + (recent + 1) + " em " + WINDOW.toMinutes() + " minutos)."));
        }
        return Optional.empty();
    }
}
