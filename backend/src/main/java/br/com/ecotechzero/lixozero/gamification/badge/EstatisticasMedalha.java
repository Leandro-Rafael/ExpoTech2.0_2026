package br.com.ecotechzero.lixozero.gamification.badge;

import br.com.ecotechzero.lixozero.category.CodigoCategoria;

import java.util.Map;

/**
 * Estatísticas do usuário usadas para avaliar as medalhas (calculadas a partir dos descartes aprovados).
 */
public record EstatisticasMedalha(long approvedCount, double totalKg, Map<CodigoCategoria, Double> kgByCategory,
                         int streakDays, long totalEarned, boolean hasSmartBin) {

    public double kg(CodigoCategoria code) {
        return kgByCategory.getOrDefault(code, 0.0);
    }
}
