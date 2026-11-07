package br.com.ecotechzero.lixozero.gamification;

import br.com.ecotechzero.lixozero.gamification.DtosGamificacao.GamificationSummary;
import br.com.ecotechzero.lixozero.gamification.DtosGamificacao.Ranking;
import br.com.ecotechzero.lixozero.gamification.DtosGamificacao.RankingPeriod;
import br.com.ecotechzero.lixozero.gamification.DtosGamificacao.RankingScope;
import br.com.ecotechzero.lixozero.security.UsuarioAutenticado;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Endpoints da tela "Meu progresso" (nível, medalhas, desafios) e do ranking. */
@RestController
public class ControladorGamificacao {

    private final ServicoGamificacao gamificacao;
    private final ServicoRanking classificacao;

    public ControladorGamificacao(ServicoGamificacao gamificacao, ServicoRanking classificacao) {
        this.gamificacao = gamificacao;
        this.classificacao = classificacao;
    }

    @GetMapping("/api/gamification/summary")
    public GamificationSummary resumo(@AuthenticationPrincipal UsuarioAutenticado logado) {
        return gamificacao.resumo(logado.id());
    }

    @GetMapping("/api/ranking")
    public Ranking classificacao(@AuthenticationPrincipal UsuarioAutenticado logado,
                           @RequestParam(defaultValue = "USER") RankingScope scope,
                           @RequestParam(defaultValue = "MONTH") RankingPeriod period) {
        return classificacao.classificacao(logado.id(), scope, period);
    }
}
