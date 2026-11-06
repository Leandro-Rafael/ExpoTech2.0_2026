package br.com.ecotechzero.lixozero.fraud;

import br.com.ecotechzero.lixozero.ai.AiSource;
import br.com.ecotechzero.lixozero.category.CategoryCode;
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
public record FraudContext(
        UUID userId,
        CategoryCode categoryCode,
        double categoryMaxKg,
        double quantityKg,
        PhotoMeta photo,
        Double latitude,
        Double longitude,
        Instant disposedAt,
        CategoryCode serverAiCode,
        Double serverAiConfidence,
        CategoryCode clientAiCode,
        Double clientAiConfidence,
        AiSource clientAiSource,
        Instant now,
        ZoneId zone) {

    public boolean temLocalizacao() {
        return latitude != null && longitude != null;
    }
}
