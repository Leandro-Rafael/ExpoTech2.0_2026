package br.com.ecotechzero.lixozero.disposal;

/** Ciclo de vida do descarte: pendente -> aprovado (gera pontos uma única vez) ou recusado. */
public enum DisposalStatus {
    PENDING, APPROVED, REJECTED
}
