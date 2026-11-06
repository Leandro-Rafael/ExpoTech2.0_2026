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

    private final IntegrityService servico;
    private final TokenBucketRateLimiter limitador;

    public IntegrityController(IntegrityService servico, TokenBucketRateLimiter limitador) {
        this.servico = servico;
        this.limitador = limitador;
    }

    @GetMapping("/api/admin/integrity")
    public ResponseEntity<IntegrityService.IntegrityReport> integridade(@AuthenticationPrincipal AuthUser logado) {
        limitador.verificar(TokenBucketRateLimiter.Policy.INTEGRITY_CHECK_USER, logado.id().toString());
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(servico.verificar());
    }
}
