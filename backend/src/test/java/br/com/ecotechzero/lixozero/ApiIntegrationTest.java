package br.com.ecotechzero.lixozero;

import br.com.ecotechzero.lixozero.common.TokenBucketRateLimiter;
import br.com.ecotechzero.lixozero.points.PointTransactionRepository;
import br.com.ecotechzero.lixozero.points.PointTransactionType;
import br.com.ecotechzero.lixozero.user.Role;
import br.com.ecotechzero.lixozero.user.User;
import br.com.ecotechzero.lixozero.user.UserRepository;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/**
 * Testes de integração contra um PostgreSQL embarcado real (banco limpo, sem dados de demonstração).
 * Cada "cliente" guarda seus cookies como um navegador faria.
 */
@SpringBootTest(properties = {
        // Sempre o banco embutido, mesmo que o backend/.env aponte para o Supabase.
        "DB_URL=",
        "app.demo-seed=false",
        "app.iot.simulator=false",
        "app.data-dir=target/test-data",
        "app.embedded-db.clean=true",
        "app.embedded-db.port=54339",
        "app.jwt.secret=dGVzdGUtc2VncmVkby1qd3QtY29tLW1haXMtZGUtMzItYnl0ZXMtMTIzNDU2Nzg5MA=="
})
@AutoConfigureMockMvc
class ApiIntegrationTest {

    @Autowired MockMvc mvc;
    @Autowired JsonMapper json;
    @Autowired UserRepository users;
    @Autowired PointTransactionRepository transactions;
    @Autowired PasswordEncoder encoder;
    @Autowired TokenBucketRateLimiter limiter;

    @BeforeEach
    void resetLimits() {
        limiter.reset();
    }

    /** Cliente HTTP simulado que mantém cookies entre requisições. */
    final class Client {
        final Map<String, String> cookies = new HashMap<>();

        MockHttpServletResponse send(MockHttpServletRequestBuilder req) throws Exception {
            cookies.forEach((k, v) -> req.cookie(new Cookie(k, v)));
            if (cookies.containsKey("XSRF-TOKEN")) {
                req.header("X-XSRF-TOKEN", cookies.get("XSRF-TOKEN"));
            }
            MockHttpServletResponse res = mvc.perform(req).andReturn().getResponse();
            for (Cookie c : res.getCookies()) {
                if (c.getMaxAge() == 0 || c.getValue() == null || c.getValue().isEmpty()) cookies.remove(c.getName());
                else cookies.put(c.getName(), c.getValue());
            }
            return res;
        }

