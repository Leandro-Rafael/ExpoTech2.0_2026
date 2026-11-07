package br.com.ecotechzero.lixozero.iot;

import br.com.ecotechzero.lixozero.config.PropriedadesApp;
import br.com.ecotechzero.lixozero.household.SmartBin;
import br.com.ecotechzero.lixozero.household.RepositorioLixeiras;
import br.com.ecotechzero.lixozero.household.ServicoLixeiras;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;

/**
 * Simulador de sensores para a demonstração (APP_IOT_SIMULATOR=true): a cada intervalo, as lixeiras
 * marcadas como "simuladas" enchem um pouco e a bateria descarrega devagar. As leituras passam pelo
 * MESMO fluxo de um dispositivo real, inclusive a abertura automática de solicitação de coleta.
 */
@Component
public class SimuladorIot {

    private static final Logger log = LoggerFactory.getLogger(SimuladorIot.class);

    private final RepositorioLixeiras lixeiras;
    private final ServicoLixeiras servicoLixeiras;
    private final PropriedadesApp propriedades;
    private final Clock relogio;

    public SimuladorIot(RepositorioLixeiras lixeiras, ServicoLixeiras servicoLixeiras, PropriedadesApp propriedades, Clock relogio) {
        this.lixeiras = lixeiras;
        this.servicoLixeiras = servicoLixeiras;
        this.propriedades = propriedades;
        this.relogio = relogio;
    }

    @Scheduled(initialDelayString = "${app.iot.simulator-interval}", fixedDelayString = "${app.iot.simulator-interval}")
    public void simularLeituras() {
        if (!propriedades.iot().simulator()) {
            return;
        }
        ThreadLocalRandom aleatorio = ThreadLocalRandom.current();
        for (UUID id : lixeiras.findSimulatedIds()) {
            try {
                SmartBin lixeira = lixeiras.findById(id).orElse(null);
                if (lixeira == null || lixeira.getFillLevel() >= 100) {
                    continue;
                }
                int nivel = Math.min(100, lixeira.getFillLevel() + aleatorio.nextInt(0, 4));
                int bateria = lixeira.getBatteryLevel() <= 8 ? 100 : lixeira.getBatteryLevel() - (aleatorio.nextInt(10) == 0 ? 1 : 0);
                servicoLixeiras.registrarLeitura(id, nivel, bateria, relogio.instant());
            } catch (RuntimeException e) {
                log.warn("Simulador IoT: falha ao atualizar lixeira {}: {}", id, e.toString());
            }
        }
    }
}
