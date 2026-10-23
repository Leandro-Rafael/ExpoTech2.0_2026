package br.com.ecotechzero.lixozero.ai;

import br.com.ecotechzero.lixozero.category.CategoryCode;

import java.util.Optional;

/**
 * Contrato para classificadores de resíduos por imagem (padrão Strategy).
 * <p>
 * Implementações: {@link ClaudeVisionClassifier} (IA na nuvem, quando há ANTHROPIC_API_KEY) e
 * {@link UnavailableClassifier} (sem IA no servidor: o front-end usa um modelo local no navegador).
 * O restante do sistema depende apenas desta interface, então trocar de provedor não afeta o código.
 */
public interface WasteClassifier {

    /** Resultado de uma classificação. confidence entre 0 e 1. */
    record Classification(CategoryCode categoryCode, double confidence, String reasoning, AiSource source) {
    }

    boolean isAvailable();

    /**
     * Classifica a imagem (JPEG). Nunca lança exceção: em caso de falha devolve vazio,
     * para que o envio da foto continue funcionando sem a IA.
     */
    Optional<Classification> classify(byte[] jpeg);
}
