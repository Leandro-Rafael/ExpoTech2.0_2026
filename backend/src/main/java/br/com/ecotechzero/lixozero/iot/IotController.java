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

    private static final int TAMANHO_MAXIMO_CHAVE = 128;
    private static final String HASH_FICTICIO = SmartBinService.sha256("dispositivo-inexistente");

    private final SmartBinRepository lixeiras;
    private final SmartBinService servicoLixeiras;
    private final TokenBucketRateLimiter limitador;
    private final AuditService auditoria;
    private final Clock relogio;

    public IotController(SmartBinRepository lixeiras, SmartBinService servicoLixeiras, TokenBucketRateLimiter limitador,
                         AuditService auditoria, Clock relogio) {
        this.lixeiras = lixeiras;
        this.servicoLixeiras = servicoLixeiras;
        this.limitador = limitador;
        this.auditoria = auditoria;
        this.relogio = relogio;
    }

    @PostMapping("/api/iot/readings")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public void receberLeitura(@RequestHeader("X-Device-Id") String cabecalhoIdDispositivo,
                        @RequestHeader("X-Device-Key") String chaveDispositivo,
                        @Valid @RequestBody ReadingRequest corpo,
                        HttpServletRequest request) {
        limitador.verificar(TokenBucketRateLimiter.Policy.IOT_IP, RequestContext.ipCliente(request));
        if (chaveDispositivo.length() > TAMANHO_MAXIMO_CHAVE) {
            throw new ApiException(ErrorCode.UNAUTHORIZED, "Dispositivo não autorizado.");
        }
        UUID idDispositivo = converterId(cabecalhoIdDispositivo);
        limitador.verificar(TokenBucketRateLimiter.Policy.IOT_DEVICE, idDispositivo.toString());
        SmartBin lixeira = autenticar(idDispositivo, chaveDispositivo);
        servicoLixeiras.registrarLeitura(lixeira.getId(), (int) Math.round(corpo.fillLevel()), (int) Math.round(corpo.batteryLevel()), relogio.instant());
    }

    private SmartBin autenticar(UUID idDispositivo, String chaveDispositivo) {
        Optional<SmartBin> lixeira = lixeiras.findByDeviceId(idDispositivo);
        String esperado = lixeira.map(SmartBin::getDeviceKeyHash).orElse(HASH_FICTICIO);
        String informado = SmartBinService.sha256(chaveDispositivo == null ? "" : chaveDispositivo);
        boolean confere = MessageDigest.isEqual(esperado.getBytes(StandardCharsets.US_ASCII), informado.getBytes(StandardCharsets.US_ASCII));
        if (lixeira.isEmpty() || !confere) {
            auditoria.registrarComo(null, "dispositivo " + idDispositivo, AuditAction.IOT_AUTH_FAILED, "SmartBin", idDispositivo, null);
            throw new ApiException(ErrorCode.UNAUTHORIZED, "Dispositivo não autorizado.");
        }
        return lixeira.get();
    }

    private static UUID converterId(String valor) {
        try {
            return UUID.fromString(valor.strip());
        } catch (IllegalArgumentException e) {
            throw new ApiException(ErrorCode.UNAUTHORIZED, "Dispositivo não autorizado.");
        }
    }
}