        MockHttpServletResponse postJson(String url, Object body) throws Exception {
            return send(post(url).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body)));
        }

        void csrf() throws Exception {
            assertThat(send(get("/api/auth/csrf")).getStatus()).isEqualTo(204);
            assertThat(cookies).containsKey("XSRF-TOKEN");
        }

        void login(String email, String password) throws Exception {
            csrf();
            var res = postJson("/api/auth/login", Map.of("email", email, "password", password));
            assertThat(res.getStatus()).as(res.getContentAsString()).isEqualTo(200);
        }
    }

    JsonNode body(MockHttpServletResponse res) throws Exception {
        return json.readTree(res.getContentAsString());
    }

    @Test
    void authFlowWithRefreshRotationAndReuseDetection() throws Exception {
        Client browser = new Client();

        // sem CSRF -> 403
        var noCsrf = browser.postJson("/api/auth/register", Map.of("name", "Teste", "email", "x@y.com", "password", "Abcdefgh12"));
        assertThat(noCsrf.getStatus()).isEqualTo(403);

        browser.csrf();
        // senha fraca -> 400 com o campo
        var weak = browser.postJson("/api/auth/register", Map.of("name", "Ana Teste", "email", "ana.teste@exemplo.com", "password", "senha123456"));
        assertThat(weak.getStatus()).isEqualTo(400);
        assertThat(body(weak).path("code").asString()).isEqualTo("VALIDATION_ERROR");
        assertThat(body(weak).path("errors").get(0).path("field").asString()).isEqualTo("password");

        // campo desconhecido -> 400
        var unknown = browser.postJson("/api/auth/register",
                Map.of("name", "Ana", "email", "a@b.com", "password", "Qwe!rty7788", "role", "ADMIN"));
        assertThat(unknown.getStatus()).isEqualTo(400);

        var reg = browser.postJson("/api/auth/register", Map.of("name", "Ana Teste", "email", "Ana.Teste@Exemplo.com", "password", "Ipe-Amarelo-2050"));
        assertThat(reg.getStatus()).isEqualTo(201);
        assertThat(body(reg).path("email").asString()).isEqualTo("ana.teste@exemplo.com");
        assertThat(body(reg).path("role").asString()).isEqualTo("USER");
        assertThat(body(reg).path("level").path("name").asString()).isEqualTo("Semente");
        assertThat(browser.cookies).containsKeys("ez_access", "ez_refresh");
        assertThat(reg.getHeaders("Set-Cookie")).anyMatch(h -> h.startsWith("ez_access") && h.contains("HttpOnly") && h.contains("SameSite=Lax"));

        // e-mail duplicado -> 409
        Client other = new Client();
        other.csrf();
        assertThat(other.postJson("/api/auth/register", Map.of("name", "Outra", "email", "ana.teste@exemplo.com", "password", "Ipe-Roxo-2050x"))
                .getStatus()).isEqualTo(409);

        // logout + login
        assertThat(browser.send(post("/api/auth/logout")).getStatus()).isEqualTo(204);
        assertThat(browser.send(get("/api/auth/me")).getStatus()).isEqualTo(401);
        var bad = browser.postJson("/api/auth/login", Map.of("email", "ana.teste@exemplo.com", "password", "errada-123456"));
        assertThat(bad.getStatus()).isEqualTo(401);
        assertThat(body(bad).path("code").asString()).isEqualTo("BAD_CREDENTIALS");
        browser.login("ana.teste@exemplo.com", "Ipe-Amarelo-2050");

        var me = browser.send(get("/api/auth/me"));
        assertThat(me.getStatus()).isEqualTo(200);
        assertThat(body(me).path("name").asString()).isEqualTo("Ana Teste");

        // refresh: rotaciona o token
        String firstRefresh = browser.cookies.get("ez_refresh");
        assertThat(browser.send(post("/api/auth/refresh")).getStatus()).isEqualTo(200);
        String secondRefresh = browser.cookies.get("ez_refresh");
        assertThat(secondRefresh).isNotEqualTo(firstRefresh);

        // atacante reapresenta o token antigo -> 401 e a família inteira é revogada
        Client attacker = new Client();
        attacker.csrf();
        attacker.cookies.put("ez_refresh", firstRefresh);
        assertThat(attacker.send(post("/api/auth/refresh")).getStatus()).isEqualTo(401);
        // o token novo (legítimo) também deixou de valer
        assertThat(browser.send(post("/api/auth/refresh")).getStatus()).isEqualTo(401);
    }

    @Test
    void lockoutAfterRepeatedFailures() throws Exception {
        createUser("bloqueio@exemplo.com", "Bloqueio-Teste-1", Role.USER);
        Client c = new Client();
        c.csrf();
        int lastStatus = 0;
        for (int i = 0; i < 5; i++) {
            lastStatus = c.postJson("/api/auth/login", Map.of("email", "bloqueio@exemplo.com", "password", "errada-" + i + "xxxx")).getStatus();
        }
        assertThat(lastStatus).isEqualTo(423);
        var locked = c.postJson("/api/auth/login", Map.of("email", "bloqueio@exemplo.com", "password", "Bloqueio-Teste-1"));
        assertThat(locked.getStatus()).isEqualTo(423);
        assertThat(locked.getHeader("Retry-After")).isNotNull();
        assertThat(body(locked).path("code").asString()).isEqualTo("ACCOUNT_LOCKED");
    }

    @Test
    void approvalAwardsPointsExactlyOnceAndProtectsResources() throws Exception {
        createUser("admin.teste@exemplo.com", "Admin-Teste-2050", Role.ADMIN);
        createUser("morador.teste@exemplo.com", "Morador-Teste-2050", Role.USER);
        createUser("vizinho.teste@exemplo.com", "Vizinho-Teste-2050", Role.USER);

        Client resident = new Client();
        resident.login("morador.teste@exemplo.com", "Morador-Teste-2050");
        var categories = body(resident.send(get("/api/categories")));
        String plastic = null;
        for (JsonNode c : categories) {
            if (c.path("code").asString().equals("PLASTICO")) plastic = c.path("id").asString();
        }
        assertThat(plastic).isNotNull();

        // usuário comum não acessa o painel admin
        assertThat(resident.send(get("/api/admin/overview")).getStatus()).isEqualTo(403);

        // quantidade acima do máximo da categoria -> 400
        assertThat(resident.postJson("/api/disposals", Map.of("categoryId", plastic, "quantityKg", 999)).getStatus()).isEqualTo(400);

        // idempotência: mesma chave devolve o mesmo descarte
        String key = UUID.randomUUID().toString();
        var create = resident.send(post("/api/disposals").header("Idempotency-Key", key).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("categoryId", plastic, "quantityKg", 2.5))));
        assertThat(create.getStatus()).as(create.getContentAsString()).isEqualTo(201);
        String disposalId = body(create).path("id").asString();
        assertThat(body(create).path("status").asString()).isEqualTo("PENDING");
        assertThat(body(create).path("estimatedPoints").asInt()).isEqualTo(25);
        assertThat(body(create).has("fraud")).isFalse();
        var again = resident.send(post("/api/disposals").header("Idempotency-Key", key).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("categoryId", plastic, "quantityKg", 2.5))));
        assertThat(body(again).path("id").asString()).isEqualTo(disposalId);

        // outro morador não enxerga o descarte (404, não 403)
        Client neighbour = new Client();
        neighbour.login("vizinho.teste@exemplo.com", "Vizinho-Teste-2050");
        assertThat(neighbour.send(get("/api/disposals/" + disposalId)).getStatus()).isEqualTo(404);

        // admin aprova duas vezes: pontos uma única vez
        Client admin = new Client();
        admin.login("admin.teste@exemplo.com", "Admin-Teste-2050");
        var approve1 = admin.postJson("/api/admin/disposals/" + disposalId + "/approve", Map.of());
        assertThat(approve1.getStatus()).as(approve1.getContentAsString()).isEqualTo(200);
        assertThat(body(approve1).path("pointsAwarded").asInt()).isEqualTo(25);
        assertThat(body(approve1).path("fraud").path("score").isNumber()).isTrue();
        var approve2 = admin.postJson("/api/admin/disposals/" + disposalId + "/approve", Map.of());
        assertThat(approve2.getStatus()).isEqualTo(200);
        var reject = admin.postJson("/api/admin/disposals/" + disposalId + "/reject", Map.of("reason", "teste de conflito"));
        assertThat(reject.getStatus()).isEqualTo(409);

        User user = users.findByEmail("morador.teste@exemplo.com").orElseThrow();
        assertThat(user.getPoints()).isEqualTo(25);
        assertThat(user.getTotalEarned()).isEqualTo(25);
        long earnCount = transactions.findByUserId(user.getId(), org.springframework.data.domain.Pageable.unpaged())
                .stream().filter(t -> t.getType() == PointTransactionType.EARN).count();
        assertThat(earnCount).isEqualTo(1);

        var summary = body(resident.send(get("/api/gamification/summary")));
        assertThat(summary.path("points").asLong()).isEqualTo(25);
        assertThat(summary.path("badges").toString()).contains("PRIMEIRO_DESCARTE");

        // simulador de impacto valida entradas
        assertThat(resident.postJson("/api/impact/simulate", Map.of("population", 0, "kgPerCapitaDay", 1, "currentRecyclingRate", 0.1,
                "targetRecyclingRate", 0.5, "targetYear", 2040, "annualGrowthRate", 0.01)).getStatus()).isEqualTo(400);
        var sim = resident.postJson("/api/impact/simulate", Map.of("population", 300000, "kgPerCapitaDay", 1.1, "currentRecyclingRate", 0.04,
                "targetRecyclingRate", 0.5, "targetYear", 2035, "annualGrowthRate", 0.01));
        assertThat(sim.getStatus()).isEqualTo(200);
        assertThat(body(sim).path("years").size()).isGreaterThan(20);
    }

    @Test
    void routeCancellationCollectorIsolationAndHardening() throws Exception {
        createUser("admin.rotas@exemplo.com", "Admin-Rotas-2050", Role.ADMIN);
        createUser("coletor.a@exemplo.com", "Coletor-A-2050x", Role.COLLECTOR);
        createUser("coletor.b@exemplo.com", "Coletor-B-2050x", Role.COLLECTOR);
        createUser("morador.rotas@exemplo.com", "Morador-Rotas-2050", Role.USER);
        String collectorA = users.findByEmail("coletor.a@exemplo.com").orElseThrow().getId().toString();

        Client resident = new Client();
        resident.login("morador.rotas@exemplo.com", "Morador-Rotas-2050");
        var near = resident.postJson("/api/collection-requests", Map.of("address", "Rua Perto, 10", "latitude", -23.605,
                "longitude", -46.755, "categoryCodes", java.util.List.of("PLASTICO"), "estimatedKg", 5));
        assertThat(near.getStatus()).as(near.getContentAsString()).isEqualTo(201);
        var far = resident.postJson("/api/collection-requests", Map.of("address", "Rua Longe, 99", "latitude", -23.700,
                "longitude", -46.900, "categoryCodes", java.util.List.of("PAPEL"), "estimatedKg", 7));
        String nearId = body(near).path("id").asString();
        String farId = body(far).path("id").asString();

        Client admin = new Client();
        admin.login("admin.rotas@exemplo.com", "Admin-Rotas-2050");
        String today = java.time.LocalDate.now(java.time.ZoneId.of("America/Sao_Paulo")).toString();
        var created = admin.postJson("/api/admin/routes", Map.of("name", "Rota de teste", "collectorId", collectorA,
                "plannedDate", today, "requestIds", java.util.List.of(nearId, farId)));
        assertThat(created.getStatus()).as(created.getContentAsString()).isEqualTo(201);
        JsonNode route = body(created).get(0);
        String routeId = route.path("id").asString();
        double before = route.path("totalDistanceKm").asDouble();

        // coletor B não enxerga nem inicia a rota do coletor A (404)
        Client collectorB = new Client();
        collectorB.login("coletor.b@exemplo.com", "Coletor-B-2050x");
        assertThat(collectorB.postJson("/api/collector/routes/" + routeId + "/start", Map.of()).getStatus()).isEqualTo(404);
        assertThat(collectorB.send(get("/api/collector/routes")).getContentAsString()).doesNotContain(routeId);
        // morador não acessa a área do coletor
        assertThat(resident.send(get("/api/collector/routes")).getStatus()).isEqualTo(403);

        // morador cancela a parada distante: a rota recalcula distância e carga
        var cancel = resident.postJson("/api/collection-requests/" + farId + "/cancel", Map.of());
        assertThat(cancel.getStatus()).as(cancel.getContentAsString()).isEqualTo(200);
        assertThat(body(cancel).path("status").asString()).isEqualTo("CANCELLED");
        JsonNode updated = null;
        for (JsonNode r : body(admin.send(get("/api/admin/routes")))) {
            if (r.path("id").asString().equals(routeId)) updated = r;
        }
        assertThat(updated).isNotNull();
        assertThat(updated.path("stops").size()).isEqualTo(1);
        assertThat(updated.path("totalDistanceKm").asDouble()).isLessThan(before);
        assertThat(updated.path("loadKg").asDouble()).isEqualTo(5.0);

        Client collector = new Client();
        collector.login("coletor.a@exemplo.com", "Coletor-A-2050x");
        var start = collector.postJson("/api/collector/routes/" + routeId + "/start", Map.of());
        assertThat(start.getStatus()).as(start.getContentAsString()).isEqualTo(200);
        assertThat(body(start).path("status").asString()).isEqualTo("IN_PROGRESS");
        // já em rota: não pode mais ser cancelada
        assertThat(resident.postJson("/api/collection-requests/" + nearId + "/cancel", Map.of()).getStatus()).isEqualTo(422);

        // cabeçalhos de segurança na API
        var me = resident.send(get("/api/auth/me"));
        assertThat(me.getHeader("X-Content-Type-Options")).isEqualTo("nosniff");
        assertThat(me.getHeader("Content-Security-Policy")).contains("frame-ancestors 'none'");
        assertThat(me.getHeader("X-Frame-Options")).isEqualTo("DENY");
        assertThat(me.getHeader("Cross-Origin-Resource-Policy")).isEqualTo("same-origin");

        // IoT: sem CSRF, mas exige credenciais do dispositivo (401, não 403)
        var iot = mvc.perform(post("/api/iot/readings").header("X-Device-Id", UUID.randomUUID().toString())
                .header("X-Device-Key", "chave-errada").contentType(MediaType.APPLICATION_JSON)
                .content("{\"fillLevel\":50,\"batteryLevel\":90}")).andReturn().getResponse();
        assertThat(iot.getStatus()).isEqualTo(401);

        // corpo JSON gigante é recusado antes de chegar ao Jackson
        var huge = resident.send(post("/api/disposals").contentType(MediaType.APPLICATION_JSON)
                .content("{\"notes\":\"" + "x".repeat(200_000) + "\"}"));
        assertThat(huge.getStatus()).isEqualTo(413);
    }

    private void createUser(String email, String password, Role role) {
        if (users.findByEmail(email).isEmpty()) {
            users.save(new User("Usuário " + role.name().toLowerCase(), email, encoder.encode(password), role));
        }
    }
}
