package br.com.ecotechzero.lixozero.common;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.List;

/**
 * Corpo de erro no formato RFC 7807 (application/problem+json), exatamente como o contrato:
 * { status, title, detail, code, errors[] }.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ApiProblem(int status, String title, String detail, String code, List<FieldMessage> errors) {

    public record FieldMessage(String field, String message) {
    }

    public static ApiProblem of(ErrorCode code, int status, String detail, List<FieldMessage> errors) {
        return new ApiProblem(status, code.title(), detail, code.name(), errors == null || errors.isEmpty() ? null : errors);
    }
}
