package br.com.ecotechzero.lixozero.disposal;

/**
 * Regra de pontuação de um descarte aprovado:
 * pontos = arredondar(kg x pontosPorKg da categoria), mínimo 1,
 * + 10% de bônus quando há foto e a IA DO SERVIDOR confirmou a categoria final.
 */
public final class PointsCalculator {

    public static final double BONUS_IA_CONFIRMADA = 0.10;
    public static final double CONFIANCA_MINIMA_IA = 0.6;
    /** A foto precisa ter sido enviada há no máximo este tempo para a classificação valer o bônus. */
    public static final java.time.Duration IDADE_MAXIMA_FOTO_IA = java.time.Duration.ofHours(24);

    private PointsCalculator() {
    }

    public static int calcular(int pontosPorKg, double quantidadeKg, boolean iaConfirmou) {
        if (quantidadeKg <= 0 || pontosPorKg <= 0) {
            return quantidadeKg > 0 ? 1 : 0;
        }
        long base = Math.round(quantidadeKg * pontosPorKg);
        if (iaConfirmou) {
            base = Math.round(base * (1 + BONUS_IA_CONFIRMADA));
        }
        return (int) Math.clamp(base, 1, Integer.MAX_VALUE);
    }
}
