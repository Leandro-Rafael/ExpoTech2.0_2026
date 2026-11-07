package br.com.ecotechzero.lixozero.common;

import org.springframework.http.HttpStatus;

import java.util.List;

/**
 * Exceção de negócio da aplicação. É convertida pelo {@link TratadorGlobalExcecoes}
 * em uma resposta RFC 7807 com o código do contrato.
 */
public class ExcecaoApi extends RuntimeException {

    private final CodigoErro codigo;
    private final HttpStatus status;
    private final List<ProblemaApi.FieldMessage> erros;
    private final Long segundosAteNovaTentativa;

    public ExcecaoApi(CodigoErro codigo, String detalhe) {
        this(codigo, codigo.status(), detalhe, null, null);
    }

    public ExcecaoApi(CodigoErro codigo, HttpStatus status, String detalhe, List<ProblemaApi.FieldMessage> erros, Long segundosAteNovaTentativa) {
        super(detalhe);
        this.codigo = codigo;
        this.status = status;
        this.erros = erros;
        this.segundosAteNovaTentativa = segundosAteNovaTentativa;
    }

    public static ExcecaoApi naoEncontrado(String detalhe) {
        return new ExcecaoApi(CodigoErro.NOT_FOUND, detalhe);
    }

    public static ExcecaoApi conflito(String detalhe) {
        return new ExcecaoApi(CodigoErro.CONFLICT, detalhe);
    }

    public static ExcecaoApi regraNegocio(String detalhe) {
        return new ExcecaoApi(CodigoErro.BUSINESS_RULE, detalhe);
    }

    /** Erro de validação associado a um campo específico. */
    public static ExcecaoApi campo(String campo, String mensagem) {
        return new ExcecaoApi(CodigoErro.VALIDATION_ERROR, CodigoErro.VALIDATION_ERROR.status(),
                "Verifique os campos destacados.", List.of(new ProblemaApi.FieldMessage(campo, mensagem)), null);
    }

    public static ExcecaoApi limiteExcedido(long segundosAteNovaTentativa) {
        return new ExcecaoApi(CodigoErro.RATE_LIMITED, CodigoErro.RATE_LIMITED.status(),
                "Muitas tentativas. Aguarde alguns instantes e tente novamente.", null, segundosAteNovaTentativa);
    }

    public CodigoErro getCode() {
        return codigo;
    }

    public HttpStatus getStatus() {
        return status;
    }

    public List<ProblemaApi.FieldMessage> getErrors() {
        return erros;
    }

    public Long getRetryAfterSeconds() {
        return segundosAteNovaTentativa;
    }
}
