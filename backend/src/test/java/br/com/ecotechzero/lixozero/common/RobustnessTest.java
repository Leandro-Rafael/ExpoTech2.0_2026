package br.com.ecotechzero.lixozero.common;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Rate limiter com memória limitada e tratamento de erros sem vazamento (MockMvc standalone, sem Spring Boot). */
class RobustnessTest {

    @RestController
    static class DummyController {
        @GetMapping("/t/cookie")
        String cookie(@CookieValue("obrigatorio") String value) {
            return value;
        }

        @GetMapping("/t/number")
        int number(@RequestParam int n) {
            return n;
        }

        @PostMapping("/t/json")
        Map<String, Object> json(@RequestBody Map<String, Object> body) {
            return body;
        }

        @GetMapping("/t/boom")
        String boom() {
            throw new IllegalStateException("select * from users -- detalhe interno");
        }
    }

    private final MockMvc mvc = MockMvcBuilders.standaloneSetup(new DummyController())
            .setControllerAdvice(new GlobalExceptionHandler()).build();

    @Test
    void frameworkErrorsKeepTheirStatusAndNeverLeakDetails() throws Exception {
        // ausência de cookie obrigatório (ServletRequestBindingException) -> 400, não 500
        mvc.perform(get("/t/cookie")).andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON));
        mvc.perform(get("/t/number").param("n", "abc")).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
        mvc.perform(get("/t/number")).andExpect(status().isBadRequest());
        mvc.perform(put("/t/json")).andExpect(status().isMethodNotAllowed());
        mvc.perform(post("/t/json").contentType(MediaType.TEXT_PLAIN).content("x")).andExpect(status().isUnsupportedMediaType());
        mvc.perform(post("/t/json").contentType(MediaType.APPLICATION_JSON).content("{malformado")).andExpect(status().isBadRequest());

        String body = mvc.perform(get("/t/boom")).andExpect(status().isInternalServerError())
                .andReturn().getResponse().getContentAsString();
        assertThat(body).doesNotContain("select").doesNotContain("IllegalStateException").contains("INTERNAL_ERROR");
    }

    @Test
    void rateLimiterMemoryIsBoundedButStillLimits() {
        TokenBucketRateLimiter limiter = new TokenBucketRateLimiter();
        int attempts = TokenBucketRateLimiter.MAX_BUCKETS + 5_000;
        int allowed = 0;
        for (int i = 0; i < attempts; i++) {
            // e-mails inventados (cada um seria um balde novo)
            if (limiter.tryConsume(TokenBucketRateLimiter.Policy.LOGIN_EMAIL, "fake" + i + "@x.com").allowed()) {
                allowed++;
            }
        }
        assertThat(limiter.size()).isLessThanOrEqualTo(TokenBucketRateLimiter.MAX_BUCKETS + 1);
        // as chaves excedentes dividem um balde de 10 fichas: no máximo 10 delas passam
        assertThat(allowed).isLessThanOrEqualTo(TokenBucketRateLimiter.MAX_BUCKETS + 10);

        // uma chave conhecida continua com o próprio limite
        TokenBucketRateLimiter fresh = new TokenBucketRateLimiter();
        for (int i = 0; i < 10; i++) {
            assertThat(fresh.tryConsume(TokenBucketRateLimiter.Policy.LOGIN_EMAIL, "a@b.com").allowed()).isTrue();
        }
        var blocked = fresh.tryConsume(TokenBucketRateLimiter.Policy.LOGIN_EMAIL, "a@b.com");
        assertThat(blocked.allowed()).isFalse();
        assertThat(blocked.retryAfterSeconds()).isPositive();
    }
}
