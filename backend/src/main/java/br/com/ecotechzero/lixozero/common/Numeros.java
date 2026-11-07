package br.com.ecotechzero.lixozero.common;

import java.math.BigDecimal;
import java.math.RoundingMode;

/** Utilitários numéricos (arredondamento para exibição e conversão de agregados SQL). */
public final class Numeros {

    private Numeros() {
    }

    public static double arredondar(double valor, int casasDecimais) {
        if (Double.isNaN(valor) || Double.isInfinite(valor)) {
            return 0;
        }
        return BigDecimal.valueOf(valor).setScale(casasDecimais, RoundingMode.HALF_UP).doubleValue();
    }

    public static double arredondar2(double valor) {
        return arredondar(valor, 2);
    }

    /** Converte o resultado de um agregado (BigDecimal, Long, null...) em double. */
    public static double paraDouble(Object valor) {
        return valor instanceof Number n ? n.doubleValue() : 0d;
    }

    public static long paraLong(Object valor) {
        return valor instanceof Number n ? n.longValue() : 0L;
    }

    /** Divisão que devolve 0 quando o divisor é zero (taxas e percentuais). */
    public static double razao(double numerador, double denominador) {
        return denominador <= 0 ? 0 : numerador / denominador;
    }
}
