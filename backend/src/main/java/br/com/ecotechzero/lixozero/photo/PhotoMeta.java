package br.com.ecotechzero.lixozero.photo;

import br.com.ecotechzero.lixozero.ai.AiSource;
import br.com.ecotechzero.lixozero.category.CategoryCode;

import java.util.UUID;

/** Metadados de uma foto sem carregar os bytes da imagem. */
public record PhotoMeta(UUID id, UUID ownerId, long dhash, String sha256, CategoryCode aiCode, Double aiConfidence, AiSource aiSource) {
}
