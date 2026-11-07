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
public final class SegredosLocais {

    private static final Logger log = LoggerFactory.getLogger(SegredosLocais.class);
    static final int MIN_BYTES = 32;

    private SegredosLocais() {
    }

    public static byte[] carregarOuCriar(Path arquivo, String nomeVariavel) {
        try {
            if (Files.exists(arquivo)) {
                byte[] bytes = Base64.getDecoder().decode(Files.readString(arquivo).strip());
                if (bytes.length >= MIN_BYTES) {
                    return bytes;
                }
            }
            byte[] segredo = new byte[48];
            new SecureRandom().nextBytes(segredo);
            Files.createDirectories(arquivo.getParent());
            Files.writeString(arquivo, Base64.getEncoder().encodeToString(segredo));
            restringirPermissoes(arquivo);
            log.warn("{} não definido: segredo aleatório gerado em {} (use {} em produção)", nomeVariavel, arquivo, nomeVariavel);
            return segredo;
        } catch (IOException e) {
            throw new UncheckedIOException("Não foi possível ler/gravar o segredo local " + arquivo.getFileName(), e);
        }
    }

    /** Aceita Base64 (>= 32 bytes decodificados) ou texto puro. */
    public static byte[] decodificar(String valor) {
        try {
            byte[] decodificado = Base64.getDecoder().decode(valor);
            if (decodificado.length >= MIN_BYTES) {
                return decodificado;
            }
        } catch (IllegalArgumentException ignored) {
            // não é Base64: usa o texto puro
        }
        return valor.getBytes(java.nio.charset.StandardCharsets.UTF_8);
    }

    private static void restringirPermissoes(Path arquivo) {
        try {
            if (Files.getFileStore(arquivo).supportsFileAttributeView("posix")) {
                Files.setPosixFilePermissions(arquivo, PosixFilePermissions.fromString("rw-------")); // chmod 600
                return;
            }
        } catch (IOException | UnsupportedOperationException ignored) {
            // segue para o modo genérico abaixo
        }
        try {
            arquivo.toFile().setReadable(false, false);
            arquivo.toFile().setReadable(true, true);
            arquivo.toFile().setWritable(false, false);
            arquivo.toFile().setWritable(true, true);
        } catch (SecurityException ignored) {
            // melhor esforço (Windows ignora parte das permissões POSIX)
        }
    }
}
