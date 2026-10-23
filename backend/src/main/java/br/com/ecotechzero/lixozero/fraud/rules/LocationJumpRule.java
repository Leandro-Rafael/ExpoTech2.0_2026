package br.com.ecotechzero.lixozero.fraud.rules;

import br.com.ecotechzero.lixozero.common.GeoPoint;
import br.com.ecotechzero.lixozero.disposal.Disposal;
import br.com.ecotechzero.lixozero.disposal.DisposalRepository;
import br.com.ecotechzero.lixozero.fraud.FraudContext;
import br.com.ecotechzero.lixozero.fraud.FraudRule;
import br.com.ecotechzero.lixozero.fraud.FraudSignal;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.Optional;

/**
 * Deslocamento impossível: compara a localização com o descarte anterior do mesmo usuário.
 * Se a velocidade necessária para ir de um ponto ao outro passa de 120 km/h (e a distância
 * é maior que 10 km), a localização provavelmente foi falsificada.
 */
@Component
public class LocationJumpRule implements FraudRule {

    static final double MAX_SPEED_KMH = 120;
    static final double MIN_DISTANCE_KM = 10;
    static final int SCORE = 30;

    private final DisposalRepository disposals;

    public LocationJumpRule(DisposalRepository disposals) {
        this.disposals = disposals;
    }

    @Override
    public String code() {
        return "DESLOCAMENTO_IMPOSSIVEL";
    }

    @Override
    public Optional<FraudSignal> evaluate(FraudContext ctx) {
        if (!ctx.hasLocation()) {
            return Optional.empty();
        }
        return disposals.recentWithLocation(ctx.userId(), ctx.disposedAt().minus(Duration.ofHours(12)), PageRequest.of(0, 1))
                .stream()
                .findFirst()
                .flatMap(previous -> check(ctx, previous));
    }

    private Optional<FraudSignal> check(FraudContext ctx, Disposal previous) {
        double km = GeoPoint.haversineKm(previous.getLatitude(), previous.getLongitude(), ctx.latitude(), ctx.longitude());
        double hours = Math.abs(Duration.between(previous.getDisposedAt(), ctx.disposedAt()).toSeconds()) / 3600.0;
        double speed = km / Math.max(hours, 1.0 / 60); // mínimo de 1 minuto para evitar divisão por zero
        if (km > MIN_DISTANCE_KM && speed > MAX_SPEED_KMH) {
            return Optional.of(new FraudSignal(code(), SCORE,
                    String.format("Localização %.0f km distante do registro anterior em pouco tempo (%.0f km/h).", km, speed)));
        }
        return Optional.empty();
    }
}
