package br.com.ecotechzero.lixozero.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * Se o front-end compilado estiver em src/main/resources/static (index.html), rotas do SPA
 * como /dashboard ou /mapa são encaminhadas para o index.html (o React Router resolve no navegador).
 * Rotas /api, /actuator e arquivos com extensão (.js, .css, .png) não são afetados.
 */
@Component
public class SpaFallbackFilter extends OncePerRequestFilter {

    private final boolean spaPresent = new ClassPathResource("static/index.html").exists();

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        if (!spaPresent || !"GET".equals(request.getMethod())) {
            return true;
        }
        String path = request.getRequestURI().substring(request.getContextPath().length());
        if (path.equals("/") || path.startsWith("/api") || path.startsWith("/actuator")) {
            return true;
        }
        String lastSegment = path.substring(path.lastIndexOf('/') + 1);
        return lastSegment.contains(".");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        request.getRequestDispatcher("/index.html").forward(request, response);
    }
}
