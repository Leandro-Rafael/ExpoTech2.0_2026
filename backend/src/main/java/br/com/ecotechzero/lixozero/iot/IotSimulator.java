package br.com.ecotechzero.lixozero.iot;

import br.com.ecotechzero.lixozero.config.AppProperties;
import br.com.ecotechzero.lixozero.household.SmartBin;
import br.com.ecotechzero.lixozero.household.SmartBinRepository;
import br.com.ecotechzero.lixozero.household.SmartBinService;
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
public class IotSimulator {

    private static final Logger log = LoggerFactory.getLogger(IotSimulator.class);

    private final SmartBinRepository bins;
    private final SmartBinService smartBins;
    private final AppProperties props;
    private final Clock clock;

    public IotSimulator(SmartBinRepository bins, SmartBinService smartBins, AppProperties props, Clock clock) {
        this.bins = bins;
        this.smartBins = smartBins;
        this.props = props;
        this.clock = clock;
    }

    @Scheduled(initialDelayString = "${app.iot.simulator-interval}", fixedDelayString = "${app.iot.simulator-interval}")
    public void tick() {
        if (!props.iot().simulator()) {
            return;
        }
        ThreadLocalRandom random = ThreadLocalRandom.current();
        for (UUID id : bins.findSimulatedIds()) {
            try {
                SmartBin bin = bins.findById(id).orElse(null);
                if (bin == null || bin.getFillLevel() >= 100) {
                    continue;
                }
                int fill = Math.min(100, bin.getFillLevel() + random.nextInt(0, 4));
                int battery = bin.getBatteryLevel() <= 8 ? 100 : bin.getBatteryLevel() - (random.nextInt(10) == 0 ? 1 : 0);
                smartBins.recordReading(id, fill, battery, clock.instant());
            } catch (RuntimeException e) {
                log.warn("Simulador IoT: falha ao atualizar lixeira {}: {}", id, e.toString());
            }
        }
    }
}
