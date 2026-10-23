package br.com.ecotechzero.lixozero.fraud;

import br.com.ecotechzero.lixozero.config.AppProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/**
 * Motor antifraude: executa todas as {@link FraudRule} e consolida o resultado.
 * Pontuação final = soma dos sinais (limitada a 100). A partir do limite configurado
 * (APP_FRAUD_THRESHOLD, padrão 50) o descarte é sinalizado e NUNCA é aprovado automaticamente.
 */
@Service
public class FraudEngine {

    private static final Logger log = LoggerFactory.getLogger(FraudEngine.class);

    private final List<FraudRule> rules;
    private final int threshold;

    public FraudEngine(List<FraudRule> rules, AppProperties props) {
        this.rules = List.copyOf(rules);
        this.threshold = props.fraudThreshold();
    }

    public record FraudAssessment(int score, List<String> flags, boolean flagged, List<FraudSignal> signals) {
    }

    public FraudAssessment assess(FraudContext context) {
        List<FraudSignal> signals = new ArrayList<>();
        for (FraudRule rule : rules) {
            try {
                Optional<FraudSignal> signal = rule.evaluate(context);
                signal.ifPresent(signals::add);
            } catch (RuntimeException e) {
                // uma regra com problema não pode impedir o registro do descarte
                log.warn("Regra antifraude {} falhou: {}", rule.code(), e.toString());
            }
        }
        int score = Math.min(100, signals.stream().mapToInt(FraudSignal::score).sum());
        List<String> flags = signals.stream().map(FraudSignal::message).toList();
        return new FraudAssessment(score, flags, score >= threshold, signals);
    }

    public int threshold() {
        return threshold;
    }
}
