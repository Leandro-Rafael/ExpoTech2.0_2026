package br.com.ecotechzero.lixozero.security;

import br.com.ecotechzero.lixozero.common.RequestIdFilterConstants;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.MDC;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Correlation id: cada requisição recebe um requestId (ou reaproveita um X-Request-Id válido),
 * que aparece em todos os logs (MDC) e volta no header da resposta. Facilita rastrear erros
 * sem expor detalhes internos ao cliente.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class RequestIdFilter extends OncePerRequestFilter {

    private static final Pattern SAFE_ID = Pattern.compile("^[A-Za-z0-9-]{8,64}$");

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String incoming = request.getHeader(RequestIdFilterConstants.HEADER);
        String requestId = incoming != null && SAFE_ID.matcher(incoming).matches()
                ? incoming
                : UUID.randomUUID().toString().substring(0, 13);
        MDC.put(RequestIdFilterConstants.MDC_KEY, requestId);
        response.setHeader(RequestIdFilterConstants.HEADER, requestId);
        try {
            chain.doFilter(request, response);
        } finally {
            MDC.remove(RequestIdFilterConstants.MDC_KEY);
        }
    }
}
