package br.com.ecotechzero.lixozero.integrity;

import br.com.ecotechzero.lixozero.config.PropriedadesApp;
import br.com.ecotechzero.lixozero.security.SegredosLocais;
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
public class ChaveIntegridade {

    private static final String ALGORITMO = "HmacSHA256";

    private final SecretKeySpec chave;

    public ChaveIntegridade(@Value("${app.integrity.key:}") String configurado, PropriedadesApp propriedades) {
        byte[] bytes;
        if (configurado != null && !configurado.isBlank()) {
            bytes = SegredosLocais.decodificar(configurado.strip());
            if (bytes.length < 32) {
                throw new IllegalStateException("APP_INTEGRITY_KEY deve ter pelo menos 32 bytes (256 bits).");
            }
        } else {
            bytes = SegredosLocais.carregarOuCriar(propriedades.dataPath().resolve("integrity.key"), "APP_INTEGRITY_KEY");
        }
        this.chave = new SecretKeySpec(bytes, ALGORITMO);
    }

    /** Instância nova de Mac (não é thread-safe): use uma por operação ou por varredura. */
    public Mac novoMac() {
        try {
            Mac mac = Mac.getInstance(ALGORITMO);
            mac.init(chave);
            return mac;
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("HMAC-SHA256 indisponível", e);
        }
    }

    public static String assinar(Mac mac, String canonico) {
        return HexFormat.of().formatHex(mac.doFinal(canonico.getBytes(StandardCharsets.UTF_8)));
    }

    /** Comparação em tempo constante. */
    public static boolean iguais(String a, String b) {
        return a != null && b != null
                && MessageDigest.isEqual(a.getBytes(StandardCharsets.US_ASCII), b.getBytes(StandardCharsets.US_ASCII));
    }
}
