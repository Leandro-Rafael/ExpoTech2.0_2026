package br.com.ecotechzero.lixozero.common;

import org.springframework.http.HttpStatus;

import java.util.List;

/**
 * Exceção de negócio da aplicação. É convertida pelo {@link GlobalExceptionHandler}
 * em uma resposta RFC 7807 com o código do contrato.
 */
public class ApiException extends RuntimeException {

    private final ErrorCode codigo;
    private final HttpStatus status;
    private final List<ApiProblem.FieldMessage> erros;
    private final Long segundosAteNovaTentativa;

    public ApiException(ErrorCode codigo, String detalhe) {
        this(codigo, codigo.status(), detalhe, null, null);
    }

    public ApiException(ErrorCode codigo, HttpStatus status, String detalhe, List<ApiProblem.FieldMessage> erros, Long segundosAteNovaTentativa) {
        super(detalhe);
        this.codigo = codigo;
        this.status = status;
        this.erros = erros;
        this.segundosAteNovaTentativa = segundosAteNovaTentativa;
    }

    public static ApiException naoEncontrado(String detalhe) {
        return new ApiException(ErrorCode.NOT_FOUND, detalhe);
    }

    public static ApiException conflito(String detalhe) {
        return new ApiException(ErrorCode.CONFLICT, detalhe);
    }

    public static ApiException regraNegocio(String detalhe) {
        return new ApiException(ErrorCode.BUSINESS_RULE, detalhe);
    }

    /** Erro de validação associado a um campo específico. */
    public static ApiException campo(String campo, String mensagem) {
        return new ApiException(ErrorCode.VALIDATION_ERROR, ErrorCode.VALIDATION_ERROR.status(),
                "Verifique os campos destacados.", List.of(new ApiProblem.FieldMessage(campo, mensagem)), null);
    }

    public static ApiException limiteExcedido(long segundosAteNovaTentativa) {
        return new ApiException(ErrorCode.RATE_LIMITED, ErrorCode.RATE_LIMITED.status(),
                "Muitas tentativas. Aguarde alguns instantes e tente novamente.", null, segundosAteNovaTentativa);
    }

    public ErrorCode getCode() {
        return codigo;
    }

    public HttpStatus getStatus() {
        return status;
    }

    public List<ApiProblem.FieldMessage> getErrors() {
        return erros;
    }

    public Long getRetryAfterSeconds() {
        return segundosAteNovaTentativa;
    }
}
