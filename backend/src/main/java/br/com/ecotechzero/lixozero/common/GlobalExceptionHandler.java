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
    private static final String CHECK_FIELDS = "Verifique os campos destacados.";

    @ExceptionHandler(ApiException.class)
    public ResponseEntity<ApiProblem> handleApi(ApiException ex) {
        ResponseEntity.BodyBuilder builder = ResponseEntity.status(ex.getStatus()).contentType(MediaType.APPLICATION_PROBLEM_JSON);
        if (ex.getRetryAfterSeconds() != null) {
            builder.header(HttpHeaders.RETRY_AFTER, String.valueOf(ex.getRetryAfterSeconds()));
        }
        return builder.body(ApiProblem.of(ex.getCode(), ex.getStatus().value(), ex.getMessage(), ex.getErrors()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiProblem> handleBodyValidation(MethodArgumentNotValidException ex) {
        List<ApiProblem.FieldMessage> errors = new ArrayList<>();
        for (FieldError fe : ex.getBindingResult().getFieldErrors()) {
            errors.add(new ApiProblem.FieldMessage(fe.getField(), fe.getDefaultMessage()));
        }
        ex.getBindingResult().getGlobalErrors()
                .forEach(ge -> errors.add(new ApiProblem.FieldMessage(ge.getObjectName(), ge.getDefaultMessage())));
        return validation(errors);
    }

    @ExceptionHandler(HandlerMethodValidationException.class)
    public ResponseEntity<ApiProblem> handleMethodValidation(HandlerMethodValidationException ex) {
        List<ApiProblem.FieldMessage> errors = new ArrayList<>();
        ex.getParameterValidationResults().forEach(result -> {
            String name = result.getMethodParameter().getParameterName();
            result.getResolvableErrors().forEach(err -> errors.add(new ApiProblem.FieldMessage(name, err.getDefaultMessage())));
        });
        return validation(errors);
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<ApiProblem> handleConstraint(ConstraintViolationException ex) {
        List<ApiProblem.FieldMessage> errors = ex.getConstraintViolations().stream()
                .map(v -> {
                    String path = v.getPropertyPath().toString();
                    return new ApiProblem.FieldMessage(path.substring(path.lastIndexOf('.') + 1), v.getMessage());
                })
                .toList();
        return validation(errors);
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ApiProblem> handleUnreadable(HttpMessageNotReadableException ex) {
        Throwable cause = ex.getCause();
        while (cause != null && !(cause instanceof JacksonException)) {
            cause = cause.getCause();
        }
        if (cause instanceof UnrecognizedPropertyException upe) {
            return validation(List.of(new ApiProblem.FieldMessage(pathOf(upe), "campo não permitido")));
        }
        if (cause instanceof MismatchedInputException mie && !mie.getPath().isEmpty()) {
            return validation(List.of(new ApiProblem.FieldMessage(pathOf(mie), "valor com tipo ou formato inválido")));
        }
        return problem(ErrorCode.VALIDATION_ERROR, HttpStatus.BAD_REQUEST, "Corpo da requisição ausente ou JSON malformado.", null);
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ApiProblem> handleTypeMismatch(MethodArgumentTypeMismatchException ex) {
        return validation(List.of(new ApiProblem.FieldMessage(ex.getName(), "valor inválido")));
    }

    @ExceptionHandler(MissingServletRequestParameterException.class)
    public ResponseEntity<ApiProblem> handleMissingParam(MissingServletRequestParameterException ex) {
        return validation(List.of(new ApiProblem.FieldMessage(ex.getParameterName(), "é obrigatório")));
    }

    @ExceptionHandler(MissingServletRequestPartException.class)
    public ResponseEntity<ApiProblem> handleMissingPart(MissingServletRequestPartException ex) {
        return validation(List.of(new ApiProblem.FieldMessage(ex.getRequestPartName(), "é obrigatório")));
    }

    @ExceptionHandler(MissingRequestHeaderException.class)
    public ResponseEntity<ApiProblem> handleMissingHeader(MissingRequestHeaderException ex) {
        return validation(List.of(new ApiProblem.FieldMessage(ex.getHeaderName(), "header obrigatório")));
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<ApiProblem> handleTooLarge(MaxUploadSizeExceededException ex) {
        return problem(ErrorCode.INVALID_IMAGE, HttpStatus.CONTENT_TOO_LARGE, "A imagem deve ter no máximo 5 MB.", null);
    }

    @ExceptionHandler(MultipartException.class)
    public ResponseEntity<ApiProblem> handleMultipart(MultipartException ex) {
        return problem(ErrorCode.INVALID_IMAGE, HttpStatus.BAD_REQUEST, "Envie a imagem como multipart/form-data no campo \"file\".", null);
    }

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<ApiProblem> handleMethod(HttpRequestMethodNotSupportedException ex) {
        return problem(ErrorCode.NOT_FOUND, HttpStatus.METHOD_NOT_ALLOWED, "Método HTTP não suportado para esta rota.", null);
    }

    @ExceptionHandler(HttpMediaTypeNotSupportedException.class)
    public ResponseEntity<ApiProblem> handleMediaType(HttpMediaTypeNotSupportedException ex) {
        return problem(ErrorCode.VALIDATION_ERROR, HttpStatus.UNSUPPORTED_MEDIA_TYPE, "Tipo de conteúdo não suportado.", null);
    }

    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<ApiProblem> handleNoResource(NoResourceFoundException ex) {
        return problem(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND, "Recurso não encontrado.", null);
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ApiProblem> handleAccessDenied(AccessDeniedException ex) {
        return problem(ErrorCode.FORBIDDEN, HttpStatus.FORBIDDEN, "Você não tem permissão para esta operação.", null);
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ApiProblem> handleIntegrity(DataIntegrityViolationException ex) {
        log.warn("Violação de integridade: {}", ex.getMostSpecificCause().getMessage());
        return problem(ErrorCode.CONFLICT, HttpStatus.CONFLICT, "A operação conflita com dados já existentes.", null);
    }

    @ExceptionHandler({OptimisticLockingFailureException.class, PessimisticLockingFailureException.class})
    public ResponseEntity<ApiProblem> handleLocking(RuntimeException ex) {
        log.warn("Conflito de concorrência: {}", ex.getMessage());
        return problem(ErrorCode.CONFLICT, HttpStatus.CONFLICT, "O registro foi alterado por outra operação. Tente novamente.", null);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiProblem> handleUnexpected(Exception ex) {
        String requestId = MDC.get(RequestIdFilterConstants.MDC_KEY);
        log.error("Erro inesperado (requestId={})", requestId, ex);
        return problem(ErrorCode.INTERNAL_ERROR, HttpStatus.INTERNAL_SERVER_ERROR,
                "Ocorreu um erro inesperado. Código de rastreio: " + requestId, null);
    }

    private static String pathOf(MismatchedInputException ex) {
        StringBuilder sb = new StringBuilder();
        for (JacksonException.Reference ref : ex.getPath()) {
            if (ref.getPropertyName() != null) {
                if (!sb.isEmpty()) sb.append('.');
                sb.append(ref.getPropertyName());
            } else if (ref.getIndex() >= 0) {
                sb.append('[').append(ref.getIndex()).append(']');
            }
        }
        return sb.isEmpty() ? "body" : sb.toString();
    }

    private static ResponseEntity<ApiProblem> validation(List<ApiProblem.FieldMessage> errors) {
        return problem(ErrorCode.VALIDATION_ERROR, HttpStatus.BAD_REQUEST, CHECK_FIELDS, errors);
    }

    private static ResponseEntity<ApiProblem> problem(ErrorCode code, HttpStatus status, String detail, List<ApiProblem.FieldMessage> errors) {
        return ResponseEntity.status(status).contentType(MediaType.APPLICATION_PROBLEM_JSON)
                .body(ApiProblem.of(code, status.value(), detail, errors));
    }
}
