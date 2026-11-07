package br.com.ecotechzero.lixozero.common;

import org.springframework.http.HttpStatus;

/** Códigos de erro do contrato da API (campo "code" do ProblemDetail). */
public enum CodigoErro {
    VALIDATION_ERROR(HttpStatus.BAD_REQUEST, "Dados inválidos"),
    BAD_CREDENTIALS(HttpStatus.UNAUTHORIZED, "Credenciais inválidas"),
    ACCOUNT_LOCKED(HttpStatus.LOCKED, "Conta temporariamente bloqueada"),
    UNAUTHORIZED(HttpStatus.UNAUTHORIZED, "Não autenticado"),
    FORBIDDEN(HttpStatus.FORBIDDEN, "Acesso negado"),
    NOT_FOUND(HttpStatus.NOT_FOUND, "Não encontrado"),
    CONFLICT(HttpStatus.CONFLICT, "Conflito"),
    INSUFFICIENT_POINTS(HttpStatus.UNPROCESSABLE_CONTENT, "Pontos insuficientes"),
    OUT_OF_STOCK(HttpStatus.CONFLICT, "Sem estoque"),
    RATE_LIMITED(HttpStatus.TOO_MANY_REQUESTS, "Muitas requisições"),
    INVALID_IMAGE(HttpStatus.BAD_REQUEST, "Imagem inválida"),
    BUSINESS_RULE(HttpStatus.UNPROCESSABLE_CONTENT, "Regra de negócio violada"),
    INTERNAL_ERROR(HttpStatus.INTERNAL_SERVER_ERROR, "Erro interno");

    private final HttpStatus status;
    private final String title;

    CodigoErro(HttpStatus status, String title) {
        this.status = status;
        this.title = title;
    }

    public HttpStatus status() {
        return status;
    }

    public String title() {
        return title;
    }
}
