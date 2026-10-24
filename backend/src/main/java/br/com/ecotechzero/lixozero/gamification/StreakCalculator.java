package br.com.ecotechzero.lixozero.gamification;

import java.time.LocalDate;
import java.util.List;
import java.util.TreeSet;

/** Calcula a sequência de dias seguidos com atividade, terminando hoje ou ontem. */
public final class StreakCalculator {

    private StreakCalculator() {
    }

    public static int streak(List<LocalDate> activeDays, LocalDate today) {
        TreeSet<LocalDate> days = new TreeSet<>(activeDays);
        LocalDate cursor = days.contains(today) ? today : today.minusDays(1);
        int streak = 0;
        while (days.contains(cursor)) {
            streak++;
            cursor = cursor.minusDays(1);
        }
        return streak;
    }
}
