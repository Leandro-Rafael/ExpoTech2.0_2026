package br.com.ecotechzero.lixozero.ai;

import br.com.ecotechzero.lixozero.category.CodigoCategoria;

import java.util.Optional;

/**
 * Contrato para classificadores de resíduos por imagem (padrão Strategy).
 * <p>
 * Implementações: {@link ClassificadorVisaoClaude} (IA na nuvem, quando há ANTHROPIC_API_KEY) e
 * {@link ClassificadorIndisponivel} (sem IA no servidor: o front-end usa um modelo local no navegador).
 * O restante do sistema depende apenas desta interface, então trocar de provedor não afeta o código.
 */
public interface ClassificadorResiduos {

    /** Resultado de uma classificação. confidence entre 0 e 1; model = modelo que classificou (auditoria). */
    record Classification(CodigoCategoria categoryCode, double confidence, String reasoning, OrigemIa source, String model) {
    }

    boolean estaDisponivel();

    /**
     * Classifica a imagem (JPEG). Nunca lança exceção: em caso de falha devolve vazio,
     * para que o envio da foto continue funcionando sem a IA.
     */
    Optional<Classification> classificar(byte[] jpeg);
}
