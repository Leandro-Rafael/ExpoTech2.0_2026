package br.com.ecotechzero.lixozero.common;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.util.Optional;

/** Acesso à requisição HTTP atual (IP do cliente para auditoria e rate limit). */
public final class RequestContext {

    private RequestContext() {
    }

    public static Optional<HttpServletRequest> atual() {
        if (RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes atributos) {
            return Optional.of(atributos.getRequest());
        }
        return Optional.empty();
    }

    /**
     * IP do cliente. Usa getRemoteAddr(): X-Forwarded-For só é considerado quando o servidor está
     * configurado para confiar no proxy (server.forward-headers-strategy), evitando falsificação.
     */
    public static String ipCliente(HttpServletRequest request) {
        return request.getRemoteAddr();
    }

    public static String ipAtual() {
        return atual().map(RequestContext::ipCliente).orElse(null);
    }

    public static String userAgentAtual() {
        return atual().map(r -> Text.truncar(r.getHeader("User-Agent"), 255)).orElse(null);
    }
}
