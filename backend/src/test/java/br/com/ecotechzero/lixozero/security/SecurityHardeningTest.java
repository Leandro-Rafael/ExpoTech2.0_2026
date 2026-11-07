package br.com.ecotechzero.lixozero.security;

import br.com.ecotechzero.lixozero.config.PropriedadesApp;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import tools.jackson.databind.json.JsonMapper;

import javax.crypto.SecretKey;
import java.io.IOException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Date;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Testes rápidos (sem subir o Spring) das defesas de autenticação e de tamanho de requisição. */
class SecurityHardeningTest {

    private static final byte[] SECRET = "segredo-de-teste-com-64-bytes-para-permitir-hs512-tambem-0123456".getBytes();
    private static final SecretKey KEY = Keys.hmacShaKeyFor(SECRET);

    private final ServicoJwt jwt = new ServicoJwt(props(), Clock.systemUTC());

    private static PropriedadesApp props() {
        return new PropriedadesApp("target/test-data", "America/Sao_Paulo",
                new PropriedadesApp.Jwt(Base64.getEncoder().encodeToString(SECRET), Duration.ofMinutes(15), Duration.ofDays(7), Duration.ZERO),
                new PropriedadesApp.Cookies("auto"), "", new PropriedadesApp.EmbeddedDb(54399, false), false, false, 50,
                new PropriedadesApp.Iot(false, Duration.ofSeconds(90), 6),
                new PropriedadesApp.Ai(null, "modelo", "https://exemplo.invalid", "2023-06-01", Duration.ofSeconds(1)));
    }

    private static io.jsonwebtoken.JwtBuilder validClaims() {
        Instant now = Instant.now();
        return Jwts.builder().issuer("lixozero-api").subject(UUID.randomUUID().toString()).claim("ver", 0)
                .issuedAt(Date.from(now)).expiration(Date.from(now.plusSeconds(600)));
    }

    @Test
    void jwtAcceptsOnlyValidHs256Tokens() {
        assertThat(jwt.interpretar(validClaims().signWith(KEY, Jwts.SIG.HS256).compact())).isPresent();

        // algoritmo diferente do fixado (mesmo com a chave correta)
        assertThat(jwt.interpretar(validClaims().signWith(KEY, Jwts.SIG.HS512).compact())).isEmpty();
        // token sem assinatura ("alg": "none")
        assertThat(jwt.interpretar(validClaims().compact())).isEmpty();
        // assinado com outra chave
        SecretKey other = Keys.hmacShaKeyFor("outra-chave-qualquer-com-mais-de-32-bytes!!".getBytes());
        assertThat(jwt.interpretar(validClaims().signWith(other, Jwts.SIG.HS256).compact())).isEmpty();
        // expirado
        Instant past = Instant.now().minusSeconds(3600);
        assertThat(jwt.interpretar(validClaims().issuedAt(Date.from(past)).expiration(Date.from(past.plusSeconds(60)))
                .signWith(KEY, Jwts.SIG.HS256).compact())).isEmpty();
        // ainda não válido (nbf no futuro)
        assertThat(jwt.interpretar(validClaims().notBefore(Date.from(Instant.now().plusSeconds(3600)))
                .signWith(KEY, Jwts.SIG.HS256).compact())).isEmpty();
        // emissor errado / sem versão / sem sujeito
        assertThat(jwt.interpretar(validClaims().issuer("outro").signWith(KEY, Jwts.SIG.HS256).compact())).isEmpty();
        assertThat(jwt.interpretar(validClaims().claim("ver", null).signWith(KEY, Jwts.SIG.HS256).compact())).isEmpty();
        assertThat(jwt.interpretar(validClaims().subject(null).signWith(KEY, Jwts.SIG.HS256).compact())).isEmpty();
        // lixo e tamanho exagerado
        assertThat(jwt.interpretar("abc.def.ghi")).isEmpty();
        assertThat(jwt.interpretar("a".repeat(5000))).isEmpty();
    }

    @Test
    void bodyLimitRejectsOversizedJsonByContentLength() throws Exception {
        var filter = new FiltroLimiteCorpo(new EscritorRespostaProblema(JsonMapper.builder().build()));
        var request = new MockHttpServletRequest("POST", "/api/auth/login");
        request.setContentType("application/json");
        request.setContent(new byte[FiltroLimiteCorpo.MAX_JSON_BYTES + 1]);
        var response = new MockHttpServletResponse();
        AtomicBoolean reached = new AtomicBoolean();
        filter.doFilter(request, response, (req, res) -> reached.set(true));

        assertThat(response.getStatus()).isEqualTo(413);
        assertThat(response.getContentType()).startsWith("application/problem+json");
        assertThat(reached).isFalse();
    }

    @Test
    void bodyLimitStopsChunkedBodiesWithoutContentLength() throws Exception {
        var filter = new FiltroLimiteCorpo(new EscritorRespostaProblema(JsonMapper.builder().build()));
        var request = new MockHttpServletRequest("POST", "/api/disposals") {
            @Override
            public long getContentLengthLong() {
                return -1; // "Transfer-Encoding: chunked"
            }
        };
        request.setContentType("application/json");
        request.setContent(new byte[FiltroLimiteCorpo.MAX_JSON_BYTES * 2]);
        FilterChain readAll = (req, res) -> req.getInputStream().readAllBytes();

        assertThatThrownBy(() -> filter.doFilter(request, new MockHttpServletResponse(), readAll)).isInstanceOf(IOException.class);
    }

    @Test
    void bodyLimitIgnoresSmallBodiesAndUploads() throws Exception {
        var filter = new FiltroLimiteCorpo(new EscritorRespostaProblema(JsonMapper.builder().build()));
        var json = new MockHttpServletRequest("POST", "/api/auth/login");
        json.setContentType("application/json");
        json.setContent("{\"email\":\"a@b.com\"}".getBytes());
        var upload = new MockHttpServletRequest("POST", "/api/photos");
        upload.setContentType("multipart/form-data; boundary=x");
        upload.setContent(new byte[FiltroLimiteCorpo.MAX_JSON_BYTES * 4]); // limitado pelo multipart (5 MB)

        for (var request : new MockHttpServletRequest[]{json, upload}) {
            AtomicBoolean reached = new AtomicBoolean();
            filter.doFilter(request, new MockHttpServletResponse(), (req, res) -> reached.set(true));
            assertThat(reached).isTrue();
        }
    }
}
