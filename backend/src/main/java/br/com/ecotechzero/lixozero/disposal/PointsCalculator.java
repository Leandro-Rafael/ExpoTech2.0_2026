package br.com.ecotechzero.lixozero.disposal;

/**
 * Regra de pontuação de um descarte aprovado:
 * pontos = arredondar(kg x pontosPorKg da categoria), mínimo 1,
 * + 10% de bônus quando há foto e a IA DO SERVIDOR confirmou a categoria final.
 */
public final class PointsCalculator {

    public static final double AI_CONFIRMED_BONUS = 0.10;
    public static final double AI_MIN_CONFIDENCE = 0.6;
    /** A foto precisa ter sido enviada há no máximo este tempo para a classificação valer o bônus. */
    public static final java.time.Duration AI_PHOTO_MAX_AGE = java.time.Duration.ofHours(24);

    private PointsCalculator() {
    }

    public static int points(int pointsPerKg, double quantityKg, boolean aiConfirmed) {
        if (quantityKg <= 0 || pointsPerKg <= 0) {
            return quantityKg > 0 ? 1 : 0;
        }
        long base = Math.round(quantityKg * pointsPerKg);
        if (aiConfirmed) {
            base = Math.round(base * (1 + AI_CONFIRMED_BONUS));
        }
        return (int) Math.clamp(base, 1, Integer.MAX_VALUE);
    }
}
