package br.com.ecotechzero.lixozero.collection;

import br.com.ecotechzero.lixozero.category.CategoryCode;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Set;

/**
 * Prioridade (0 a 100) de uma solicitação de coleta, calculada no momento da consulta:
 * <ul>
 *   <li>base de 20 pontos;</li>
 *   <li>volume: até +30 (proporcional ao peso estimado, teto em 100 kg);</li>
 *   <li>tempo de espera: +5 por dia, até +25;</li>
 *   <li>resíduo eletrônico (perigoso): +15;</li>
 *   <li>lixeira inteligente: até +25 conforme o nível de enchimento acima de 50%;</li>
 *   <li>data preferida já chegou: +10.</li>
 * </ul>
 */
public final class PriorityCalculator {

    private PriorityCalculator() {
    }

    public static int priority(double estimatedKg, Instant createdAt, Set<CategoryCode> categories,
                               Integer binFillLevel, LocalDate preferredDate, Instant now, LocalDate today) {
        double score = 20;
        score += Math.min(30, Math.max(0, estimatedKg) / 100.0 * 30);
        long ageDays = createdAt == null ? 0 : Math.max(0, Duration.between(createdAt, now).toDays());
        score += Math.min(25, ageDays * 5);
        if (categories.contains(CategoryCode.ELETRONICO)) {
            score += 15;
        }
        if (binFillLevel != null) {
            score += Math.clamp((binFillLevel - 50) / 2.0, 0, 25);
        }
        if (preferredDate != null && !preferredDate.isAfter(today)) {
            score += 10;
        }
        return (int) Math.round(Math.clamp(score, 0, 100));
    }
}
