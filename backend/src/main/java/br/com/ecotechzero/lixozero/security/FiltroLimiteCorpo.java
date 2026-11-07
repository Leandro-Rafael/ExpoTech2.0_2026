package br.com.ecotechzero.lixozero.security;

import br.com.ecotechzero.lixozero.common.CodigoErro;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ReadListener;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletInputStream;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Locale;

/**
 * Limita o tamanho do corpo das requisições JSON da API (proteção contra DoS por memória).
 * <p>
 * O Tomcat só limita formulários e uploads (multipart, já limitados a 5 MB no application.yml);
 * um JSON de centenas de MB seria lido inteiro pelo Jackson. Aqui: se o Content-Length passa de
 * {@link #MAX_JSON_BYTES} a resposta é 413 na hora; sem Content-Length (envio "chunked"), o fluxo é
 * contado e a leitura falha ao ultrapassar o limite (resultando em 400).
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 5)
public class FiltroLimiteCorpo extends OncePerRequestFilter {

    /** 64 KB: o maior corpo legítimo (rota com 200 solicitações) tem cerca de 9 KB. */
    static final int MAX_JSON_BYTES = 64 * 1024;

    private final EscritorRespostaProblema problemas;

    public FiltroLimiteCorpo(EscritorRespostaProblema problemas) {
        this.problemas = problemas;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String tipoConteudo = request.getContentType();
        return !request.getRequestURI().startsWith("/api/")
                || (tipoConteudo != null && tipoConteudo.toLowerCase(Locale.ROOT).startsWith(MediaType.MULTIPART_FORM_DATA_VALUE));
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain cadeia)
            throws ServletException, IOException {
        if (request.getContentLengthLong() > MAX_JSON_BYTES) {
            problemas.escrever(response, CodigoErro.VALIDATION_ERROR, HttpServletResponse.SC_REQUEST_ENTITY_TOO_LARGE,
                    "Corpo da requisição grande demais.", null);
            return;
        }
        cadeia.doFilter(request.getContentLengthLong() < 0 ? new LimitedRequest(request) : request, response);
    }

    /** Envolve o corpo sem Content-Length declarado e interrompe a leitura acima do limite. */
    static final class LimitedRequest extends HttpServletRequestWrapper {
        private ServletInputStream fluxo;

        LimitedRequest(HttpServletRequest request) {
            super(request);
        }

        @Override
        public ServletInputStream getInputStream() throws IOException {
            if (fluxo == null) {
                fluxo = new LimitedInputStream(super.getInputStream());
            }
            return fluxo;
        }
    }

    static final class LimitedInputStream extends ServletInputStream {
        private final ServletInputStream delegado;
        private long totalLido;

        LimitedInputStream(ServletInputStream delegado) {
            this.delegado = delegado;
        }

        @Override
        public int read() throws IOException {
            int b = delegado.read();
            if (b >= 0) {
                contar(1);
            }
            return b;
        }

        @Override
        public int read(byte[] buffer, int off, int len) throws IOException {
            int n = delegado.read(buffer, off, len);
            if (n > 0) {
                contar(n);
            }
            return n;
        }

        private void contar(int n) throws IOException {
            totalLido += n;
            if (totalLido > MAX_JSON_BYTES) {
                throw new IOException("Corpo da requisição acima de " + MAX_JSON_BYTES + " bytes");
            }
        }

        @Override
        public boolean isFinished() {
            return delegado.isFinished();
        }

        @Override
        public boolean isReady() {
            return delegado.isReady();
        }

        @Override
        public void setReadListener(ReadListener ouvinte) {
            delegado.setReadListener(ouvinte);
        }
    }
}
