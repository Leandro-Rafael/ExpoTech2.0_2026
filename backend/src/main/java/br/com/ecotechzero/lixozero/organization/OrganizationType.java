package br.com.ecotechzero.lixozero.organization;

public enum OrganizationType {
    TURMA, EMPRESA, CONDOMINIO, ESCOLA;

    /** Rótulo em português para subtítulos do ranking. */
    public String label() {
        return switch (this) {
            case TURMA -> "Turma";
            case EMPRESA -> "Empresa";
            case CONDOMINIO -> "Condomínio";
            case ESCOLA -> "Escola";
        };
    }
}
