package br.com.ecotechzero.lixozero.organization;

import br.com.ecotechzero.lixozero.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;

/** Turma, empresa, condomínio ou escola: agrupa usuários para o ranking por organização. */
@Entity
@Table(name = "organizations")
public class Organization extends BaseEntity {

    @Column(nullable = false, length = 120)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private TipoOrganizacao type;

    protected Organization() {
    }

    public Organization(String name, TipoOrganizacao type) {
        this.name = name;
        this.type = type;
    }

    public String getName() { return name; }
    public TipoOrganizacao getType() { return type; }
}
