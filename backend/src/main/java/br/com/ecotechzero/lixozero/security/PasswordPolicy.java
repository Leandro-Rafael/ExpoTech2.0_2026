package br.com.ecotechzero.lixozero.security;

import br.com.ecotechzero.lixozero.common.ApiException;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Política de senhas (contrato da API):
 * 10 a 128 caracteres, ao menos 1 letra e 1 número, não pode conter o e-mail (nem a parte antes do @)
 * e não pode estar na lista de senhas comuns (security/common-passwords.txt).
 */
@Component
public class PasswordPolicy {

    public static final int MIN_LENGTH = 10;
    public static final int MAX_LENGTH = 128;

    private final Set<String> commonPasswords;

    public PasswordPolicy() {
        this.commonPasswords = loadCommonPasswords();
    }

    /** Devolve a mensagem de erro, ou vazio se a senha é aceitável. */
    public Optional<String> check(String password, String email) {
        if (password == null || password.length() < MIN_LENGTH || password.length() > MAX_LENGTH) {
            return Optional.of("a senha deve ter entre " + MIN_LENGTH + " e " + MAX_LENGTH + " caracteres");
        }
        if (password.chars().noneMatch(Character::isLetter) || password.chars().noneMatch(Character::isDigit)) {
            return Optional.of("a senha deve conter pelo menos uma letra e um número");
        }
        String lower = password.toLowerCase(Locale.ROOT);
        if (email != null && !email.isBlank()) {
            String normalizedEmail = email.strip().toLowerCase(Locale.ROOT);
            String localPart = normalizedEmail.contains("@") ? normalizedEmail.substring(0, normalizedEmail.indexOf('@')) : normalizedEmail;
            if (lower.contains(normalizedEmail) || (localPart.length() >= 3 && lower.contains(localPart))) {
                return Optional.of("a senha não pode conter o seu e-mail");
            }
        }
        String alnumOnly = lower.replaceAll("[^a-z0-9]", "");
        if (commonPasswords.contains(lower) || commonPasswords.contains(alnumOnly)) {
            return Optional.of("esta senha é muito comum; escolha outra");
        }
        return Optional.empty();
    }

    /** Valida e lança VALIDATION_ERROR no campo indicado. */
    public void validate(String field, String password, String email) {
        check(password, email).ifPresent(msg -> {
            throw ApiException.field(field, msg);
        });
    }

    private static Set<String> loadCommonPasswords() {
        try (var in = new ClassPathResource("security/common-passwords.txt").getInputStream()) {
            return new String(in.readAllBytes(), StandardCharsets.UTF_8).lines()
                    .map(String::strip)
                    .filter(s -> !s.isEmpty() && !s.startsWith("#"))
                    .map(s -> s.toLowerCase(Locale.ROOT))
                    .collect(Collectors.toUnmodifiableSet());
        } catch (IOException e) {
            throw new UncheckedIOException("Lista de senhas comuns não encontrada", e);
        }
    }
}
