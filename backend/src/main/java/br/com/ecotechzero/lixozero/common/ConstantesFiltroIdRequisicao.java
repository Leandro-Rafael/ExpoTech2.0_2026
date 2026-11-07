package br.com.ecotechzero.lixozero.common;

/** Constantes do correlation id (requestId) compartilhadas entre filtro, logs e tratamento de erros. */
public final class ConstantesFiltroIdRequisicao {

    public static final String MDC_KEY = "requestId";
    public static final String HEADER = "X-Request-Id";

    private ConstantesFiltroIdRequisicao() {
    }
}
