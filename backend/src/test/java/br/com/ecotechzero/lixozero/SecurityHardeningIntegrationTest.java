package br.com.ecotechzero.lixozero;

import br.com.ecotechzero.lixozero.common.TokenBucketRateLimiter;
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
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.AbstractMockHttpServletRequestBuilder;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.util.HashMap;
import java.util.Map;
import java.util.Random;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/**
 * Blindagem: IA verificada no servidor (bônus não pode ser forjado), cadeia de integridade + tabelas
 * append-only, e bloqueio por tentativa de inspeção. Mesmas propriedades do ApiIntegrationTest
 * (o Spring reaproveita o contexto e o PostgreSQL embarcado).
 */
@SpringBootTest(properties = {
        "app.demo-seed=false",
        "app.iot.simulator=false",
        "app.data-dir=target/test-data",
        "app.embedded-db.clean=true",
        "app.embedded-db.port=54339",
        "app.jwt.secret=dGVzdGUtc2VncmVkby1qd3QtY29tLW1haXMtZGUtMzItYnl0ZXMtMTIzNDU2Nzg5MA=="
})
@AutoConfigureMockMvc
class SecurityHardeningIntegrationTest {

    @Autowired MockMvc mvc;
    @Autowired JsonMapper json;
    @Autowired UserRepository users;
    @Autowired PasswordEncoder encoder;
    @Autowired TokenBucketRateLimiter limiter;
    @Autowired JdbcTemplate jdbc;

    private final Random random = new Random();

    @BeforeEach
    void resetLimits() {
        limiter.reset();
    }

    final class Client {
        final Map<String, String> cookies = new HashMap<>();

        MockHttpServletResponse send(AbstractMockHttpServletRequestBuilder<?> req) throws Exception {
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

        MockHttpServletResponse tryLogin(String email, String password) throws Exception {
            send(get("/api/auth/csrf"));
            return postJson("/api/auth/login", Map.of("email", email, "password", password));
        }

        Client login(String email, String password) throws Exception {
            var res = tryLogin(email, password);
            assertThat(res.getStatus()).as(res.getContentAsString()).isEqualTo(200);
            return this;
        }

        String uploadPhoto() throws Exception {
            var res = send(multipart("/api/photos").file(new MockMultipartFile("file", "foto.png", "image/png", noisePng())));
            assertThat(res.getStatus()).as(res.getContentAsString()).isEqualTo(201);
            JsonNode body = body(res);
            assertThat(body.path("ai").path("verified").asBoolean()).isFalse(); // teste sem ANTHROPIC_API_KEY
            return body.path("id").asString();
        }
    }

    JsonNode body(MockHttpServletResponse res) throws Exception {
        return json.readTree(res.getContentAsString());
    }

    byte[] noisePng() throws Exception {
        BufferedImage img = new BufferedImage(48, 48, BufferedImage.TYPE_INT_RGB);
        for (int x = 0; x < 48; x++) for (int y = 0; y < 48; y++) img.setRGB(x, y, random.nextInt(0xFFFFFF));
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(img, "png", out);
        return out.toByteArray();
    }

    private void createUser(String email, String password, Role role) {
        if (users.findByEmail(email).isEmpty()) {
            users.save(new User("Usuário " + role.name().toLowerCase(), email, encoder.encode(password), role));
        }
    }

    private Map<String, JsonNode> categories(Client c) throws Exception {
        Map<String, JsonNode> map = new HashMap<>();
        for (JsonNode cat : body(c.send(get("/api/categories")))) map.put(cat.path("code").asString(), cat);
        return map;
    }

    /** Simula a classificação que a IA do servidor (Claude) teria gravado na foto no upload. */
    private void serverClassifies(String photoId, String code, double confidence) {
        jdbc.update("update photos set ai_code = ?, ai_confidence = ?, ai_source = 'CLAUDE', ai_model = 'teste', ai_classified_at = now() where id = ?",
                code, confidence, UUID.fromString(photoId));
    }

