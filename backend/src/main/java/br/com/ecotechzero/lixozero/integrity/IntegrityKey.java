package br.com.ecotechzero.lixozero.integrity;

import br.com.ecotechzero.lixozero.config.AppProperties;
import br.com.ecotechzero.lixozero.security.LocalSecrets;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.nio.charset.StandardCharsets;
import java.util.HexFormat;

/**
 * Chave HMAC-SHA256 da cadeia de integridade (extrato de pontos e auditoria).
 * <p>
 * Vem de APP_INTEGRITY_KEY (>= 32 bytes, Base64 ou texto). Sem ela, uma chave aleatória é gerada e salva em
 * {@code data/integrity.key}. A chave fica FORA do banco: quem altera uma linha direto no SQL não consegue
 * recalcular o hash, e a verificação aponta a linha adulterada.
 */
@Component
public class IntegrityKey {

    private static final String ALGORITHM = "HmacSHA256";

    private final SecretKeySpec key;

    public IntegrityKey(@Value("${app.integrity.key:}") String configured, AppProperties props) {
        byte[] bytes;
        if (configured != null && !configured.isBlank()) {
            bytes = LocalSecrets.decode(configured.strip());
            if (bytes.length < 32) {
                throw new IllegalStateException("APP_INTEGRITY_KEY deve ter pelo menos 32 bytes (256 bits).");
            }
        } else {
            bytes = LocalSecrets.loadOrCreate(props.dataPath().resolve("integrity.key"), "APP_INTEGRITY_KEY");
        }
        this.key = new SecretKeySpec(bytes, ALGORITHM);
    }

    /** Instância nova de Mac (não é thread-safe): use uma por operação ou por varredura. */
    public Mac newMac() {
        try {
            Mac mac = Mac.getInstance(ALGORITHM);
            mac.init(key);
            return mac;
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("HMAC-SHA256 indisponível", e);
        }
    }

    public static String sign(Mac mac, String canonical) {
        return HexFormat.of().formatHex(mac.doFinal(canonical.getBytes(StandardCharsets.UTF_8)));
    }

    /** Comparação em tempo constante. */
    public static boolean same(String a, String b) {
        return a != null && b != null
                && MessageDigest.isEqual(a.getBytes(StandardCharsets.US_ASCII), b.getBytes(StandardCharsets.US_ASCII));
    }
}
