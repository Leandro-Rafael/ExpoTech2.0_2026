package br.com.ecotechzero.lixozero.iot;

import br.com.ecotechzero.lixozero.audit.AcaoAuditoria;
import br.com.ecotechzero.lixozero.audit.ServicoAuditoria;
import br.com.ecotechzero.lixozero.common.ExcecaoApi;
import br.com.ecotechzero.lixozero.common.CodigoErro;
import br.com.ecotechzero.lixozero.common.ContextoRequisicao;
import br.com.ecotechzero.lixozero.common.LimitadorDeTaxa;
import br.com.ecotechzero.lixozero.household.DtosResidencia.ReadingRequest;
import br.com.ecotechzero.lixozero.household.SmartBin;
import br.com.ecotechzero.lixozero.household.RepositorioLixeiras;
import br.com.ecotechzero.lixozero.household.ServicoLixeiras;
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
 * {@code FiltroLimiteCorpo}.
 */
@RestController
public class ControladorIot {

    private static final int TAMANHO_MAXIMO_CHAVE = 128;
    private static final String HASH_FICTICIO = ServicoLixeiras.sha256("dispositivo-inexistente");

    private final RepositorioLixeiras lixeiras;
    private final ServicoLixeiras servicoLixeiras;
    private final LimitadorDeTaxa limitador;
    private final ServicoAuditoria auditoria;
    private final Clock relogio;

    public ControladorIot(RepositorioLixeiras lixeiras, ServicoLixeiras servicoLixeiras, LimitadorDeTaxa limitador,
                         ServicoAuditoria auditoria, Clock relogio) {
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
        limitador.verificar(LimitadorDeTaxa.Policy.IOT_IP, ContextoRequisicao.ipCliente(request));
        if (chaveDispositivo.length() > TAMANHO_MAXIMO_CHAVE) {
            throw new ExcecaoApi(CodigoErro.UNAUTHORIZED, "Dispositivo não autorizado.");
        }
        UUID idDispositivo = converterId(cabecalhoIdDispositivo);
        limitador.verificar(LimitadorDeTaxa.Policy.IOT_DEVICE, idDispositivo.toString());
        SmartBin lixeira = autenticar(idDispositivo, chaveDispositivo);
        servicoLixeiras.registrarLeitura(lixeira.getId(), (int) Math.round(corpo.fillLevel()), (int) Math.round(corpo.batteryLevel()), relogio.instant());
    }

    private SmartBin autenticar(UUID idDispositivo, String chaveDispositivo) {
        Optional<SmartBin> lixeira = lixeiras.findByDeviceId(idDispositivo);
        String esperado = lixeira.map(SmartBin::getDeviceKeyHash).orElse(HASH_FICTICIO);
        String informado = ServicoLixeiras.sha256(chaveDispositivo == null ? "" : chaveDispositivo);
        boolean confere = MessageDigest.isEqual(esperado.getBytes(StandardCharsets.US_ASCII), informado.getBytes(StandardCharsets.US_ASCII));
        if (lixeira.isEmpty() || !confere) {
            auditoria.registrarComo(null, "dispositivo " + idDispositivo, AcaoAuditoria.IOT_AUTH_FAILED, "SmartBin", idDispositivo, null);
            throw new ExcecaoApi(CodigoErro.UNAUTHORIZED, "Dispositivo não autorizado.");
        }
        return lixeira.get();
    }

    private static UUID converterId(String valor) {
        try {
            return UUID.fromString(valor.strip());
        } catch (IllegalArgumentException e) {
            throw new ExcecaoApi(CodigoErro.UNAUTHORIZED, "Dispositivo não autorizado.");
        }
    }
}
