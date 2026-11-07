package br.com.ecotechzero.lixozero.impact;

import br.com.ecotechzero.lixozero.common.ContextoRequisicao;
import br.com.ecotechzero.lixozero.common.LimitadorDeTaxa;
import br.com.ecotechzero.lixozero.config.PropriedadesApp;
import br.com.ecotechzero.lixozero.impact.DtosImpacto.ImpactSummary;
import br.com.ecotechzero.lixozero.impact.DtosImpacto.PublicStats;
import br.com.ecotechzero.lixozero.impact.DtosImpacto.Scope;
import br.com.ecotechzero.lixozero.impact.DtosImpacto.SimulationInput;
import br.com.ecotechzero.lixozero.impact.DtosImpacto.SimulationResult;
import br.com.ecotechzero.lixozero.security.UsuarioAutenticado;
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
public class ControladorImpacto {

    private final ServicoImpacto impacto;
    private final LimitadorDeTaxa limitador;
    private final PropriedadesApp propriedades;
    private final Clock relogio;

    public ControladorImpacto(ServicoImpacto impacto, LimitadorDeTaxa limitador, PropriedadesApp propriedades, Clock relogio) {
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
    public ImpactSummary resumo(@AuthenticationPrincipal UsuarioAutenticado logado,
                                 @RequestParam(defaultValue = "COMMUNITY") Scope scope,
                                 @RequestParam(defaultValue = "12") int months) {
        return impacto.resumo(logado.id(), scope, months);
    }

    @PostMapping("/api/impact/simulate")
    public SimulationResult simular(@Valid @RequestBody SimulationInput entrada) {
        limitador.verificar(LimitadorDeTaxa.Policy.SIMULATION_IP, ContextoRequisicao.ipAtual());
        return SimuladorCenarios.simular(entrada, LocalDate.now(relogio.withZone(propriedades.zoneId())).getYear());
    }
}
