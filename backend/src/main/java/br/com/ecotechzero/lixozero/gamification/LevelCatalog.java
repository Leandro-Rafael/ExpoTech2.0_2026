package br.com.ecotechzero.lixozero.gamification;

import java.util.List;

/**
 * Níveis da jornada sustentável, definidos pelo total de pontos já ganhos (totalEarned).
 * Resgatar recompensas reduz o saldo, mas NUNCA reduz o nível.
 */
public final class LevelCatalog {

    public record LevelDef(int index, String name, long minPoints) {
    }

    /** Nível atual com progresso (0..1) até o próximo. */
    public record LevelDto(int index, String name, long minPoints, String nextName, Long nextMinPoints, double progress) {
    }

    public static final List<LevelDef> NIVEIS = List.of(
            new LevelDef(0, "Semente", 0),
            new LevelDef(1, "Broto", 200),
            new LevelDef(2, "Muda", 600),
            new LevelDef(3, "Árvore", 1_500),
            new LevelDef(4, "Floresta", 3_500),
            new LevelDef(5, "Guardião 2050", 8_000));

    private LevelCatalog() {
    }

    public static LevelDto nivelPara(long totalGanho) {
        LevelDef atual = NIVEIS.getFirst();
        for (LevelDef nivel : NIVEIS) {
            if (totalGanho >= nivel.minPoints()) {
                atual = nivel;
            }
        }
        int indiceProximo = atual.index() + 1;
        if (indiceProximo >= NIVEIS.size()) {
            return new LevelDto(atual.index(), atual.name(), atual.minPoints(), null, null, 1.0);
        }
        LevelDef proximo = NIVEIS.get(indiceProximo);
        double progresso = (double) (totalGanho - atual.minPoints()) / (proximo.minPoints() - atual.minPoints());
        return new LevelDto(atual.index(), atual.name(), atual.minPoints(), proximo.name(), proximo.minPoints(),
                Math.round(Math.clamp(progresso, 0, 1) * 1000) / 1000.0);
    }
}
