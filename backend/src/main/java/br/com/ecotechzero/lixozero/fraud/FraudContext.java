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
 * @param photo metadados da foto (ou null se o descarte não tem foto)
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
        CategoryCode aiSuggestedCode,
        Double aiConfidence,
        AiSource aiSource,
        Instant now,
        ZoneId zone) {

    public boolean hasLocation() {
        return latitude != null && longitude != null;
    }
}
