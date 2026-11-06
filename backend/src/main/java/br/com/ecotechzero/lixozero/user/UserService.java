package br.com.ecotechzero.lixozero.user;

import br.com.ecotechzero.lixozero.common.ApiException;
import br.com.ecotechzero.lixozero.common.ErrorCode;
import br.com.ecotechzero.lixozero.common.Text;
import br.com.ecotechzero.lixozero.organization.OrganizationRepository;
import br.com.ecotechzero.lixozero.user.UserDtos.UserMe;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/** Operações sobre o próprio usuário (perfil) e criação de contas. */
@Service
public class UserService {

    private final UserRepository usuarios;
    private final OrganizationRepository organizacoes;

    public UserService(UserRepository usuarios, OrganizationRepository organizacoes) {
        this.usuarios = usuarios;
        this.organizacoes = organizacoes;
    }

    @Transactional(readOnly = true)
    public UserMe buscarPerfil(UUID idUsuario) {
        return UserMe.of(buscarObrigatorio(idUsuario));
    }

    @Transactional
    public User criarUsuario(String nome, String email, String hashSenha, Role perfil) {
        if (usuarios.existsByEmail(email)) {
            throw new ApiException(ErrorCode.CONFLICT, "Já existe uma conta cadastrada com este e-mail.");
        }
        return usuarios.save(new User(nome, email, hashSenha, perfil));
    }

    @Transactional
    public UserMe atualizarPerfil(UUID idUsuario, UserDtos.UpdateProfileRequest dados) {
        User usuario = buscarObrigatorio(idUsuario);
        if (dados.getName() != null) {
            String nome = Text.limpar(dados.getName());
            if (nome == null || nome.length() < 2) {
                throw ApiException.campo("name", "informe seu nome");
            }
            usuario.setName(nome);
        }
        if (dados.isOrganizationIdPresent()) {
            usuario.setOrganization(dados.getOrganizationId() == null ? null
                    : organizacoes.findById(dados.getOrganizationId())
                    .orElseThrow(() -> ApiException.campo("organizationId", "organização não encontrada")));
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
        return usuarios.findById(idUsuario).orElseThrow(() -> new ApiException(ErrorCode.UNAUTHORIZED, "Sessão inválida."));
    }
}
