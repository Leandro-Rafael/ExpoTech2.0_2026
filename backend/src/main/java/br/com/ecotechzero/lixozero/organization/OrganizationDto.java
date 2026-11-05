package br.com.ecotechzero.lixozero.organization;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.UUID;

/** Dados de uma organização (turma, escola, empresa ou condomínio) usados no cadastro e no ranking. */
public record OrganizationDto(UUID id, String name, OrganizationType type) {

    public static OrganizationDto of(Organization o) {
        return o == null ? null : new OrganizationDto(o.getId(), o.getName(), o.getType());
    }

    /** Entrada do POST /api/admin/organizations. */
    public record Input(@NotBlank @Size(min = 2, max = 120) String name, @NotNull OrganizationType type) {
    }
}
