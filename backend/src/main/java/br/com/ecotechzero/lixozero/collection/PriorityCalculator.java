package br.com.ecotechzero.lixozero.collection;

import br.com.ecotechzero.lixozero.category.CategoryCode;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Set;

/**
 * Prioridade (0 a 100) de uma solicitação de coleta, calculada no momento da consulta:
 * <ul>
 *   <li>base de 20 pontos;</li>
 *   <li>volume: até +30 (proporcional ao peso estimado, teto em 100 kg);</li>
 *   <li>tempo de espera: +5 por dia, até +25;</li>
 *   <li>resíduo eletrônico (perigoso): +15;</li>
 *   <li>lixeira inteligente: até +25 conforme o nível de enchimento acima de 50%;</li>
 *   <li>data preferida já chegou: +10.</li>
 * </ul>
 */
public final class PriorityCalculator {

    private PriorityCalculator() {
    }

    public static int calcular(double pesoEstimadoKg, Instant criadaEm, Set<CategoryCode> categorias,
                               Integer nivelLixeira, LocalDate dataPreferida, Instant agora, LocalDate hoje) {
        double pontuacao = 20;
        pontuacao += Math.min(30, Math.max(0, pesoEstimadoKg) / 100.0 * 30);
        long diasEspera = criadaEm == null ? 0 : Math.max(0, Duration.between(criadaEm, agora).toDays());
        pontuacao += Math.min(25, diasEspera * 5);
        if (categorias.contains(CategoryCode.ELETRONICO)) {
            pontuacao += 15;
        }
        if (nivelLixeira != null) {
            pontuacao += Math.clamp((nivelLixeira - 50) / 2.0, 0, 25);
        }
        if (dataPreferida != null && !dataPreferida.isAfter(hoje)) {
            pontuacao += 10;
        }
        return (int) Math.round(Math.clamp(pontuacao, 0, 100));
    }
}
