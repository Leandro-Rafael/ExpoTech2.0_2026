package br.com.ecotechzero.lixozero.gamification.badge;

import br.com.ecotechzero.lixozero.category.CategoryCode;
import br.com.ecotechzero.lixozero.gamification.badge.BadgeRule.Tier;

import java.util.Arrays;
import java.util.List;
import java.util.function.Predicate;

/**
 * Catálogo de medalhas. Três estratégias reutilizáveis implementam {@link BadgeRule}:
 * {@link ThresholdBadge} (uma métrica atinge um valor), {@link CategoryKgBadge} (kg de uma categoria)
 * e {@link AllRecyclablesBadge} (reciclou todas as categorias recicláveis).
 */
public final class BadgeCatalog {

    private BadgeCatalog() {
    }

    public static final List<BadgeRule> TODAS = List.of(
            new ThresholdBadge("PRIMEIRO_DESCARTE", "Primeiro passo", "Teve o primeiro descarte aprovado.", "footprints", Tier.BRONZE,
                    s -> s.approvedCount() >= 1),
            new ThresholdBadge("DEZ_DESCARTES", "Reciclador dedicado", "10 descartes aprovados.", "recycle", Tier.PRATA,
                    s -> s.approvedCount() >= 10),
            new ThresholdBadge("CINQUENTA_DESCARTES", "Hábito sustentável", "50 descartes aprovados.", "repeat", Tier.OURO,
                    s -> s.approvedCount() >= 50),
            new ThresholdBadge("CEM_KG", "100 kg fora do aterro", "100 kg de resíduos destinados corretamente.", "scale", Tier.OURO,
                    s -> s.totalKg() >= 100),
            new CategoryKgBadge("MESTRE_PLASTICO", "Mestre do plástico", "25 kg de plástico reciclados.", "milk", Tier.PRATA,
                    CategoryCode.PLASTICO, 25),
            new CategoryKgBadge("AMIGO_DO_PAPEL", "Amigo das árvores", "30 kg de papel reciclados.", "newspaper", Tier.PRATA,
                    CategoryCode.PAPEL, 30),
            new CategoryKgBadge("E_LIXO_CONSCIENTE", "E-lixo consciente", "Descartou eletrônicos corretamente.", "cpu", Tier.BRONZE,
                    CategoryCode.ELETRONICO, 0.01),
            new CategoryKgBadge("COMPOSTEIRO", "Composteiro", "20 kg de orgânicos compostados.", "sprout", Tier.PRATA,
                    CategoryCode.ORGANICO, 20),
            new AllRecyclablesBadge(),
            new ThresholdBadge("SEQUENCIA_7", "Uma semana verde", "7 dias seguidos com descarte aprovado.", "flame", Tier.PRATA,
                    s -> s.streakDays() >= 7),
            new ThresholdBadge("CASA_INTELIGENTE", "Casa 2050", "Tem uma lixeira inteligente conectada.", "house-wifi", Tier.BRONZE,
                    BadgeStats::hasSmartBin),
            new ThresholdBadge("GUARDIAO_2050", "Guardião 2050", "Alcançou 8.000 pontos acumulados.", "shield-check", Tier.DIAMANTE,
                    s -> s.totalEarned() >= 8_000));

    /** Medalha baseada em um predicado sobre as estatísticas. */
    record ThresholdBadge(String code, String name, String description, String icon, Tier tier,
                          Predicate<BadgeStats> condition) implements BadgeRule {
        @Override
        public boolean isEarned(BadgeStats estatisticas) {
            return condition.test(estatisticas);
        }
    }

    /** Medalha por quantidade reciclada de uma categoria específica. */
    record CategoryKgBadge(String code, String name, String description, String icon, Tier tier,
                           CategoryCode category, double minKg) implements BadgeRule {
        @Override
        public boolean isEarned(BadgeStats estatisticas) {
            return estatisticas.kg(category) >= minKg;
        }
    }

    /** Medalha para quem reciclou pelo menos 1 kg de cada categoria reciclável. */
    record AllRecyclablesBadge() implements BadgeRule {
        @Override public String code() { return "ARCO_IRIS"; }
        @Override public String name() { return "Arco-íris da reciclagem"; }
        @Override public String description() { return "Reciclou ao menos 1 kg de cada categoria reciclável."; }
        @Override public String icon() { return "rainbow"; }
        @Override public Tier tier() { return Tier.OURO; }

        @Override
        public boolean isEarned(BadgeStats estatisticas) {
            return Arrays.stream(CategoryCode.values())
                    .filter(c -> c != CategoryCode.REJEITO)
                    .allMatch(c -> estatisticas.kg(c) >= 1);
        }
    }
}
