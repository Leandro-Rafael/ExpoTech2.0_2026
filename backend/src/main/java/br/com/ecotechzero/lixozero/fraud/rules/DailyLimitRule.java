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

    private final DisposalRepository descartes;

    public DailyLimitRule(DisposalRepository descartes) {
        this.descartes = descartes;
    }

    @Override
    public String codigo() {
        return "LIMITE_DIARIO";
    }

    @Override
    public Optional<FraudSignal> avaliar(FraudContext contexto) {
        LocalDate dia = contexto.disposedAt().atZone(contexto.zone()).toLocalDate();
        Instant inicio = dia.atStartOfDay(contexto.zone()).toInstant();
        Instant fim = dia.plusDays(1).atStartOfDay(contexto.zone()).toInstant();
        double total = descartes.sumKgBetween(contexto.userId(), DisposalStatus.REJECTED, inicio, fim) + contexto.quantityKg();
        if (total > DAILY_LIMIT_KG) {
            return Optional.of(new FraudSignal(codigo(), SCORE,
                    "Total do dia (" + Numbers.arredondar(total, 1) + " kg) acima do limite de " + (int) DAILY_LIMIT_KG + " kg por usuário."));
        }
        return Optional.empty();
    }
}
