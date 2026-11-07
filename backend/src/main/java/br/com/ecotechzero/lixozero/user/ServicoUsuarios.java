package br.com.ecotechzero.lixozero.user;

import br.com.ecotechzero.lixozero.common.ExcecaoApi;
import br.com.ecotechzero.lixozero.common.CodigoErro;
import br.com.ecotechzero.lixozero.common.Textos;
import br.com.ecotechzero.lixozero.organization.RepositorioOrganizacoes;
import br.com.ecotechzero.lixozero.user.DtosUsuario.UserMe;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/** Operações sobre o próprio usuário (perfil) e criação de contas. */
@Service
public class ServicoUsuarios {

    private final RepositorioUsuarios usuarios;
    private final RepositorioOrganizacoes organizacoes;

    public ServicoUsuarios(RepositorioUsuarios usuarios, RepositorioOrganizacoes organizacoes) {
        this.usuarios = usuarios;
        this.organizacoes = organizacoes;
    }

    @Transactional(readOnly = true)
    public UserMe buscarPerfil(UUID idUsuario) {
        return UserMe.of(buscarObrigatorio(idUsuario));
    }

    @Transactional
    public User criarUsuario(String nome, String email, String hashSenha, PerfilUsuario perfil) {
        if (usuarios.existsByEmail(email)) {
            throw new ExcecaoApi(CodigoErro.CONFLICT, "Já existe uma conta cadastrada com este e-mail.");
        }
        return usuarios.save(new User(nome, email, hashSenha, perfil));
    }

    @Transactional
    public UserMe atualizarPerfil(UUID idUsuario, DtosUsuario.UpdateProfileRequest dados) {
        User usuario = buscarObrigatorio(idUsuario);
        if (dados.getName() != null) {
            String nome = Textos.limpar(dados.getName());
            if (nome == null || nome.length() < 2) {
                throw ExcecaoApi.campo("name", "informe seu nome");
            }
            usuario.setName(nome);
        }
        if (dados.isOrganizationIdPresent()) {
            usuario.setOrganization(dados.getOrganizationId() == null ? null
                    : organizacoes.findById(dados.getOrganizationId())
                    .orElseThrow(() -> ExcecaoApi.campo("organizationId", "organização não encontrada")));
        }
        return UserMe.of(usuario);
    }

    /** Troca o hash e incrementa token_version: access tokens antigos deixam de valer na hora. */
    @Transactional
    public User atualizarSenha(UUID idUsuario, String novoHash) {
        User usuario = buscarObrigatorio(idUsuario);
        usuario.setPasswordHash(novoHash);
        usuario.incrementTokenVersion();
        return usuario;
    }

    User buscarObrigatorio(UUID idUsuario) {
        return usuarios.findById(idUsuario).orElseThrow(() -> new ExcecaoApi(CodigoErro.UNAUTHORIZED, "Sessão inválida."));
    }
}
