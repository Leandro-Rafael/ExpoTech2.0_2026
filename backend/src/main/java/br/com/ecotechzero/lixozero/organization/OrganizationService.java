package br.com.ecotechzero.lixozero.organization;

import br.com.ecotechzero.lixozero.audit.AuditAction;
import br.com.ecotechzero.lixozero.audit.AuditService;
import br.com.ecotechzero.lixozero.common.ApiException;
import br.com.ecotechzero.lixozero.common.Text;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class OrganizationService {

    private final OrganizationRepository repository;
    private final AuditService audit;

    public OrganizationService(OrganizationRepository repository, AuditService audit) {
        this.repository = repository;
        this.audit = audit;
    }

    @Transactional(readOnly = true)
    public List<OrganizationDto> list() {
        return repository.findAllByOrderByName().stream().map(OrganizationDto::of).toList();
    }

    @Transactional
    public OrganizationDto create(OrganizationDto.Input input) {
        String name = Text.clean(input.name());
        if (name == null || name.length() < 2) {
            throw ApiException.field("name", "informe o nome");
        }
        if (repository.existsByNameIgnoreCase(name)) {
            throw ApiException.conflict("Já existe uma organização com este nome.");
        }
        Organization org = repository.save(new Organization(name, input.type()));
        audit.record(AuditAction.ORGANIZATION_CREATED, "Organization", org.getId(), name);
        return OrganizationDto.of(org);
    }
}
