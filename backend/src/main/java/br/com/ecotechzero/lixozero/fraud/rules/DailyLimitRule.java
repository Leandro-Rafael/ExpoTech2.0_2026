package br.com.ecotechzero.lixozero.fraud.rules;

import br.com.ecotechzero.lixozero.common.Numbers;
import br.com.ecotechzero.lixozero.disposal.DisposalRepository;
import br.com.ecotechzero.lixozero.disposal.DisposalStatus;
import br.com.ecotechzero.lixozero.fraud.FraudContext;
import br.com.ecotechzero.lixozero.fraud.FraudRule;
import br.com.ecotechzero.lixozero.fraud.FraudSignal;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Optional;

/** Limite diário: uma residência comum não descarta mais de 50 kg de recicláveis por dia. */
@Component
public class DailyLimitRule implements FraudRule {

    public static final double DAILY_LIMIT_KG = 50;
    static final int SCORE = 35;

    private final DisposalRepository disposals;

    public DailyLimitRule(DisposalRepository disposals) {
        this.disposals = disposals;
    }

    @Override
    public String code() {
        return "LIMITE_DIARIO";
    }

    @Override
    public Optional<FraudSignal> evaluate(FraudContext ctx) {
        LocalDate day = ctx.disposedAt().atZone(ctx.zone()).toLocalDate();
        Instant from = day.atStartOfDay(ctx.zone()).toInstant();
        Instant to = day.plusDays(1).atStartOfDay(ctx.zone()).toInstant();
        double total = disposals.sumKgBetween(ctx.userId(), DisposalStatus.REJECTED, from, to) + ctx.quantityKg();
        if (total > DAILY_LIMIT_KG) {
            return Optional.of(new FraudSignal(code(), SCORE,
                    "Total do dia (" + Numbers.round(total, 1) + " kg) acima do limite de " + (int) DAILY_LIMIT_KG + " kg por usuário."));
        }
        return Optional.empty();
    }
}