    private MockHttpServletResponse createDisposal(Client c, Map<String, Object> body) throws Exception {
        return c.send(post("/api/disposals").header("Idempotency-Key", UUID.randomUUID().toString())
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body)));
    }

    // ---------------------------------------------------------------- 1. IA verificada no servidor

    @Test
    void aiBonusOnlyFromServerVerifiedClassification() throws Exception {
        createUser("admin.ia@exemplo.com", "Admin-IA-2050x", Role.ADMIN);
        createUser("morador.ia@exemplo.com", "Morador-IA-2050", Role.USER);
        createUser("vizinho.ia@exemplo.com", "Vizinho-IA-2050", Role.USER);
        Client resident = new Client().login("morador.ia@exemplo.com", "Morador-IA-2050");
        Client admin = new Client().login("admin.ia@exemplo.com", "Admin-IA-2050x");
        var cats = categories(resident);
        String plastic = cats.get("PLASTICO").path("id").asString();
        int plasticPpk = cats.get("PLASTICO").path("pointsPerKg").asInt();
        String paper = cats.get("PAPEL").path("id").asString();
        int paperPpk = cats.get("PAPEL").path("pointsPerKg").asInt();
        long base = Math.round(2.5 * plasticPpk);
        long withBonus = Math.round(base * 1.1);

        // (a) campos de IA forjados pelo cliente (até "CLAUDE") não dão bônus nem viram "verificado"
        String photo1 = resident.uploadPhoto();
        var forged = createDisposal(resident, Map.of("categoryId", plastic, "quantityKg", 2.5, "photoId", photo1,
                "aiSuggestedCode", "PLASTICO", "aiConfidence", 0.99, "aiSource", "CLAUDE"));
        assertThat(forged.getStatus()).as(forged.getContentAsString()).isEqualTo(201);
        assertThat(body(forged).path("estimatedPoints").asLong()).isEqualTo(base);
        assertThat(body(forged).path("ai").path("verified").asBoolean()).isFalse();
        assertThat(body(forged).path("ai").path("source").asString()).isEqualTo("LOCAL");
        var approvedForged = admin.postJson("/api/admin/disposals/" + body(forged).path("id").asString() + "/approve", Map.of());
        assertThat(body(approvedForged).path("pointsAwarded").asLong()).isEqualTo(base);

        // (b) a mesma foto não comprova dois descartes
        var reuse = createDisposal(resident, Map.of("categoryId", plastic, "quantityKg", 1, "photoId", photo1));
        assertThat(reuse.getStatus()).isEqualTo(400);

        // (c) foto de outra pessoa: 404 (não revela que existe)
        Client neighbour = new Client().login("vizinho.ia@exemplo.com", "Vizinho-IA-2050");
        String neighbourPhoto = neighbour.uploadPhoto();
        var stolen = createDisposal(resident, Map.of("categoryId", plastic, "quantityKg", 1, "photoId", neighbourPhoto));
        assertThat(stolen.getStatus()).isEqualTo(404);

        // (d) classificação VERIFICADA do servidor que concorda: bônus de +10%
        String photo2 = resident.uploadPhoto();
        serverClassifies(photo2, "PLASTICO", 0.92);
        var verified = createDisposal(resident, Map.of("categoryId", plastic, "quantityKg", 2.5, "photoId", photo2,
                "aiSuggestedCode", "REJEITO", "aiConfidence", 0.3, "aiSource", "LOCAL"));
        assertThat(body(verified).path("ai").path("verified").asBoolean()).isTrue();
        assertThat(body(verified).path("ai").path("source").asString()).isEqualTo("CLAUDE");
        assertThat(body(verified).path("estimatedPoints").asLong()).isEqualTo(withBonus);
        var approvedVerified = admin.postJson("/api/admin/disposals/" + body(verified).path("id").asString() + "/approve", Map.of());
        assertThat(body(approvedVerified).path("pointsAwarded").asLong()).isEqualTo(withBonus);

        // (e) admin corrige a categoria na aprovação: o bônus é reavaliado e cai
        String photo3 = resident.uploadPhoto();
        serverClassifies(photo3, "PLASTICO", 0.92);
        var corrected = createDisposal(resident, Map.of("categoryId", plastic, "quantityKg", 2.5, "photoId", photo3));
        var approvedCorrected = admin.postJson("/api/admin/disposals/" + body(corrected).path("id").asString() + "/approve",
                Map.of("categoryId", paper));
        assertThat(approvedCorrected.getStatus()).as(approvedCorrected.getContentAsString()).isEqualTo(200);
        assertThat(body(approvedCorrected).path("pointsAwarded").asLong()).isEqualTo(Math.max(1, Math.round(2.5 * paperPpk)));

        // (f) foto antiga (guardada de outro dia): sem bônus
        String photo4 = resident.uploadPhoto();
        serverClassifies(photo4, "PLASTICO", 0.92);
        jdbc.update("update photos set created_at = now() - interval '25 hours' where id = ?", UUID.fromString(photo4));
        var stale = createDisposal(resident, Map.of("categoryId", plastic, "quantityKg", 2.5, "photoId", photo4));
        assertThat(body(stale).path("ai").path("verified").asBoolean()).isFalse();
        assertThat(body(stale).path("estimatedPoints").asLong()).isEqualTo(base);
    }

    // ---------------------------------------------------------------- 2. Integridade

    @Test
    void integrityChainVerifiesAndDetectsTampering() throws Exception {
        createUser("admin.int@exemplo.com", "Admin-Int-2050x", Role.ADMIN);
        createUser("morador.int@exemplo.com", "Morador-Int-2050", Role.USER);
        Client resident = new Client().login("morador.int@exemplo.com", "Morador-Int-2050");
        Client admin = new Client().login("admin.int@exemplo.com", "Admin-Int-2050x");
        String plastic = categories(resident).get("PLASTICO").path("id").asString();
        for (int i = 0; i < 2; i++) {
            var d = createDisposal(resident, Map.of("categoryId", plastic, "quantityKg", 1 + i));
            assertThat(admin.postJson("/api/admin/disposals/" + body(d).path("id").asString() + "/approve", Map.of()).getStatus()).isEqualTo(200);
        }

        // só ADMIN
        assertThat(resident.send(get("/api/admin/integrity")).getStatus()).isEqualTo(403);
        JsonNode ok = body(admin.send(get("/api/admin/integrity")));
        assertThat(ok.path("ledger").path("ok").asBoolean()).as(ok.toString()).isTrue();
        assertThat(ok.path("ledger").path("rowsChecked").asLong()).isGreaterThanOrEqualTo(2);
        assertThat(ok.path("audit").path("ok").asBoolean()).as(ok.toString()).isTrue();
        assertThat(ok.path("audit").path("rowsChecked").asLong()).isPositive();
        assertThat(ok.path("balances").path("ok").asBoolean()).as(ok.toString()).isTrue();
        assertThat(ok.path("ledger").path("brokenAt").isNull()).isTrue();

        // append-only: UPDATE/DELETE/TRUNCATE recusados pelo próprio banco
        UUID userId = users.findByEmail("morador.int@exemplo.com").orElseThrow().getId();
        assertThatThrownBy(() -> jdbc.update("update point_transactions set amount = 9999 where user_id = ?", userId))
                .hasMessageContaining("append-only");
        assertThatThrownBy(() -> jdbc.update("delete from point_transactions where user_id = ?", userId))
                .hasMessageContaining("append-only");
        assertThatThrownBy(() -> jdbc.update("delete from audit_log")).hasMessageContaining("append-only");
        assertThatThrownBy(() -> jdbc.execute("truncate audit_log")).hasMessageContaining("append-only");

        // adulteração "por fora" (desligando o trigger, como faria alguém com acesso ao banco) é detectada
        Map<String, Object> first = jdbc.queryForMap(
                "select id, amount from point_transactions where user_id = ? order by seq limit 1", userId);
        UUID txId = (UUID) first.get("id");
        int amount = ((Number) first.get("amount")).intValue();
        tamper("point_transactions", "update point_transactions set amount = amount + 500 where id = ?", txId);
        try {
            JsonNode broken = body(admin.send(get("/api/admin/integrity")));
            assertThat(broken.path("ledger").path("ok").asBoolean()).isFalse();
            assertThat(broken.path("ledger").path("brokenAt").path("table").asString()).isEqualTo("point_transactions");
            assertThat(broken.path("ledger").path("brokenAt").path("id").asString()).isEqualTo(txId.toString());
            assertThat(broken.path("ledger").path("brokenAt").path("userId").asString()).isEqualTo(userId.toString());
            assertThat(broken.path("balances").path("ok").asBoolean()).isFalse();
            assertThat(broken.path("balances").path("mismatches").asLong()).isPositive();
        } finally {
            tamper("point_transactions", "update point_transactions set amount = " + amount + " where id = ?", txId);
        }

        Map<String, Object> audit = jdbc.queryForMap("select id, details from audit_log order by seq desc limit 1");
        UUID auditId = (UUID) audit.get("id");
        String details = (String) audit.get("details");
        tamper("audit_log", "update audit_log set details = 'apagando rastros' where id = ?", auditId);
        try {
            JsonNode broken = body(admin.send(get("/api/admin/integrity")));
            assertThat(broken.path("audit").path("ok").asBoolean()).isFalse();
            assertThat(broken.path("audit").path("brokenAt").path("id").asString()).isEqualTo(auditId.toString());
        } finally {
            jdbc.execute("alter table audit_log disable trigger trg_audit_append_only");
            jdbc.update("update audit_log set details = ? where id = ?", details, auditId);
            jdbc.execute("alter table audit_log enable trigger trg_audit_append_only");
        }
        JsonNode restored = body(admin.send(get("/api/admin/integrity")));
        assertThat(restored.path("ledger").path("ok").asBoolean()).as(restored.toString()).isTrue();
        assertThat(restored.path("audit").path("ok").asBoolean()).as(restored.toString()).isTrue();
        assertThat(restored.path("balances").path("ok").asBoolean()).as(restored.toString()).isTrue();
    }

    private void tamper(String table, String sql, UUID id) {
        String trigger = table.equals("audit_log") ? "trg_audit_append_only" : "trg_point_tx_append_only";
        jdbc.execute("alter table " + table + " disable trigger " + trigger);
        try {
            jdbc.update(sql, id);
        } finally {
            jdbc.execute("alter table " + table + " enable trigger " + trigger);
        }
    }

    // ---------------------------------------------------------------- 3. Bloqueio por inspeção

    @Test
    void inspectionWarningsLockAccountAndAdminUnlocks() throws Exception {
        createUser("admin.insp@exemplo.com", "Admin-Insp-2050", Role.ADMIN);
        createUser("morador.insp@exemplo.com", "Morador-Insp-2050", Role.USER);
        UUID userId = users.findByEmail("morador.insp@exemplo.com").orElseThrow().getId();
        Client browser = new Client().login("morador.insp@exemplo.com", "Morador-Insp-2050");

        // sem CSRF/sem login: recusado
        assertThat(new Client().postJson("/api/security/inspection-events", Map.of("trigger", "F12")).getStatus()).isIn(401, 403);
        // gatilho inválido: 400
        assertThat(browser.postJson("/api/security/inspection-events", Map.of("trigger", "HACK")).getStatus()).isEqualTo(400);

        JsonNode w1 = body(browser.postJson("/api/security/inspection-events", Map.of("trigger", "F12")));
        assertThat(w1.path("warnings").asInt()).isEqualTo(1);
        assertThat(w1.path("maxWarnings").asInt()).isEqualTo(3);
        assertThat(w1.path("locked").asBoolean()).isFalse();
        // F12 + detector de DevTools em seguida: deduplicado (conta uma vez)
        JsonNode dup = body(browser.postJson("/api/security/inspection-events", Map.of("trigger", "DEVTOOLS_OPEN")));
        assertThat(dup.path("warnings").asInt()).isEqualTo(1);
        assertThat(body(browser.send(get("/api/auth/me"))).path("securityWarnings").asInt()).isEqualTo(1);

        expireDedupeWindow(userId);
        assertThat(body(browser.postJson("/api/security/inspection-events", Map.of("trigger", "CTRL_U"))).path("warnings").asInt()).isEqualTo(2);
        expireDedupeWindow(userId);
        JsonNode w3 = body(browser.postJson("/api/security/inspection-events", Map.of("trigger", "CTRL_SHIFT_I")));
        assertThat(w3.path("warnings").asInt()).isEqualTo(3);
        assertThat(w3.path("locked").asBoolean()).isTrue();
        assertThat(w3.path("lockedUntil").isNull()).isFalse();

        // bloqueado: /me, refresh e login (senha certa) -> 423 com Retry-After
        var me = browser.send(get("/api/auth/me"));
        assertThat(me.getStatus()).isEqualTo(423);
        assertThat(body(me).path("code").asString()).isEqualTo("ACCOUNT_LOCKED");
        assertThat(Long.parseLong(me.getHeader("Retry-After"))).isBetween(1700L, 1801L);
        assertThat(browser.send(post("/api/auth/refresh")).getStatus()).isEqualTo(423);
        Client other = new Client();
        var login = other.tryLogin("morador.insp@exemplo.com", "Morador-Insp-2050");
        assertThat(login.getStatus()).isEqualTo(423);
        assertThat(body(login).path("detail").asString()).isEqualTo("Acesso bloqueado por 30 minutos por tentativa de inspeção do sistema.");
        assertThat(login.getHeader("Retry-After")).isNotNull();
        // senha errada continua sendo 401 (não revela o bloqueio a quem não sabe a senha)
        assertThat(new Client().tryLogin("morador.insp@exemplo.com", "Errada-Insp-2050").getStatus()).isEqualTo(401);
        // logout continua funcionando (o navegador limpa a sessão)
        assertThat(browser.send(post("/api/auth/logout")).getStatus()).isEqualTo(204);
        // todas as sessões foram revogadas
        assertThat(jdbc.queryForObject("select count(*) from refresh_tokens where user_id = ? and revoked_at is null",
                Long.class, userId)).isZero();

        // admin vê o motivo e desbloqueia
        Client admin = new Client().login("admin.insp@exemplo.com", "Admin-Insp-2050");
        JsonNode list = body(admin.send(get("/api/admin/users").param("q", "morador.insp")));
        JsonNode adminView = list.path("content").get(0);
        assertThat(adminView.path("locked").asBoolean()).isTrue();
        assertThat(adminView.path("lockReason").asString()).isEqualTo("INSPECTION");
        assertThat(adminView.path("securityWarnings").asInt()).isEqualTo(3);
        assertThat(adminView.path("lockedUntil").isNull()).isFalse();
        assertThat(browser.postJson("/api/admin/users/" + userId + "/unlock", Map.of()).getStatus()).isIn(401, 403);
        var unlocked = admin.postJson("/api/admin/users/" + userId + "/unlock", Map.of());
        assertThat(unlocked.getStatus()).as(unlocked.getContentAsString()).isEqualTo(200);
        assertThat(body(unlocked).path("locked").asBoolean()).isFalse();
        assertThat(body(unlocked).path("securityWarnings").asInt()).isZero();
        Client again = new Client().login("morador.insp@exemplo.com", "Morador-Insp-2050");
        assertThat(body(again.send(get("/api/auth/me"))).path("securityWarnings").asInt()).isZero();

        // bloqueio vencido: login liberado e avisos zerados
        jdbc.update("update users set security_warnings = 3, security_locked_until = now() - interval '1 second' where id = ?", userId);
        Client afterExpiry = new Client().login("morador.insp@exemplo.com", "Morador-Insp-2050");
        assertThat(body(afterExpiry.send(get("/api/auth/me"))).path("securityWarnings").asInt()).isZero();
        assertThat(jdbc.queryForObject("select security_warnings from users where id = ?", Integer.class, userId)).isZero();

        // trilha de auditoria registrou avisos, bloqueio e desbloqueio
        assertThat(jdbc.queryForObject("select count(*) from audit_log where entity_id = ? and action in "
                + "('SECURITY_INSPECTION_WARNING','SECURITY_INSPECTION_LOCK','USER_UNLOCKED','LOGIN_BLOCKED_INSPECTION')",
                Long.class, userId.toString())).isGreaterThanOrEqualTo(6);
    }

    /** Simula a passagem dos 5 s da janela de deduplicação. */
    private void expireDedupeWindow(UUID userId) {
        jdbc.update("update users set security_last_event_at = now() - interval '10 seconds' where id = ?", userId);
    }
}
