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
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);
    private static final String VERIFIQUE_CAMPOS = "Verifique os campos destacados.";

    @ExceptionHandler(ApiException.class)
    public ResponseEntity<ApiProblem> tratarApi(ApiException ex) {
        ResponseEntity.BodyBuilder construtor = ResponseEntity.status(ex.getStatus()).contentType(MediaType.APPLICATION_PROBLEM_JSON);
        if (ex.getRetryAfterSeconds() != null) {
            construtor.header(HttpHeaders.RETRY_AFTER, String.valueOf(ex.getRetryAfterSeconds()));
        }
        return construtor.body(ApiProblem.of(ex.getCode(), ex.getStatus().value(), ex.getMessage(), ex.getErrors()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiProblem> tratarValidacaoCorpo(MethodArgumentNotValidException ex) {
        List<ApiProblem.FieldMessage> erros = new ArrayList<>();
        for (FieldError fe : ex.getBindingResult().getFieldErrors()) {
            erros.add(new ApiProblem.FieldMessage(fe.getField(), fe.getDefaultMessage()));
        }
        ex.getBindingResult().getGlobalErrors()
                .forEach(ge -> erros.add(new ApiProblem.FieldMessage(ge.getObjectName(), ge.getDefaultMessage())));
        return validacao(erros);
    }

    @ExceptionHandler(HandlerMethodValidationException.class)
    public ResponseEntity<ApiProblem> tratarValidacaoMetodo(HandlerMethodValidationException ex) {
        List<ApiProblem.FieldMessage> erros = new ArrayList<>();
        ex.getParameterValidationResults().forEach(resultado -> {
            String nome = resultado.getMethodParameter().getParameterName();
            resultado.getResolvableErrors().forEach(erro -> erros.add(new ApiProblem.FieldMessage(nome, erro.getDefaultMessage())));
        });
        return validacao(erros);
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<ApiProblem> tratarRestricao(ConstraintViolationException ex) {
        List<ApiProblem.FieldMessage> erros = ex.getConstraintViolations().stream()
                .map(v -> {
                    String caminho = v.getPropertyPath().toString();
                    return new ApiProblem.FieldMessage(caminho.substring(caminho.lastIndexOf('.') + 1), v.getMessage());
                })
                .toList();
        return validacao(erros);
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ApiProblem> tratarIlegivel(HttpMessageNotReadableException ex) {
        Throwable causa = ex.getCause();
        while (causa != null && !(causa instanceof JacksonException)) {
            causa = causa.getCause();
        }
        if (causa instanceof UnrecognizedPropertyException upe) {
            return validacao(List.of(new ApiProblem.FieldMessage(caminhoDe(upe), "campo não permitido")));
        }
        if (causa instanceof MismatchedInputException mie && !mie.getPath().isEmpty()) {
            return validacao(List.of(new ApiProblem.FieldMessage(caminhoDe(mie), "valor com tipo ou formato inválido")));
        }
        return problema(ErrorCode.VALIDATION_ERROR, HttpStatus.BAD_REQUEST, "Corpo da requisição ausente ou JSON malformado.", null);
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ApiProblem> tratarTipoInvalido(MethodArgumentTypeMismatchException ex) {
        return validacao(List.of(new ApiProblem.FieldMessage(ex.getName(), "valor inválido")));
    }

    @ExceptionHandler(MissingServletRequestParameterException.class)
    public ResponseEntity<ApiProblem> tratarParametroAusente(MissingServletRequestParameterException ex) {
        return validacao(List.of(new ApiProblem.FieldMessage(ex.getParameterName(), "é obrigatório")));
    }

    @ExceptionHandler(MissingServletRequestPartException.class)
    public ResponseEntity<ApiProblem> tratarParteAusente(MissingServletRequestPartException ex) {
        return validacao(List.of(new ApiProblem.FieldMessage(ex.getRequestPartName(), "é obrigatório")));
    }

    @ExceptionHandler(MissingRequestHeaderException.class)
    public ResponseEntity<ApiProblem> tratarCabecalhoAusente(MissingRequestHeaderException ex) {
        return validacao(List.of(new ApiProblem.FieldMessage(ex.getHeaderName(), "header obrigatório")));
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<ApiProblem> tratarArquivoGrande(MaxUploadSizeExceededException ex) {
        return problema(ErrorCode.INVALID_IMAGE, HttpStatus.CONTENT_TOO_LARGE, "A imagem deve ter no máximo 5 MB.", null);
    }

    @ExceptionHandler(MultipartException.class)
    public ResponseEntity<ApiProblem> tratarMultipart(MultipartException ex) {
        return problema(ErrorCode.INVALID_IMAGE, HttpStatus.BAD_REQUEST, "Envie a imagem como multipart/form-data no campo \"file\".", null);
    }

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<ApiProblem> tratarMetodo(HttpRequestMethodNotSupportedException ex) {
        return problema(ErrorCode.NOT_FOUND, HttpStatus.METHOD_NOT_ALLOWED, "Método HTTP não suportado para esta rota.", null);
    }

    @ExceptionHandler(HttpMediaTypeNotSupportedException.class)
    public ResponseEntity<ApiProblem> tratarTipoMidia(HttpMediaTypeNotSupportedException ex) {
        return problema(ErrorCode.VALIDATION_ERROR, HttpStatus.UNSUPPORTED_MEDIA_TYPE, "Tipo de conteúdo não suportado.", null);
    }

    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<ApiProblem> tratarRecursoInexistente(NoResourceFoundException ex) {
        return problema(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND, "Recurso não encontrado.", null);
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ApiProblem> tratarAcessoNegado(AccessDeniedException ex) {
        return problema(ErrorCode.FORBIDDEN, HttpStatus.FORBIDDEN, "Você não tem permissão para esta operação.", null);
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ApiProblem> tratarIntegridade(DataIntegrityViolationException ex) {
        // registra só a constraint (a mensagem do PostgreSQL repete os valores da linha, ex.: e-mails)
        String restricao = ex.getCause() instanceof org.hibernate.exception.ConstraintViolationException cve
                ? cve.getConstraintName() : ex.getMostSpecificCause().getClass().getSimpleName();
        log.warn("Violação de integridade: {}", restricao);
        return problema(ErrorCode.CONFLICT, HttpStatus.CONFLICT, "A operação conflita com dados já existentes.", null);
    }

    @ExceptionHandler({OptimisticLockingFailureException.class, PessimisticLockingFailureException.class})
    public ResponseEntity<ApiProblem> tratarConcorrencia(RuntimeException ex) {
        log.warn("Conflito de concorrência: {}", ex.getMessage());
        return problema(ErrorCode.CONFLICT, HttpStatus.CONFLICT, "O registro foi alterado por outra operação. Tente novamente.", null);
    }

    /**
     * Demais exceções do próprio Spring MVC (406, 400 de binding, timeout assíncrono...) já trazem o status
     * HTTP correto: respondemos com ele, sem detalhes internos, em vez de transformá-las em 500.
     */
    private static ResponseEntity<ApiProblem> erroDoFramework(HttpStatus status) {
        ErrorCode codigo = switch (status) {
            case NOT_FOUND -> ErrorCode.NOT_FOUND;
            case UNAUTHORIZED -> ErrorCode.UNAUTHORIZED;
            case FORBIDDEN -> ErrorCode.FORBIDDEN;
            case CONFLICT -> ErrorCode.CONFLICT;
            default -> ErrorCode.VALIDATION_ERROR;
        };
        return problema(codigo, status, "Requisição inválida.", null);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiProblem> tratarInesperado(Exception ex) {
        if (ex instanceof ErrorResponse er) {
            HttpStatus status = HttpStatus.resolve(er.getStatusCode().value());
            if (status != null && status.is4xxClientError()) {
                return erroDoFramework(status);
            }
        }
        String idRequisicao = MDC.get(RequestIdFilterConstants.MDC_KEY);
        log.error("Erro inesperado (requestId={})", idRequisicao, ex);
        return problema(ErrorCode.INTERNAL_ERROR, HttpStatus.INTERNAL_SERVER_ERROR,
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

    private static ResponseEntity<ApiProblem> validacao(List<ApiProblem.FieldMessage> erros) {
        return problema(ErrorCode.VALIDATION_ERROR, HttpStatus.BAD_REQUEST, VERIFIQUE_CAMPOS, erros);
    }

    private static ResponseEntity<ApiProblem> problema(ErrorCode codigo, HttpStatus status, String detalhe, List<ApiProblem.FieldMessage> erros) {
        return ResponseEntity.status(status).contentType(MediaType.APPLICATION_PROBLEM_JSON)
                .body(ApiProblem.of(codigo, status.value(), detalhe, erros));
    }
}
