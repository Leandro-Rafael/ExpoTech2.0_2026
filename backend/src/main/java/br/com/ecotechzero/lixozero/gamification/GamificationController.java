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

@RestController
public class GamificationController {

    private final GamificationService gamification;
    private final RankingService ranking;

    public GamificationController(GamificationService gamification, RankingService ranking) {
        this.gamification = gamification;
        this.ranking = ranking;
    }

    @GetMapping("/api/gamification/summary")
    public GamificationSummary summary(@AuthenticationPrincipal AuthUser me) {
        return gamification.summary(me.id());
    }

    @GetMapping("/api/ranking")
    public Ranking ranking(@AuthenticationPrincipal AuthUser me,
                           @RequestParam(defaultValue = "USER") RankingScope scope,
                           @RequestParam(defaultValue = "MONTH") RankingPeriod period) {
        return ranking.ranking(me.id(), scope, period);
    }
}
