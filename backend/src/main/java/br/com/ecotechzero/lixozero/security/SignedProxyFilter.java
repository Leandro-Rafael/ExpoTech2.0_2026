package br.com.ecotechzero.lixozero.security;

import br.com.ecotechzero.lixozero.common.ErrorCode;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import javax.crypto.SecretKey;
import java.io.IOException;
import java.nio.charset.StandardCharsets;

/**
 * Em produção a API só é acessada pelo proxy do Netlify, que assina cada requisição (cabeçalho
 * {@code x-nf-sign}, JWS HS256 com o segredo APP_PROXY_SIGNING_SECRET). Requisições sem assinatura
 * válida são recusadas, e o IP do cliente passa a ser o informado pelo Netlify — sem isso, todos os
 * usuários teriam o IP do proxy e dividiriam os limites por IP. Sem segredo configurado, não faz nada.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 5)
public class SignedProxyFilter extends OncePerRequestFilter {

    static final String SIGNATURE_HEADER = "x-nf-sign";
    static final String CLIENT_IP_HEADER = "x-nf-client-connection-ip";
    static final String HEALTH_PATH = "/actuator/health";

    private final SecretKey key;
    private final ProblemResponseWriter problems;

    public SignedProxyFilter(@Value("${app.proxy.signing-secret:}") String secret, ProblemResponseWriter problems) {
        this.key = secret.isBlank() ? null : Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.problems = problems;
    }

    /** Assinatura exigida em tudo; só a checagem de saúde do Render fica de fora (caminho já decodificado). */
    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return key == null || HEALTH_PATH.equals(request.getServletPath());
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String token = request.getHeader(SIGNATURE_HEADER);
        try {
            if (token == null) {
                throw new JwtException("sem assinatura");
            }
            Jwts.parser().verifyWith(key).requireIssuer("netlify").build().parseSignedClaims(token);
        } catch (JwtException | IllegalArgumentException e) {
            problems.write(response, ErrorCode.FORBIDDEN, 403, "Acesso permitido apenas pelo site oficial.", null);
            return;
        }
        String clientIp = clientIp(request);
        chain.doFilter(clientIp == null ? request : new HttpServletRequestWrapper(request) {
            @Override
            public String getRemoteAddr() {
                return clientIp;
            }
        }, response);
    }

    /**
     * IP real do visitante, definido pelo próprio Netlify. X-Forwarded-For não é usado: o visitante
     * pode preenchê-lo e burlar os limites. Sem o cabeçalho, mantém o IP da conexão.
     */
    static String clientIp(HttpServletRequest request) {
        String ip = request.getHeader(CLIENT_IP_HEADER);
        return ip == null || ip.isBlank() ? null : ip.trim();
    }
}
