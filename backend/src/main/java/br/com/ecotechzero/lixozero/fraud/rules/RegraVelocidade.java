package br.com.ecotechzero.lixozero.fraud.rules;

import br.com.ecotechzero.lixozero.disposal.RepositorioDescartes;
import br.com.ecotechzero.lixozero.fraud.ContextoFraude;
import br.com.ecotechzero.lixozero.fraud.RegraFraude;
import br.com.ecotechzero.lixozero.fraud.SinalFraude;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.Optional;

/** Rajada de registros: 4 ou mais descartes nos últimos 10 minutos indicam automação ou abuso. */
@Component
public class RegraVelocidade implements RegraFraude {

    static final int MAX_IN_WINDOW = 4;
    static final Duration WINDOW = Duration.ofMinutes(10);
    static final int SCORE = 30;

    private final RepositorioDescartes descartes;

    public RegraVelocidade(RepositorioDescartes descartes) {
        this.descartes = descartes;
    }

    @Override
    public String codigo() {
        return "MUITOS_REGISTROS";
    }

    @Override
    public Optional<SinalFraude> avaliar(ContextoFraude contexto) {
        long recentes = descartes.countByUserIdAndCreatedAtAfter(contexto.userId(), contexto.now().minus(WINDOW));
        if (recentes >= MAX_IN_WINDOW) {
            return Optional.of(new SinalFraude(codigo(), SCORE,
                    "Muitos registros em pouco tempo (" + (recentes + 1) + " em " + WINDOW.toMinutes() + " minutos)."));
        }
        return Optional.empty();
    }
}
