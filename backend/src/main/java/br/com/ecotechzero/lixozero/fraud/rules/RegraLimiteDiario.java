package br.com.ecotechzero.lixozero.fraud.rules;

import br.com.ecotechzero.lixozero.common.Numeros;
import br.com.ecotechzero.lixozero.disposal.RepositorioDescartes;
import br.com.ecotechzero.lixozero.disposal.StatusDescarte;
import br.com.ecotechzero.lixozero.fraud.ContextoFraude;
import br.com.ecotechzero.lixozero.fraud.RegraFraude;
import br.com.ecotechzero.lixozero.fraud.SinalFraude;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Optional;

/** Limite diário: uma residência comum não descarta mais de 50 kg de recicláveis por dia. */
@Component
public class RegraLimiteDiario implements RegraFraude {

    public static final double DAILY_LIMIT_KG = 50;
    static final int SCORE = 35;

    private final RepositorioDescartes descartes;

    public RegraLimiteDiario(RepositorioDescartes descartes) {
        this.descartes = descartes;
    }

    @Override
    public String codigo() {
        return "LIMITE_DIARIO";
    }

    @Override
    public Optional<SinalFraude> avaliar(ContextoFraude contexto) {
        LocalDate dia = contexto.disposedAt().atZone(contexto.zone()).toLocalDate();
        Instant inicio = dia.atStartOfDay(contexto.zone()).toInstant();
        Instant fim = dia.plusDays(1).atStartOfDay(contexto.zone()).toInstant();
        double total = descartes.sumKgBetween(contexto.userId(), StatusDescarte.REJECTED, inicio, fim) + contexto.quantityKg();
        if (total > DAILY_LIMIT_KG) {
            return Optional.of(new SinalFraude(codigo(), SCORE,
                    "Total do dia (" + Numeros.arredondar(total, 1) + " kg) acima do limite de " + (int) DAILY_LIMIT_KG + " kg por usuário."));
        }
        return Optional.empty();
    }
}
