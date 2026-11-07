package br.com.ecotechzero.lixozero.security;

import br.com.ecotechzero.lixozero.common.CodigoErro;
import br.com.ecotechzero.lixozero.common.ContextoRequisicao;
import br.com.ecotechzero.lixozero.common.LimitadorDeTaxa;
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
public class FiltroLimiteApi extends OncePerRequestFilter {

    private final LimitadorDeTaxa limitador;
    private final EscritorRespostaProblema escritorProblema;

    public FiltroLimiteApi(LimitadorDeTaxa limitador, EscritorRespostaProblema escritorProblema) {
        this.limitador = limitador;
        this.escritorProblema = escritorProblema;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !request.getRequestURI().startsWith("/api/");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain cadeia)
            throws ServletException, IOException {
        var resultado = limitador.tentarConsumir(LimitadorDeTaxa.Policy.API_IP, ContextoRequisicao.ipCliente(request));
        if (!resultado.allowed()) {
            escritorProblema.escrever(response, CodigoErro.RATE_LIMITED, 429,
                    "Muitas requisições. Aguarde alguns instantes.", resultado.retryAfterSeconds());
            return;
        }
        cadeia.doFilter(request, response);
    }
}
