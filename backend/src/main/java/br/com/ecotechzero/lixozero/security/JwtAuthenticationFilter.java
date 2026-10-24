package br.com.ecotechzero.lixozero.security;

import br.com.ecotechzero.lixozero.common.ErrorCode;
import br.com.ecotechzero.lixozero.user.User;
import br.com.ecotechzero.lixozero.user.UserRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

/**
 * Autentica a requisição a partir do cookie {@code ez_access}.
 * <p>
 * Além de validar a assinatura do JWT, recarrega o usuário do banco a cada requisição para que
 * desativação, mudança de perfil e troca de senha (token_version) tenham efeito IMEDIATO,
 * sem esperar o token expirar.
 * <p>
 * Conta bloqueada por tentativa de inspeção: responde 423 (ACCOUNT_LOCKED + Retry-After) em qualquer rota
 * da API, exceto csrf, logout, login e cadastro (o navegador ainda consegue sair; o login faz a própria checagem).
 */
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtService jwtService;
    private final UserRepository users;
    private final ProblemResponseWriter problems;
    private final Clock clock;

    public JwtAuthenticationFilter(JwtService jwtService, UserRepository users, ProblemResponseWriter problems, Clock clock) {
        this.jwtService = jwtService;
        this.users = users;
        this.problems = problems;
        this.clock = clock;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !request.getRequestURI().startsWith("/api/");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        Optional<User> found = AuthCookies.read(request, AuthCookies.ACCESS)
                .flatMap(jwtService::parse)
                .flatMap(claims -> users.findById(claims.userId())
                        .filter(User::isEnabled)
                        .filter(u -> u.getTokenVersion() == claims.tokenVersion()));
        if (found.isPresent()) {
            User user = found.get();
            Instant now = clock.instant();
            if (user.isSecurityLocked(now) && !isExempt(request)) {
                problems.write(response, ErrorCode.ACCOUNT_LOCKED, 423, InspectionService.LOCK_MESSAGE,
                        InspectionService.retryAfterSeconds(user.getSecurityLockedUntil(), now));
                return;
            }
            AuthUser principal = new AuthUser(user.getId(), user.getEmail(), user.getName(), user.getRole());
            var auth = new UsernamePasswordAuthenticationToken(principal, null,
                    List.of(new SimpleGrantedAuthority("ROLE_" + user.getRole().name())));
            SecurityContextHolder.getContext().setAuthentication(auth);
        }
        chain.doFilter(request, response);
    }

    private static boolean isExempt(HttpServletRequest request) {
        String uri = request.getRequestURI();
        // login/cadastro fazem a própria checagem (e outra pessoa pode entrar no mesmo navegador)
        return uri.equals("/api/auth/logout") || uri.equals("/api/auth/csrf")
                || uri.equals("/api/auth/login") || uri.equals("/api/auth/register");
    }
}
