package br.com.ecotechzero.lixozero.common;

import jakarta.validation.ConstraintViolationException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.dao.PessimisticLockingFailureException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.validation.FieldError;
import org.springframework.web.ErrorResponse;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingRequestHeaderException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.MultipartException;
import org.springframework.web.multipart.support.MissingServletRequestPartException;
import org.springframework.web.servlet.resource.NoResourceFoundException;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.exc.MismatchedInputException;
import tools.jackson.databind.exc.UnrecognizedPropertyException;

import java.util.ArrayList;
import java.util.List;

/**
 * Converte qualquer exceção em uma resposta RFC 7807 padronizada.
 * Nunca expõe stack trace, SQL ou detalhes internos; o erro completo fica apenas no log do servidor,
 * associado ao requestId (correlation id) que também volta no header X-Request-Id.
 */
@RestControllerAdvice
public class TratadorGlobalExcecoes {

    private static final Logger log = LoggerFactory.getLogger(TratadorGlobalExcecoes.class);
    private static final String VERIFIQUE_CAMPOS = "Verifique os campos destacados.";

    @ExceptionHandler(ExcecaoApi.class)
    public ResponseEntity<ProblemaApi> tratarApi(ExcecaoApi ex) {
        ResponseEntity.BodyBuilder construtor = ResponseEntity.status(ex.getStatus()).contentType(MediaType.APPLICATION_PROBLEM_JSON);
        if (ex.getRetryAfterSeconds() != null) {
            construtor.header(HttpHeaders.RETRY_AFTER, String.valueOf(ex.getRetryAfterSeconds()));
        }
        return construtor.body(ProblemaApi.of(ex.getCode(), ex.getStatus().value(), ex.getMessage(), ex.getErrors()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ProblemaApi> tratarValidacaoCorpo(MethodArgumentNotValidException ex) {
        List<ProblemaApi.FieldMessage> erros = new ArrayList<>();
        for (FieldError fe : ex.getBindingResult().getFieldErrors()) {
            erros.add(new ProblemaApi.FieldMessage(fe.getField(), fe.getDefaultMessage()));
        }
        ex.getBindingResult().getGlobalErrors()
                .forEach(ge -> erros.add(new ProblemaApi.FieldMessage(ge.getObjectName(), ge.getDefaultMessage())));
        return validacao(erros);
    }

    @ExceptionHandler(HandlerMethodValidationException.class)
    public ResponseEntity<ProblemaApi> tratarValidacaoMetodo(HandlerMethodValidationException ex) {
        List<ProblemaApi.FieldMessage> erros = new ArrayList<>();
        ex.getParameterValidationResults().forEach(resultado -> {
            String nome = resultado.getMethodParameter().getParameterName();
            resultado.getResolvableErrors().forEach(erro -> erros.add(new ProblemaApi.FieldMessage(nome, erro.getDefaultMessage())));
        });
        return validacao(erros);
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<ProblemaApi> tratarRestricao(ConstraintViolationException ex) {
        List<ProblemaApi.FieldMessage> erros = ex.getConstraintViolations().stream()
                .map(v -> {
                    String caminho = v.getPropertyPath().toString();
                    return new ProblemaApi.FieldMessage(caminho.substring(caminho.lastIndexOf('.') + 1), v.getMessage());
                })
                .toList();
        return validacao(erros);
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ProblemaApi> tratarIlegivel(HttpMessageNotReadableException ex) {
        Throwable causa = ex.getCause();
        while (causa != null && !(causa instanceof JacksonException)) {
            causa = causa.getCause();
        }
        if (causa instanceof UnrecognizedPropertyException upe) {
            return validacao(List.of(new ProblemaApi.FieldMessage(caminhoDe(upe), "campo não permitido")));
        }
        if (causa instanceof MismatchedInputException mie && !mie.getPath().isEmpty()) {
            return validacao(List.of(new ProblemaApi.FieldMessage(caminhoDe(mie), "valor com tipo ou formato inválido")));
        }
        return problema(CodigoErro.VALIDATION_ERROR, HttpStatus.BAD_REQUEST, "Corpo da requisição ausente ou JSON malformado.", null);
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ProblemaApi> tratarTipoInvalido(MethodArgumentTypeMismatchException ex) {
        return validacao(List.of(new ProblemaApi.FieldMessage(ex.getName(), "valor inválido")));
    }

    @ExceptionHandler(MissingServletRequestParameterException.class)
    public ResponseEntity<ProblemaApi> tratarParametroAusente(MissingServletRequestParameterException ex) {
        return validacao(List.of(new ProblemaApi.FieldMessage(ex.getParameterName(), "é obrigatório")));
    }

    @ExceptionHandler(MissingServletRequestPartException.class)
    public ResponseEntity<ProblemaApi> tratarParteAusente(MissingServletRequestPartException ex) {
        return validacao(List.of(new ProblemaApi.FieldMessage(ex.getRequestPartName(), "é obrigatório")));
    }

    @ExceptionHandler(MissingRequestHeaderException.class)
    public ResponseEntity<ProblemaApi> tratarCabecalhoAusente(MissingRequestHeaderException ex) {
        return validacao(List.of(new ProblemaApi.FieldMessage(ex.getHeaderName(), "header obrigatório")));
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<ProblemaApi> tratarArquivoGrande(MaxUploadSizeExceededException ex) {
        return problema(CodigoErro.INVALID_IMAGE, HttpStatus.CONTENT_TOO_LARGE, "A imagem deve ter no máximo 5 MB.", null);
    }

    @ExceptionHandler(MultipartException.class)
    public ResponseEntity<ProblemaApi> tratarMultipart(MultipartException ex) {
        return problema(CodigoErro.INVALID_IMAGE, HttpStatus.BAD_REQUEST, "Envie a imagem como multipart/form-data no campo \"file\".", null);
    }

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<ProblemaApi> tratarMetodo(HttpRequestMethodNotSupportedException ex) {
        return problema(CodigoErro.NOT_FOUND, HttpStatus.METHOD_NOT_ALLOWED, "Método HTTP não suportado para esta rota.", null);
    }

    @ExceptionHandler(HttpMediaTypeNotSupportedException.class)
    public ResponseEntity<ProblemaApi> tratarTipoMidia(HttpMediaTypeNotSupportedException ex) {
        return problema(CodigoErro.VALIDATION_ERROR, HttpStatus.UNSUPPORTED_MEDIA_TYPE, "Tipo de conteúdo não suportado.", null);
    }

    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<ProblemaApi> tratarRecursoInexistente(NoResourceFoundException ex) {
        return problema(CodigoErro.NOT_FOUND, HttpStatus.NOT_FOUND, "Recurso não encontrado.", null);
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ProblemaApi> tratarAcessoNegado(AccessDeniedException ex) {
        return problema(CodigoErro.FORBIDDEN, HttpStatus.FORBIDDEN, "Você não tem permissão para esta operação.", null);
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ProblemaApi> tratarIntegridade(DataIntegrityViolationException ex) {
        // registra só a constraint (a mensagem do PostgreSQL repete os valores da linha, ex.: e-mails)
        String restricao = ex.getCause() instanceof org.hibernate.exception.ConstraintViolationException cve
                ? cve.getConstraintName() : ex.getMostSpecificCause().getClass().getSimpleName();
        log.warn("Violação de integridade: {}", restricao);
        return problema(CodigoErro.CONFLICT, HttpStatus.CONFLICT, "A operação conflita com dados já existentes.", null);
    }

    @ExceptionHandler({OptimisticLockingFailureException.class, PessimisticLockingFailureException.class})
    public ResponseEntity<ProblemaApi> tratarConcorrencia(RuntimeException ex) {
        log.warn("Conflito de concorrência: {}", ex.getMessage());
        return problema(CodigoErro.CONFLICT, HttpStatus.CONFLICT, "O registro foi alterado por outra operação. Tente novamente.", null);
    }

    /**
     * Demais exceções do próprio Spring MVC (406, 400 de binding, timeout assíncrono...) já trazem o status
     * HTTP correto: respondemos com ele, sem detalhes internos, em vez de transformá-las em 500.
     */
    private static ResponseEntity<ProblemaApi> erroDoFramework(HttpStatus status) {
        CodigoErro codigo = switch (status) {
            case NOT_FOUND -> CodigoErro.NOT_FOUND;
            case UNAUTHORIZED -> CodigoErro.UNAUTHORIZED;
            case FORBIDDEN -> CodigoErro.FORBIDDEN;
            case CONFLICT -> CodigoErro.CONFLICT;
            default -> CodigoErro.VALIDATION_ERROR;
        };
        return problema(codigo, status, "Requisição inválida.", null);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ProblemaApi> tratarInesperado(Exception ex) {
        if (ex instanceof ErrorResponse er) {
            HttpStatus status = HttpStatus.resolve(er.getStatusCode().value());
            if (status != null && status.is4xxClientError()) {
                return erroDoFramework(status);
            }
        }
        String idRequisicao = MDC.get(ConstantesFiltroIdRequisicao.MDC_KEY);
        log.error("Erro inesperado (requestId={})", idRequisicao, ex);
        return problema(CodigoErro.INTERNAL_ERROR, HttpStatus.INTERNAL_SERVER_ERROR,
                "Ocorreu um erro inesperado. Código de rastreio: " + idRequisicao, null);
    }

    private static String caminhoDe(MismatchedInputException ex) {
        StringBuilder sb = new StringBuilder();
        for (JacksonException.Reference referencia : ex.getPath()) {
            if (referencia.getPropertyName() != null) {
                if (!sb.isEmpty()) sb.append('.');
                sb.append(referencia.getPropertyName());
            } else if (referencia.getIndex() >= 0) {
                sb.append('[').append(referencia.getIndex()).append(']');
            }
        }
        return sb.isEmpty() ? "body" : sb.toString();
    }

    private static ResponseEntity<ProblemaApi> validacao(List<ProblemaApi.FieldMessage> erros) {
        return problema(CodigoErro.VALIDATION_ERROR, HttpStatus.BAD_REQUEST, VERIFIQUE_CAMPOS, erros);
    }

    private static ResponseEntity<ProblemaApi> problema(CodigoErro codigo, HttpStatus status, String detalhe, List<ProblemaApi.FieldMessage> erros) {
        return ResponseEntity.status(status).contentType(MediaType.APPLICATION_PROBLEM_JSON)
                .body(ProblemaApi.of(codigo, status.value(), detalhe, erros));
    }
}
