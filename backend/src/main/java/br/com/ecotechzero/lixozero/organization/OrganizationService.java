package br.com.ecotechzero.lixozero.organization;

import br.com.ecotechzero.lixozero.audit.AuditAction;
import br.com.ecotechzero.lixozero.audit.AuditService;
import br.com.ecotechzero.lixozero.common.ApiException;
import br.com.ecotechzero.lixozero.common.Text;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/** Lista e cadastro de organizações pelo admin (nome não pode repetir). */
@Service
public class OrganizationService {

    private final OrganizationRepository repositorio;
    private final AuditService auditoria;

    public OrganizationService(OrganizationRepository repositorio, AuditService auditoria) {
        this.repositorio = repositorio;
        this.auditoria = auditoria;
    }

    @Transactional(readOnly = true)
    public List<OrganizationDto> listar() {
        return repositorio.findAllByOrderByName().stream().map(OrganizationDto::of).toList();
    }

    @Transactional
    public OrganizationDto criar(OrganizationDto.Input entrada) {
        String nome = Text.limpar(entrada.name());
        if (nome == null || nome.length() < 2) {
            throw ApiException.campo("name", "informe o nome");
        }
        if (repositorio.existsByNameIgnoreCase(nome)) {
            throw ApiException.conflito("Já existe uma organização com este nome.");
        }
        Organization organizacao = repositorio.save(new Organization(nome, entrada.type()));
        auditoria.registrar(AuditAction.ORGANIZATION_CREATED, "Organization", organizacao.getId(), nome);
        return OrganizationDto.of(organizacao);
    }
}
