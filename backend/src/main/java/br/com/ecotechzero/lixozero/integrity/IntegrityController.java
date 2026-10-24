package br.com.ecotechzero.lixozero.integrity;

import br.com.ecotechzero.lixozero.common.TokenBucketRateLimiter;
import br.com.ecotechzero.lixozero.security.AuthUser;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** Verificação de integridade dos dados (apenas ADMIN, pela regra /api/admin/** do SecurityConfig). */
@RestController
public class IntegrityController {

    private final IntegrityService service;
    private final TokenBucketRateLimiter limiter;

    public IntegrityController(IntegrityService service, TokenBucketRateLimiter limiter) {
        this.service = service;
        this.limiter = limiter;
    }

    @GetMapping("/api/admin/integrity")
    public ResponseEntity<IntegrityService.IntegrityReport> integrity(@AuthenticationPrincipal AuthUser me) {
        limiter.check(TokenBucketRateLimiter.Policy.INTEGRITY_CHECK_USER, me.id().toString());
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.verify());
    }
}
