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

    private final ImpactService impact;
    private final TokenBucketRateLimiter limiter;
    private final AppProperties props;
    private final Clock clock;

    public ImpactController(ImpactService impact, TokenBucketRateLimiter limiter, AppProperties props, Clock clock) {
        this.impact = impact;
        this.limiter = limiter;
        this.props = props;
        this.clock = clock;
    }

    /** Público (landing page). */
    @GetMapping("/api/public/stats")
    public PublicStats publicStats() {
        return impact.publicStats();
    }

    @GetMapping("/api/impact/summary")
    public ImpactSummary summary(@AuthenticationPrincipal AuthUser me,
                                 @RequestParam(defaultValue = "COMMUNITY") Scope scope,
                                 @RequestParam(defaultValue = "12") int months) {
        return impact.summary(me.id(), scope, months);
    }

    @PostMapping("/api/impact/simulate")
    public SimulationResult simulate(@Valid @RequestBody SimulationInput input) {
        limiter.check(TokenBucketRateLimiter.Policy.SIMULATION_IP, RequestContext.currentIp());
        return ScenarioSimulator.simulate(input, LocalDate.now(clock.withZone(props.zoneId())).getYear());
    }
}
