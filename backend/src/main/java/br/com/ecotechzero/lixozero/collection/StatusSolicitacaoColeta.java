package br.com.ecotechzero.lixozero.collection;

/** Andamento da coleta: pedida -> agendada (entrou numa rota) -> em rota -> coletada, ou cancelada. */
public enum StatusSolicitacaoColeta {
    REQUESTED, SCHEDULED, IN_ROUTE, COLLECTED, CANCELLED;

    /** Solicitações ainda não finalizadas. */
    public static final java.util.Set<StatusSolicitacaoColeta> OPEN = java.util.EnumSet.of(REQUESTED, SCHEDULED, IN_ROUTE);
}
