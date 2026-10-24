package br.com.ecotechzero.lixozero.security;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.PosixFilePermissions;
import java.security.SecureRandom;
import java.util.Base64;

/**
 * Segredos locais de desenvolvimento (chave JWT, chave de integridade): quando a variável de ambiente
 * não é informada, um segredo aleatório de 384 bits é gerado e salvo em {@code data/} com permissão restrita,
 * para sobreviver a reinícios. Em produção use sempre as variáveis de ambiente.
 */
public final class LocalSecrets {

    private static final Logger log = LoggerFactory.getLogger(LocalSecrets.class);
    static final int MIN_BYTES = 32;

    private LocalSecrets() {
    }

    public static byte[] loadOrCreate(Path file, String envName) {
        try {
            if (Files.exists(file)) {
                byte[] bytes = Base64.getDecoder().decode(Files.readString(file).strip());
                if (bytes.length >= MIN_BYTES) {
                    return bytes;
                }
            }
            byte[] secret = new byte[48];
            new SecureRandom().nextBytes(secret);
            Files.createDirectories(file.getParent());
            Files.writeString(file, Base64.getEncoder().encodeToString(secret));
            restrictPermissions(file);
            log.warn("{} não definido: segredo aleatório gerado em {} (use {} em produção)", envName, file, envName);
            return secret;
        } catch (IOException e) {
            throw new UncheckedIOException("Não foi possível ler/gravar o segredo local " + file.getFileName(), e);
        }
    }

    /** Aceita Base64 (>= 32 bytes decodificados) ou texto puro. */
    public static byte[] decode(String value) {
        try {
            byte[] decoded = Base64.getDecoder().decode(value);
            if (decoded.length >= MIN_BYTES) {
                return decoded;
            }
        } catch (IllegalArgumentException ignored) {
            // não é Base64: usa o texto puro
        }
        return value.getBytes(java.nio.charset.StandardCharsets.UTF_8);
    }

    private static void restrictPermissions(Path file) {
        try {
            if (Files.getFileStore(file).supportsFileAttributeView("posix")) {
                Files.setPosixFilePermissions(file, PosixFilePermissions.fromString("rw-------")); // chmod 600
                return;
            }
        } catch (IOException | UnsupportedOperationException ignored) {
            // segue para o modo genérico abaixo
        }
        try {
            file.toFile().setReadable(false, false);
            file.toFile().setReadable(true, true);
            file.toFile().setWritable(false, false);
            file.toFile().setWritable(true, true);
        } catch (SecurityException ignored) {
            // melhor esforço (Windows ignora parte das permissões POSIX)
        }
    }
}
