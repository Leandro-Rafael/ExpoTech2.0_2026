package br.com.ecotechzero.lixozero.security;

import br.com.ecotechzero.lixozero.config.AppProperties;
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
public class AuthCookies {

    public static final String ACCESS = "ez_access";
    public static final String REFRESH = "ez_refresh";
    private static final String ACCESS_PATH = "/api";
    private static final String REFRESH_PATH = "/api/auth";

    private final AppProperties props;

    public AuthCookies(AppProperties props) {
        this.props = props;
    }

    public void writeSession(HttpServletRequest request, HttpServletResponse response, String accessToken, String refreshToken) {
        add(response, build(request, ACCESS, accessToken, ACCESS_PATH, props.jwt().accessTtl()));
        add(response, build(request, REFRESH, refreshToken, REFRESH_PATH, props.jwt().refreshTtl()));
    }

    public void clear(HttpServletRequest request, HttpServletResponse response) {
        add(response, build(request, ACCESS, "", ACCESS_PATH, Duration.ZERO));
        add(response, build(request, REFRESH, "", REFRESH_PATH, Duration.ZERO));
    }

    public static Optional<String> read(HttpServletRequest request, String name) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) {
            return Optional.empty();
        }
        for (Cookie c : cookies) {
            if (name.equals(c.getName()) && c.getValue() != null && !c.getValue().isBlank()) {
                return Optional.of(c.getValue());
            }
        }
        return Optional.empty();
    }

    private ResponseCookie build(HttpServletRequest request, String name, String value, String path, Duration maxAge) {
        return ResponseCookie.from(name, value)
                .httpOnly(true)
                .secure(isSecure(request))
                .sameSite("Lax")
                .path(path)
                .maxAge(maxAge)
                .build();
    }

    private boolean isSecure(HttpServletRequest request) {
        String mode = props.cookies().secure();
        if ("true".equalsIgnoreCase(mode)) return true;
        if ("false".equalsIgnoreCase(mode)) return false;
        return request.isSecure(); // "auto"
    }

    private static void add(HttpServletResponse response, ResponseCookie cookie) {
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
    }
}
