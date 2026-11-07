package br.com.ecotechzero.lixozero.fraud.rules;

import br.com.ecotechzero.lixozero.ai.OrigemIa;
import br.com.ecotechzero.lixozero.category.CodigoCategoria;
import br.com.ecotechzero.lixozero.fraud.ContextoFraude;
import br.com.ecotechzero.lixozero.fraud.RegraFraude;
import br.com.ecotechzero.lixozero.fraud.SinalFraude;
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
public class RegraDivergenciaIa implements RegraFraude {

    static final double MIN_CONFIDENCE = 0.7;
    static final int SCORE_SERVER_AI = 30;
    static final int SCORE_LOCAL_AI = 15;

    @Override
    public String codigo() {
        return "CATEGORIA_DIVERGENTE_IA";
    }

    @Override
    public Optional<SinalFraude> avaliar(ContextoFraude contexto) {
        CodigoCategoria servidor = contexto.serverAiCode();
        if (servidor != null && contexto.serverAiConfidence() != null) {
            if (servidor != contexto.categoryCode() && contexto.serverAiConfidence() >= MIN_CONFIDENCE) {
                return Optional.of(sinal(SCORE_SERVER_AI, contexto.categoryCode(), servidor, contexto.serverAiConfidence(), "IA do servidor"));
            }
            if (servidor == contexto.categoryCode()) {
                return Optional.empty(); // confirmado pelo servidor
            }
        }
        CodigoCategoria navegador = contexto.clientAiCode();
        if (navegador != null && contexto.clientAiConfidence() != null && contexto.clientAiSource() != OrigemIa.MANUAL
                && navegador != contexto.categoryCode() && contexto.clientAiConfidence() >= MIN_CONFIDENCE) {
            return Optional.of(sinal(SCORE_LOCAL_AI, contexto.categoryCode(), navegador, contexto.clientAiConfidence(), "IA do navegador"));
        }
        return Optional.empty();
    }

    private SinalFraude sinal(int pontuacao, CodigoCategoria declarada, CodigoCategoria sugerida, double confianca, String quem) {
        return new SinalFraude(codigo(), pontuacao, String.format(
                "Categoria informada (%s) difere da sugerida pela %s (%s, %.0f%% de confiança).",
                declarada, quem, sugerida, confianca * 100));
    }
}
