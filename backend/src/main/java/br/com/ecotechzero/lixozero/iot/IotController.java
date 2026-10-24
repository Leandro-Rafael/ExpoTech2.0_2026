package br.com.ecotechzero.lixozero.iot;

import br.com.ecotechzero.lixozero.audit.AuditAction;
import br.com.ecotechzero.lixozero.audit.AuditService;
import br.com.ecotechzero.lixozero.common.ApiException;
import br.com.ecotechzero.lixozero.common.ErrorCode;
import br.com.ecotechzero.lixozero.common.RequestContext;
import br.com.ecotechzero.lixozero.common.TokenBucketRateLimiter;
import br.com.ecotechzero.lixozero.household.HouseholdDtos.ReadingRequest;
import br.com.ecotechzero.lixozero.household.SmartBin;
import br.com.ecotechzero.lixozero.household.SmartBinRepository;
import br.com.ecotechzero.lixozero.household.SmartBinService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Clock;
import java.util.Optional;
import java.util.UUID;

/**
 * Endpoint para dispositivos IoT reais (ESP32 etc.). Sem cookies e sem CSRF: o dispositivo se autentica
 * com os headers X-Device-Id e X-Device-Key. A chave é comparada pelo hash em TEMPO CONSTANTE
 * ({@link MessageDigest#isEqual}), evitando ataques de temporização.
 * <p>
 * Limites: por IP (antes de autenticar, para que tentativas com ids inventados não inundem o log de
 * auditoria) e por dispositivo. O corpo é validado (0 a 100) e o tamanho total limitado pelo
 * {@code RequestBodyLimitFilter}.
 */
@RestController
public class IotController {

    private static final int MAX_KEY_LENGTH = 128;
    private static final String DUMMY_HASH = SmartBinService.sha256("dispositivo-inexistente");

    private final SmartBinRepository bins;
    private final SmartBinService smartBins;
    private final TokenBucketRateLimiter limiter;
    private final AuditService audit;
    private final Clock clock;

    public IotController(SmartBinRepository bins, SmartBinService smartBins, TokenBucketRateLimiter limiter,
                         AuditService audit, Clock clock) {
        this.bins = bins;
        this.smartBins = smartBins;
        this.limiter = limiter;
        this.audit = audit;
        this.clock = clock;
    }

    @PostMapping("/api/iot/readings")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public void reading(@RequestHeader("X-Device-Id") String deviceIdHeader,
                        @RequestHeader("X-Device-Key") String deviceKey,
                        @Valid @RequestBody ReadingRequest body,
                        HttpServletRequest request) {
        limiter.check(TokenBucketRateLimiter.Policy.IOT_IP, RequestContext.clientIp(request));
        if (deviceKey.length() > MAX_KEY_LENGTH) {
            throw new ApiException(ErrorCode.UNAUTHORIZED, "Dispositivo não autorizado.");
        }
        UUID deviceId = parse(deviceIdHeader);
        limiter.check(TokenBucketRateLimiter.Policy.IOT_DEVICE, deviceId.toString());
        SmartBin bin = authenticate(deviceId, deviceKey);
        smartBins.recordReading(bin.getId(), (int) Math.round(body.fillLevel()), (int) Math.round(body.batteryLevel()), clock.instant());
    }

    private SmartBin authenticate(UUID deviceId, String deviceKey) {
        Optional<SmartBin> bin = bins.findByDeviceId(deviceId);
        String expected = bin.map(SmartBin::getDeviceKeyHash).orElse(DUMMY_HASH);
        String provided = SmartBinService.sha256(deviceKey == null ? "" : deviceKey);
        boolean match = MessageDigest.isEqual(expected.getBytes(StandardCharsets.US_ASCII), provided.getBytes(StandardCharsets.US_ASCII));
        if (bin.isEmpty() || !match) {
            audit.recordAs(null, "dispositivo " + deviceId, AuditAction.IOT_AUTH_FAILED, "SmartBin", deviceId, null);
            throw new ApiException(ErrorCode.UNAUTHORIZED, "Dispositivo não autorizado.");
        }
        return bin.get();
    }

    private static UUID parse(String value) {
        try {
            return UUID.fromString(value.strip());
        } catch (IllegalArgumentException e) {
            throw new ApiException(ErrorCode.UNAUTHORIZED, "Dispositivo não autorizado.");
        }
    }
}
