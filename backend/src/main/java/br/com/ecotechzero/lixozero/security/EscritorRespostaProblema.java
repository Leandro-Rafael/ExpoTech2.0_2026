package br.com.ecotechzero.lixozero.security;

import br.com.ecotechzero.lixozero.common.ProblemaApi;
import br.com.ecotechzero.lixozero.common.CodigoErro;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import tools.jackson.databind.json.JsonMapper;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

/** Escreve respostas de erro RFC 7807 a partir de filtros (fora dos controllers). */
@Component
public class EscritorRespostaProblema {

    private final JsonMapper mapeadorJson;

    public EscritorRespostaProblema(JsonMapper mapeadorJson) {
        this.mapeadorJson = mapeadorJson;
    }

    public void escrever(HttpServletResponse response, CodigoErro codigo, int status, String detalhe, Long segundosAteNovaTentativa) throws IOException {
        if (response.isCommitted()) {
            return;
        }
        response.setStatus(status);
        response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        if (segundosAteNovaTentativa != null) {
            response.setHeader(HttpHeaders.RETRY_AFTER, String.valueOf(segundosAteNovaTentativa));
        }
        response.getWriter().write(mapeadorJson.writeValueAsString(ProblemaApi.of(codigo, status, detalhe, null)));
    }
}
