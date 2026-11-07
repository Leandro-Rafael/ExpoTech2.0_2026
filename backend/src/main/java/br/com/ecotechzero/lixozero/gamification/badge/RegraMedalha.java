package br.com.ecotechzero.lixozero.gamification.badge;

/**
 * Medalha e sua regra de conquista (padrão Strategy): cada medalha sabe decidir, a partir das
 * {@link EstatisticasMedalha}, se o usuário a conquistou. Novas medalhas = novas implementações no {@link CatalogoMedalhas}.
 */
public interface RegraMedalha {

    enum Tier { BRONZE, PRATA, OURO, DIAMANTE }

    String code();

    String name();

    String description();

    /** Ícone lucide. */
    String icon();

    Tier tier();

    boolean isEarned(EstatisticasMedalha estatisticas);
}
