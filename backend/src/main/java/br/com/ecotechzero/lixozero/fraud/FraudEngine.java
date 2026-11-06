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

    private final List<FraudRule> regras;
    private final int limite;

    public FraudEngine(List<FraudRule> regras, AppProperties propriedades) {
        this.regras = List.copyOf(regras);
        this.limite = propriedades.fraudThreshold();
    }

    public record FraudAssessment(int score, List<String> flags, boolean flagged, List<FraudSignal> signals) {
    }

    public FraudAssessment avaliar(FraudContext contexto) {
        List<FraudSignal> sinais = new ArrayList<>();
        for (FraudRule regra : regras) {
            try {
                Optional<FraudSignal> sinal = regra.avaliar(contexto);
                sinal.ifPresent(sinais::add);
            } catch (RuntimeException e) {
                // uma regra com problema não pode impedir o registro do descarte
                log.warn("Regra antifraude {} falhou: {}", regra.codigo(), e.toString());
            }
        }
        int pontuacao = Math.min(100, sinais.stream().mapToInt(FraudSignal::score).sum());
        List<String> alertas = sinais.stream().map(FraudSignal::message).toList();
        return new FraudAssessment(pontuacao, alertas, pontuacao >= limite, sinais);
    }

    public int limite() {
        return limite;
    }
}
