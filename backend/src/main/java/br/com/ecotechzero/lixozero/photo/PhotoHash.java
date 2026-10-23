package br.com.ecotechzero.lixozero.photo;

import java.util.UUID;

/** Projeção leve de uma foto (sem os bytes) para comparação de hashes perceptuais. */
public record PhotoHash(UUID id, long dhash, UUID ownerId) {
}
