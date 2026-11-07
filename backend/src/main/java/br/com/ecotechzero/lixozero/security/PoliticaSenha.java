package br.com.ecotechzero.lixozero.security;

import br.com.ecotechzero.lixozero.common.ExcecaoApi;
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
public class PoliticaSenha {

    public static final int MIN_LENGTH = 10;
    public static final int MAX_LENGTH = 128;

    private final Set<String> senhasComuns;

    public PoliticaSenha() {
        this.senhasComuns = carregarSenhasComuns();
    }

    /** Devolve a mensagem de erro, ou vazio se a senha é aceitável. */
    public Optional<String> verificar(String senha, String email) {
        if (senha == null || senha.length() < MIN_LENGTH || senha.length() > MAX_LENGTH) {
            return Optional.of("a senha deve ter entre " + MIN_LENGTH + " e " + MAX_LENGTH + " caracteres");
        }
        if (senha.chars().noneMatch(Character::isLetter) || senha.chars().noneMatch(Character::isDigit)) {
            return Optional.of("a senha deve conter pelo menos uma letra e um número");
        }
        String minuscula = senha.toLowerCase(Locale.ROOT);
        if (email != null && !email.isBlank()) {
            String emailNormalizado = email.strip().toLowerCase(Locale.ROOT);
            String parteLocal = emailNormalizado.contains("@") ? emailNormalizado.substring(0, emailNormalizado.indexOf('@')) : emailNormalizado;
            if (minuscula.contains(emailNormalizado) || (parteLocal.length() >= 3 && minuscula.contains(parteLocal))) {
                return Optional.of("a senha não pode conter o seu e-mail");
            }
        }
        String soAlfanumerico = minuscula.replaceAll("[^a-z0-9]", "");
        if (senhasComuns.contains(minuscula) || senhasComuns.contains(soAlfanumerico)) {
            return Optional.of("esta senha é muito comum; escolha outra");
        }
        return Optional.empty();
    }

    /** Valida e lança VALIDATION_ERROR no campo indicado. */
    public void validar(String campo, String senha, String email) {
        verificar(senha, email).ifPresent(mensagem -> {
            throw ExcecaoApi.campo(campo, mensagem);
        });
    }

    private static Set<String> carregarSenhasComuns() {
        try (var entrada = new ClassPathResource("security/common-passwords.txt").getInputStream()) {
            return new String(entrada.readAllBytes(), StandardCharsets.UTF_8).lines()
                    .map(String::strip)
                    .filter(s -> !s.isEmpty() && !s.startsWith("#"))
                    .map(s -> s.toLowerCase(Locale.ROOT))
                    .collect(Collectors.toUnmodifiableSet());
        } catch (IOException e) {
            throw new UncheckedIOException("Lista de senhas comuns não encontrada", e);
        }
    }
}
