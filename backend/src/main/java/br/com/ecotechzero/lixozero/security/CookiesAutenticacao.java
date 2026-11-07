package br.com.ecotechzero.lixozero.security;

import br.com.ecotechzero.lixozero.config.PropriedadesApp;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.Optional;

/**
 * Cookies de sessão:
 * <ul>
 *   <li>{@code ez_access}: JWT curto, HttpOnly, enviado para /api.</li>
 *   <li>{@code ez_refresh}: token opaco de 7 dias, HttpOnly, enviado SOMENTE para /api/auth
 *       (reduz a exposição do token de longa duração).</li>
 * </ul>
 * Ambos com SameSite=Lax e Secure quando a conexão é HTTPS (ou forçado por APP_COOKIE_SECURE).
 */
@Component
public class CookiesAutenticacao {

    public static final String ACCESS = "ez_access";
    public static final String REFRESH = "ez_refresh";
    private static final String CAMINHO_ACESSO = "/api";
    private static final String CAMINHO_RENOVACAO = "/api/auth";

    private final PropriedadesApp propriedades;

    public CookiesAutenticacao(PropriedadesApp propriedades) {
        this.propriedades = propriedades;
    }

    public void gravarSessao(HttpServletRequest request, HttpServletResponse response, String tokenAcesso, String tokenRenovacao) {
        adicionar(response, montar(request, ACCESS, tokenAcesso, CAMINHO_ACESSO, propriedades.jwt().accessTtl()));
        adicionar(response, montar(request, REFRESH, tokenRenovacao, CAMINHO_RENOVACAO, propriedades.jwt().refreshTtl()));
    }

    public void limpar(HttpServletRequest request, HttpServletResponse response) {
        adicionar(response, montar(request, ACCESS, "", CAMINHO_ACESSO, Duration.ZERO));
        adicionar(response, montar(request, REFRESH, "", CAMINHO_RENOVACAO, Duration.ZERO));
    }

    public static Optional<String> ler(HttpServletRequest request, String nome) {
        Cookie[] cookiesRecebidos = request.getCookies();
        if (cookiesRecebidos == null) {
            return Optional.empty();
        }
        for (Cookie c : cookiesRecebidos) {
            if (nome.equals(c.getName()) && c.getValue() != null && !c.getValue().isBlank()) {
                return Optional.of(c.getValue());
            }
        }
        return Optional.empty();
    }

    private ResponseCookie montar(HttpServletRequest request, String nome, String valor, String caminho, Duration validade) {
        return ResponseCookie.from(nome, valor)
                .httpOnly(true)
                .secure(ehSeguro(request))
                .sameSite("Lax")
                .path(caminho)
                .maxAge(validade)
                .build();
    }

    private boolean ehSeguro(HttpServletRequest request) {
        String modo = propriedades.cookies().secure();
        if ("true".equalsIgnoreCase(modo)) return true;
        if ("false".equalsIgnoreCase(modo)) return false;
        return request.isSecure(); // "auto"
    }

    private static void adicionar(HttpServletResponse response, ResponseCookie cookie) {
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
    }
}
