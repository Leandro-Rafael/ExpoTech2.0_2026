package br.com.ecotechzero.lixozero.gamification;

import java.time.LocalDate;
import java.util.List;
import java.util.TreeSet;

/** Calcula a sequência de dias seguidos com atividade, terminando hoje ou ontem. */
public final class StreakCalculator {

    private StreakCalculator() {
    }

    public static int sequencia(List<LocalDate> diasAtivos, LocalDate hoje) {
        TreeSet<LocalDate> dias = new TreeSet<>(diasAtivos);
        LocalDate diaAtual = dias.contains(hoje) ? hoje : hoje.minusDays(1);
        int sequencia = 0;
        while (dias.contains(diaAtual)) {
            sequencia++;
            diaAtual = diaAtual.minusDays(1);
        }
        return sequencia;
    }
}
