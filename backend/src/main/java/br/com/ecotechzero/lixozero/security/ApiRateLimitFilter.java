package br.com.ecotechzero.lixozero.security;

import br.com.ecotechzero.lixozero.common.ErrorCode;
import br.com.ecotechzero.lixozero.common.RequestContext;
import br.com.ecotechzero.lixozero.common.TokenBucketRateLimiter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/** Limite global por IP para toda a API (proteção básica contra abuso/DoS). */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 10)
public class ApiRateLimitFilter extends OncePerRequestFilter {

    private final TokenBucketRateLimiter limiter;
    private final ProblemResponseWriter problemWriter;

    public ApiRateLimitFilter(TokenBucketRateLimiter limiter, ProblemResponseWriter problemWriter) {
        this.limiter = limiter;
        this.problemWriter = problemWriter;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !request.getRequestURI().startsWith("/api/");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        var result = limiter.tryConsume(TokenBucketRateLimiter.Policy.API_IP, RequestContext.clientIp(request));
        if (!result.allowed()) {
            problemWriter.write(response, ErrorCode.RATE_LIMITED, 429,
                    "Muitas requisições. Aguarde alguns instantes.", result.retryAfterSeconds());
            return;
        }
        chain.doFilter(request, response);
    }
}
