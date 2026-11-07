package br.com.ecotechzero.lixozero.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.nio.file.Path;
import java.time.Duration;
import java.time.ZoneId;
import java.util.Arrays;
import java.util.List;

/**
 * Configurações da aplicação (prefixo "app" no application.yml), preenchidas por variáveis de ambiente.
 */
@ConfigurationProperties("app")
public record PropriedadesApp(
        String dataDir,
        String zone,
        Jwt jwt,
        Cookies cookies,
        String corsOrigins,
        EmbeddedDb embeddedDb,
        boolean demoSeed,
        boolean autoApprove,
        int fraudThreshold,
        Iot iot,
        Ai ai) {

    public record Jwt(String secret, Duration accessTtl, Duration refreshTtl, Duration refreshGrace) {
        @Override
        public String toString() {
            return "Jwt[secret=***, accessTtl=" + accessTtl + ", refreshTtl=" + refreshTtl + "]";
        }
    }

    /** secure: "auto" (Secure apenas em HTTPS), "true" ou "false". */
    public record Cookies(String secure) {
    }

    public record EmbeddedDb(int port, boolean clean) {
    }

    public record Iot(boolean simulator, Duration simulatorInterval, int offlineHours) {
    }

    public record Ai(String apiKey, String model, String baseUrl, String apiVersion, Duration timeout) {
        public boolean enabled() {
            return apiKey != null && !apiKey.isBlank();
        }

        @Override
        public String toString() {
            return "Ai[apiKey=" + (enabled() ? "***" : "<vazio>") + ", model=" + model + "]";
        }
    }

    public ZoneId zoneId() {
        return ZoneId.of(zone);
    }

    public Path dataPath() {
        return Path.of(dataDir).toAbsolutePath().normalize();
    }

    public List<String> corsOriginList() {
        if (corsOrigins == null || corsOrigins.isBlank()) {
            return List.of();
        }
        return Arrays.stream(corsOrigins.split(",")).map(String::strip).filter(s -> !s.isEmpty()).toList();
    }
}
