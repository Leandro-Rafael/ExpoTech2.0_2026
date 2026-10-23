package br.com.ecotechzero.lixozero.common;

import java.math.BigDecimal;
import java.math.RoundingMode;

/** Utilitários numéricos (arredondamento para exibição e conversão de agregados SQL). */
public final class Numbers {

    private Numbers() {
    }

    public static double round(double value, int decimals) {
        if (Double.isNaN(value) || Double.isInfinite(value)) {
            return 0;
        }
        return BigDecimal.valueOf(value).setScale(decimals, RoundingMode.HALF_UP).doubleValue();
    }

    public static double round2(double value) {
        return round(value, 2);
    }

    /** Converte o resultado de um agregado (BigDecimal, Long, null...) em double. */
    public static double toDouble(Object value) {
        return value instanceof Number n ? n.doubleValue() : 0d;
    }

    public static long toLong(Object value) {
        return value instanceof Number n ? n.longValue() : 0L;
    }

    /** Divisão que devolve 0 quando o divisor é zero (taxas e percentuais). */
    public static double ratio(double numerator, double denominator) {
        return denominator <= 0 ? 0 : numerator / denominator;
    }
}
