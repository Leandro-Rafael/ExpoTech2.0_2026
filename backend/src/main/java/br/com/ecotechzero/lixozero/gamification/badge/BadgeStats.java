package br.com.ecotechzero.lixozero.gamification.badge;

import br.com.ecotechzero.lixozero.category.CategoryCode;

import java.util.Map;

/**
 * Estatísticas do usuário usadas para avaliar as medalhas (calculadas a partir dos descartes aprovados).
 */
public record BadgeStats(long approvedCount, double totalKg, Map<CategoryCode, Double> kgByCategory,
                         int streakDays, long totalEarned, boolean hasSmartBin) {

    public double kg(CategoryCode code) {
        return kgByCategory.getOrDefault(code, 0.0);
    }
}
