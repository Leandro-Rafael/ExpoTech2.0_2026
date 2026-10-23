package br.com.ecotechzero.lixozero.common;

import org.springframework.http.HttpStatus;

import java.util.List;

/**
 * Exceção de negócio da aplicação. É convertida pelo {@link GlobalExceptionHandler}
 * em uma resposta RFC 7807 com o código do contrato.
 */
public class ApiException extends RuntimeException {

    private final ErrorCode code;
    private final HttpStatus status;
    private final List<ApiProblem.FieldMessage> errors;
    private final Long retryAfterSeconds;

    public ApiException(ErrorCode code, String detail) {
        this(code, code.status(), detail, null, null);
    }

    public ApiException(ErrorCode code, HttpStatus status, String detail, List<ApiProblem.FieldMessage> errors, Long retryAfterSeconds) {
        super(detail);
        this.code = code;
        this.status = status;
        this.errors = errors;
        this.retryAfterSeconds = retryAfterSeconds;
    }

    public static ApiException notFound(String detail) {
        return new ApiException(ErrorCode.NOT_FOUND, detail);
    }

    public static ApiException conflict(String detail) {
        return new ApiException(ErrorCode.CONFLICT, detail);
    }

    public static ApiException business(String detail) {
        return new ApiException(ErrorCode.BUSINESS_RULE, detail);
    }

    /** Erro de validação associado a um campo específico. */
    public static ApiException field(String field, String message) {
        return new ApiException(ErrorCode.VALIDATION_ERROR, ErrorCode.VALIDATION_ERROR.status(),
                "Verifique os campos destacados.", List.of(new ApiProblem.FieldMessage(field, message)), null);
    }

    public static ApiException rateLimited(long retryAfterSeconds) {
        return new ApiException(ErrorCode.RATE_LIMITED, ErrorCode.RATE_LIMITED.status(),
                "Muitas tentativas. Aguarde alguns instantes e tente novamente.", null, retryAfterSeconds);
    }

    public ErrorCode getCode() {
        return code;
    }

    public HttpStatus getStatus() {
        return status;
    }

    public List<ApiProblem.FieldMessage> getErrors() {
        return errors;
    }

    public Long getRetryAfterSeconds() {
        return retryAfterSeconds;
    }
}
