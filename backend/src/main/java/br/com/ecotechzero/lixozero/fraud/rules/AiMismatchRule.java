package br.com.ecotechzero.lixozero.fraud.rules;

import br.com.ecotechzero.lixozero.ai.AiSource;
import br.com.ecotechzero.lixozero.category.CategoryCode;
import br.com.ecotechzero.lixozero.fraud.FraudContext;
import br.com.ecotechzero.lixozero.fraud.FraudRule;
import br.com.ecotechzero.lixozero.fraud.FraudSignal;
import org.springframework.stereotype.Component;

import java.util.Optional;

/**
 * Divergência com a IA: o usuário escolheu uma categoria diferente da sugerida pela IA com alta confiança
 * (ex.: foto de rejeito declarada como eletrônico, que vale mais pontos).
 * <ul>
 *   <li>A classificação do SERVIDOR (gravada na foto no upload) é a referência: divergência pesa mais.</li>
 *   <li>O palpite do navegador pode ser forjado, então ele só AUMENTA o risco, nunca o reduz: um palpite
 *       "concordando" não anula a divergência do servidor. Quando o servidor confirmou a categoria, o palpite
 *       local (modelo mais fraco) é ignorado para não gerar falso positivo.</li>
 * </ul>
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
        CategoryCode server = ctx.serverAiCode();
        if (server != null && ctx.serverAiConfidence() != null) {
            if (server != ctx.categoryCode() && ctx.serverAiConfidence() >= MIN_CONFIDENCE) {
                return Optional.of(signal(SCORE_SERVER_AI, ctx.categoryCode(), server, ctx.serverAiConfidence(), "IA do servidor"));
            }
            if (server == ctx.categoryCode()) {
                return Optional.empty(); // confirmado pelo servidor
            }
        }
        CategoryCode client = ctx.clientAiCode();
        if (client != null && ctx.clientAiConfidence() != null && ctx.clientAiSource() != AiSource.MANUAL
                && client != ctx.categoryCode() && ctx.clientAiConfidence() >= MIN_CONFIDENCE) {
            return Optional.of(signal(SCORE_LOCAL_AI, ctx.categoryCode(), client, ctx.clientAiConfidence(), "IA do navegador"));
        }
        return Optional.empty();
    }

    private FraudSignal signal(int score, CategoryCode declared, CategoryCode suggested, double confidence, String who) {
        return new FraudSignal(code(), score, String.format(
                "Categoria informada (%s) difere da sugerida pela %s (%s, %.0f%% de confiança).",
                declared, who, suggested, confidence * 100));
    }
}
