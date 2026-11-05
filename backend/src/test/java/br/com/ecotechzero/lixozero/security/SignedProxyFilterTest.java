package br.com.ecotechzero.lixozero.security;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import tools.jackson.databind.json.JsonMapper;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;

/** O proxy do Netlify assina cada requisição; só elas passam, e o IP do visitante vem do Netlify. */
class SignedProxyFilterTest {

    private static final String SECRET = "segredo-do-proxy-netlify-com-mais-de-32-bytes-0123456789";
    private final ProblemResponseWriter problems = new ProblemResponseWriter(JsonMapper.builder().build());

    private static String sign(String secret, String issuer, Instant exp) {
        return Jwts.builder().issuer(issuer).expiration(Date.from(exp)).claim("site_url", "https://lixozero123.netlify.app")
                .signWith(Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8)), Jwts.SIG.HS256).compact();
    }

    /** Executa o filtro e devolve o IP que a aplicação enxergou (null se a requisição foi barrada). */
    private String run(SignedProxyFilter filter, MockHttpServletRequest req, MockHttpServletResponse res) throws Exception {
        AtomicReference<String> seen = new AtomicReference<>();
        filter.doFilter(req, res, (rq, rs) -> seen.set(rq.getRemoteAddr()));
        return seen.get();
    }

    private static MockHttpServletRequest apiRequest() {
        MockHttpServletRequest req = new MockHttpServletRequest("GET", "/api/auth/me");
        req.setRemoteAddr("10.0.0.9"); // IP do proxy
        return req;
    }

    @Test
    void validSignaturePassesAndUsesVisitorIp() throws Exception {
        MockHttpServletRequest req = apiRequest();
        req.addHeader(SignedProxyFilter.SIGNATURE_HEADER, sign(SECRET, "netlify", Instant.now().plusSeconds(60)));
        req.addHeader(SignedProxyFilter.CLIENT_IP_HEADER, "200.1.2.3");
        MockHttpServletResponse res = new MockHttpServletResponse();
        assertThat(run(new SignedProxyFilter(SECRET, problems), req, res)).isEqualTo("200.1.2.3");
        assertThat(res.getStatus()).isEqualTo(200);
    }

    @Test
    void ignoresForgeableForwardedForHeader() throws Exception {
        MockHttpServletRequest req = apiRequest();
        req.addHeader(SignedProxyFilter.SIGNATURE_HEADER, sign(SECRET, "netlify", Instant.now().plusSeconds(60)));
        req.addHeader("X-Forwarded-For", "1.2.3.4, 10.0.0.9"); // valor escolhido pelo visitante
        assertThat(run(new SignedProxyFilter(SECRET, problems), req, new MockHttpServletResponse())).isEqualTo("10.0.0.9");
    }

    @Test
    void rejectsMissingWrongExpiredOrForeignSignatures() throws Exception {
        String[] tokens = {
                null,
                sign("outro-segredo-qualquer-com-mais-de-32-bytes-000000000", "netlify", Instant.now().plusSeconds(60)),
                sign(SECRET, "netlify", Instant.now().minusSeconds(60)),
                sign(SECRET, "atacante", Instant.now().plusSeconds(60)),
                "nao-e-um-jws",
        };
        for (String token : tokens) {
            MockHttpServletRequest req = apiRequest();
            if (token != null) req.addHeader(SignedProxyFilter.SIGNATURE_HEADER, token);
            MockHttpServletResponse res = new MockHttpServletResponse();
            assertThat(run(new SignedProxyFilter(SECRET, problems), req, res)).as("token %s", token).isNull();
            assertThat(res.getStatus()).isEqualTo(403);
        }
    }

    @Test
    void disabledWithoutSecretAndOnlyHealthCheckIsExempt() throws Exception {
        assertThat(run(new SignedProxyFilter("", problems), apiRequest(), new MockHttpServletResponse())).isEqualTo("10.0.0.9");
        MockHttpServletRequest health = new MockHttpServletRequest("GET", "/actuator/health");
        health.setServletPath("/actuator/health");
        health.setRemoteAddr("10.0.0.9");
        assertThat(run(new SignedProxyFilter(SECRET, problems), health, new MockHttpServletResponse())).isEqualTo("10.0.0.9");
    }

    @Test
    void pathVariationsCannotSkipTheSignature() throws Exception {
        for (String uri : new String[] {"/API/auth/me", "//api/auth/me", "/actuator/env", "/"}) {
            MockHttpServletRequest req = new MockHttpServletRequest("GET", uri);
            req.setServletPath(uri);
            MockHttpServletResponse res = new MockHttpServletResponse();
            assertThat(run(new SignedProxyFilter(SECRET, problems), req, res)).as(uri).isNull();
            assertThat(res.getStatus()).as(uri).isEqualTo(403);
        }
    }
}
