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

    private final DisposalRepository descartes;

    public LocationJumpRule(DisposalRepository descartes) {
        this.descartes = descartes;
    }

    @Override
    public String codigo() {
        return "DESLOCAMENTO_IMPOSSIVEL";
    }

    @Override
    public Optional<FraudSignal> avaliar(FraudContext contexto) {
        if (!contexto.temLocalizacao()) {
            return Optional.empty();
        }
        return descartes.recentWithLocation(contexto.userId(), contexto.disposedAt().minus(Duration.ofHours(12)), PageRequest.of(0, 1))
                .stream()
                .findFirst()
                .flatMap(anterior -> verificar(contexto, anterior));
    }

    private Optional<FraudSignal> verificar(FraudContext contexto, Disposal anterior) {
        double km = GeoPoint.haversineKm(anterior.getLatitude(), anterior.getLongitude(), contexto.latitude(), contexto.longitude());
        double horas = Math.abs(Duration.between(anterior.getDisposedAt(), contexto.disposedAt()).toSeconds()) / 3600.0;
        double velocidade = km / Math.max(horas, 1.0 / 60); // mínimo de 1 minuto para evitar divisão por zero
        if (km > MIN_DISTANCE_KM && velocidade > MAX_SPEED_KMH) {
            return Optional.of(new FraudSignal(codigo(), SCORE,
                    String.format("Localização %.0f km distante do registro anterior em pouco tempo (%.0f km/h).", km, velocidade)));
        }
        return Optional.empty();
    }
}
