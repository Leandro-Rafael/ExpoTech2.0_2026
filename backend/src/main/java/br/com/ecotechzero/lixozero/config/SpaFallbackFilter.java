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

    private final boolean spaPresente = new ClassPathResource("static/index.html").exists();

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        if (!spaPresente || !"GET".equals(request.getMethod())) {
            return true;
        }
        String caminho = request.getRequestURI().substring(request.getContextPath().length());
        if (caminho.equals("/") || caminho.startsWith("/api") || caminho.startsWith("/actuator")) {
            return true;
        }
        String ultimoSegmento = caminho.substring(caminho.lastIndexOf('/') + 1);
        return ultimoSegmento.contains(".");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain cadeia)
            throws ServletException, IOException {
        request.getRequestDispatcher("/index.html").forward(request, response);
    }
}
