package br.com.ecotechzero.lixozero.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** DTOs de entrada da autenticação. Limites de tamanho evitam hashing de entradas gigantes (DoS). */
public final class DtosAutenticacao {

    static final String EMAIL_REGEX = "^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$";

    private DtosAutenticacao() {
    }

    public record RegisterRequest(
            @NotBlank @Size(min = 2, max = 100) String name,
            @NotBlank @Size(max = 254) @Email(regexp = EMAIL_REGEX, message = "e-mail inválido") String email,
            @NotNull @Size(max = 128) String password) {
    }

    public record LoginRequest(
            @NotBlank @Size(max = 254) String email,
            @NotBlank @Size(max = 128) String password) {
    }

    public record ChangePasswordRequest(
            @NotBlank @Size(max = 128) String currentPassword,
            @NotNull @Size(max = 128) String newPassword) {
    }
}
