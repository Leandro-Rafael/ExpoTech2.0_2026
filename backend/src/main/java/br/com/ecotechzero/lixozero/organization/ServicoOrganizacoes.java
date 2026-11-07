package br.com.ecotechzero.lixozero.organization;

import br.com.ecotechzero.lixozero.audit.AcaoAuditoria;
import br.com.ecotechzero.lixozero.audit.ServicoAuditoria;
import br.com.ecotechzero.lixozero.common.ExcecaoApi;
import br.com.ecotechzero.lixozero.common.Textos;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/** Lista e cadastro de organizações pelo admin (nome não pode repetir). */
@Service
public class ServicoOrganizacoes {

    private final RepositorioOrganizacoes repositorio;
    private final ServicoAuditoria auditoria;

    public ServicoOrganizacoes(RepositorioOrganizacoes repositorio, ServicoAuditoria auditoria) {
        this.repositorio = repositorio;
        this.auditoria = auditoria;
    }

    @Transactional(readOnly = true)
    public List<DtoOrganizacao> listar() {
        return repositorio.findAllByOrderByName().stream().map(DtoOrganizacao::of).toList();
    }

    @Transactional
    public DtoOrganizacao criar(DtoOrganizacao.Input entrada) {
        String nome = Textos.limpar(entrada.name());
        if (nome == null || nome.length() < 2) {
            throw ExcecaoApi.campo("name", "informe o nome");
        }
        if (repositorio.existsByNameIgnoreCase(nome)) {
            throw ExcecaoApi.conflito("Já existe uma organização com este nome.");
        }
        Organization organizacao = repositorio.save(new Organization(nome, entrada.type()));
        auditoria.registrar(AcaoAuditoria.ORGANIZATION_CREATED, "Organization", organizacao.getId(), nome);
        return DtoOrganizacao.of(organizacao);
    }
}
