package br.com.ecotechzero.lixozero.fraud.rules;

import br.com.ecotechzero.lixozero.ai.AiSource;
import br.com.ecotechzero.lixozero.fraud.FraudContext;
import br.com.ecotechzero.lixozero.fraud.FraudRule;
import br.com.ecotechzero.lixozero.fraud.FraudSignal;
import org.springframework.stereotype.Component;

import java.util.Optional;

/**
 * Divergência com a IA: o usuário escolheu uma categoria diferente da sugerida pela IA com alta confiança
 * (ex.: foto de rejeito declarada como eletrônico, que vale mais pontos). A sugestão do servidor
 * (Claude) pesa mais que a do modelo local do navegador, que pode ser manipulada pelo cliente.
 */
@Component
public class AiMismatchRule implements FraudRule {

    static final double MIN_CONFIDENCE = 0.7;
    static final int SCORE_SERVER_AI = 30;
    static final int SCORE_LOCAL_AI = 15;

    @Override
    public String code() {
        return "CATEGORIA_DIVERGENTE_IA";
    }

    @Override
    public Optional<FraudSignal> evaluate(FraudContext ctx) {
        if (ctx.aiSuggestedCode() == null || ctx.aiConfidence() == null || ctx.aiSource() == AiSource.MANUAL) {
            return Optional.empty();
        }
        if (ctx.aiSuggestedCode() != ctx.categoryCode() && ctx.aiConfidence() >= MIN_CONFIDENCE) {
            int score = ctx.aiSource() == AiSource.CLAUDE ? SCORE_SERVER_AI : SCORE_LOCAL_AI;
            return Optional.of(new FraudSignal(code(), score, String.format(
                    "Categoria informada (%s) difere da sugerida pela IA (%s, %.0f%% de confiança).",
                    ctx.categoryCode(), ctx.aiSuggestedCode(), ctx.aiConfidence() * 100)));
        }
        return Optional.empty();
    }
}
