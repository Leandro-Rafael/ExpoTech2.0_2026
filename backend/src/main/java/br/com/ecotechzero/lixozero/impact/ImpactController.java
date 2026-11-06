package br.com.ecotechzero.lixozero.impact;

import br.com.ecotechzero.lixozero.common.RequestContext;
import br.com.ecotechzero.lixozero.common.TokenBucketRateLimiter;
import br.com.ecotechzero.lixozero.config.AppProperties;
import br.com.ecotechzero.lixozero.impact.ImpactDtos.ImpactSummary;
import br.com.ecotechzero.lixozero.impact.ImpactDtos.PublicStats;
import br.com.ecotechzero.lixozero.impact.ImpactDtos.Scope;
import br.com.ecotechzero.lixozero.impact.ImpactDtos.SimulationInput;
import br.com.ecotechzero.lixozero.impact.ImpactDtos.SimulationResult;
import br.com.ecotechzero.lixozero.security.AuthUser;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Clock;
import java.time.LocalDate;

/** Endpoints de impacto: números públicos, resumo de impacto e simulador de 2050. */
@RestController
public class ImpactController {

    private final ImpactService impacto;
    private final TokenBucketRateLimiter limitador;
    private final AppProperties propriedades;
    private final Clock relogio;

    public ImpactController(ImpactService impacto, TokenBucketRateLimiter limitador, AppProperties propriedades, Clock relogio) {
        this.impacto = impacto;
        this.limitador = limitador;
        this.propriedades = propriedades;
        this.relogio = relogio;
    }

    /** Público (landing page). */
    @GetMapping("/api/public/stats")
    public PublicStats estatisticasPublicas() {
        return impacto.estatisticasPublicas();
    }

    @GetMapping("/api/impact/summary")
    public ImpactSummary resumo(@AuthenticationPrincipal AuthUser logado,
                                 @RequestParam(defaultValue = "COMMUNITY") Scope scope,
                                 @RequestParam(defaultValue = "12") int months) {
        return impacto.resumo(logado.id(), scope, months);
    }

    @PostMapping("/api/impact/simulate")
    public SimulationResult simular(@Valid @RequestBody SimulationInput entrada) {
        limitador.verificar(TokenBucketRateLimiter.Policy.SIMULATION_IP, RequestContext.ipAtual());
        return ScenarioSimulator.simular(entrada, LocalDate.now(relogio.withZone(propriedades.zoneId())).getYear());
    }
}
