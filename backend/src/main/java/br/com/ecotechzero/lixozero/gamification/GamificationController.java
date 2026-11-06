package br.com.ecotechzero.lixozero.gamification;

import br.com.ecotechzero.lixozero.gamification.GamificationDtos.GamificationSummary;
import br.com.ecotechzero.lixozero.gamification.GamificationDtos.Ranking;
import br.com.ecotechzero.lixozero.gamification.GamificationDtos.RankingPeriod;
import br.com.ecotechzero.lixozero.gamification.GamificationDtos.RankingScope;
import br.com.ecotechzero.lixozero.security.AuthUser;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Endpoints da tela "Meu progresso" (nível, medalhas, desafios) e do ranking. */
@RestController
public class GamificationController {

    private final GamificationService gamificacao;
    private final RankingService classificacao;

    public GamificationController(GamificationService gamificacao, RankingService classificacao) {
        this.gamificacao = gamificacao;
        this.classificacao = classificacao;
    }

    @GetMapping("/api/gamification/summary")
    public GamificationSummary resumo(@AuthenticationPrincipal AuthUser logado) {
        return gamificacao.resumo(logado.id());
    }

    @GetMapping("/api/ranking")
    public Ranking classificacao(@AuthenticationPrincipal AuthUser logado,
                           @RequestParam(defaultValue = "USER") RankingScope scope,
                           @RequestParam(defaultValue = "MONTH") RankingPeriod period) {
        return classificacao.classificacao(logado.id(), scope, period);
    }
}
