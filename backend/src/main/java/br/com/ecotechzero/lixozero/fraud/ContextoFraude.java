package br.com.ecotechzero.lixozero.fraud;

import br.com.ecotechzero.lixozero.ai.OrigemIa;
import br.com.ecotechzero.lixozero.category.CodigoCategoria;
import br.com.ecotechzero.lixozero.photo.PhotoMeta;

import java.time.Instant;
import java.time.ZoneId;
import java.util.UUID;

/**
 * Dados do descarte sendo avaliado pelas regras antifraude.
 *
 * @param photo          metadados da foto (ou null se o descarte não tem foto)
 * @param serverAiCode   classificação feita pelo SERVIDOR sobre a foto (confiável) ou null
 * @param clientAiCode   palpite enviado pelo navegador (não confiável: só pode aumentar o risco)
 */
public record ContextoFraude(
        UUID userId,
        CodigoCategoria categoryCode,
        double categoryMaxKg,
        double quantityKg,
        PhotoMeta photo,
        Double latitude,
        Double longitude,
        Instant disposedAt,
        CodigoCategoria serverAiCode,
        Double serverAiConfidence,
        CodigoCategoria clientAiCode,
        Double clientAiConfidence,
        OrigemIa clientAiSource,
        Instant now,
        ZoneId zone) {

    public boolean temLocalizacao() {
        return latitude != null && longitude != null;
    }
}
