package br.com.ecotechzero.lixozero.photo;

import br.com.ecotechzero.lixozero.ai.OrigemIa;
import br.com.ecotechzero.lixozero.category.CodigoCategoria;

import java.time.Instant;
import java.util.UUID;

/** Metadados de uma foto sem carregar os bytes da imagem. ai* = classificação feita pelo servidor no upload. */
public record PhotoMeta(UUID id, UUID ownerId, long dhash, String sha256, CodigoCategoria aiCode, Double aiConfidence,
                        OrigemIa aiSource, Instant createdAt) {

    /** O próprio servidor classificou a foto (o único resultado confiável para pontos e antifraude). */
    public boolean aiVerified() {
        return aiCode != null && aiConfidence != null && aiSource != null && aiSource.doServidor();
    }
}
