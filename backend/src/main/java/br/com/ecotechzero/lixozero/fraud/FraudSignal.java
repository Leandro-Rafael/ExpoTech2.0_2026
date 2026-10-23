package br.com.ecotechzero.lixozero.fraud;

/**
 * Sinal de risco emitido por uma regra.
 *
 * @param rule    código da regra que disparou
 * @param score   pontos de risco somados ao total (0-100)
 * @param message explicação em português exibida ao administrador
 */
public record FraudSignal(String rule, int score, String message) {
}
