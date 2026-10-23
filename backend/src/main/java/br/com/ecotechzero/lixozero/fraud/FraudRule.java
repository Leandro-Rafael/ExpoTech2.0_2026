package br.com.ecotechzero.lixozero.fraud;

import java.util.Optional;

/**
 * Regra antifraude (exemplo de POLIMORFISMO e do princípio aberto/fechado).
 * <p>
 * Cada implementação analisa um aspecto do descarte e, se encontrar algo suspeito, devolve um
 * {@link FraudSignal} com uma pontuação de risco. O {@link FraudEngine} recebe automaticamente
 * todas as implementações (injeção de dependência do Spring) e soma as pontuações.
 * Para criar uma nova regra basta criar uma nova classe @Component que implemente esta interface,
 * sem alterar o motor.
 */
public interface FraudRule {

    /** Código curto da regra (ex.: "FOTO_REPETIDA"). */
    String code();

    /** Avalia o descarte; vazio quando nada suspeito foi encontrado. */
    Optional<FraudSignal> evaluate(FraudContext context);
}
