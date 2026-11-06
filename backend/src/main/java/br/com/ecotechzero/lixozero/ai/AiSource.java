package br.com.ecotechzero.lixozero.ai;

/** Origem de uma sugestão de categoria: IA do servidor (Claude), modelo local no navegador ou escolha manual. */
public enum AiSource {
    CLAUDE, LOCAL, MANUAL;

    /**
     * Classificação feita pelo próprio servidor (única considerada VERIFICADA). LOCAL e MANUAL vêm do navegador,
     * que o usuário controla: servem só como palpite informativo.
     */
    public boolean doServidor() {
        return this == CLAUDE;
    }
}
