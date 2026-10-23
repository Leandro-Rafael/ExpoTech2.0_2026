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

    private final UserRepository users;
    private final OrganizationRepository organizations;

    public UserService(UserRepository users, OrganizationRepository organizations) {
        this.users = users;
        this.organizations = organizations;
    }

    @Transactional(readOnly = true)
    public UserMe getMe(UUID userId) {
        return UserMe.of(require(userId));
    }

    @Transactional
    public User createUser(String name, String email, String passwordHash, Role role) {
        if (users.existsByEmail(email)) {
            throw new ApiException(ErrorCode.CONFLICT, "Já existe uma conta cadastrada com este e-mail.");
        }
        return users.save(new User(name, email, passwordHash, role));
    }

    @Transactional
    public UserMe updateProfile(UUID userId, UserDtos.UpdateProfileRequest request) {
        User user = require(userId);
        if (request.getName() != null) {
            String name = Text.clean(request.getName());
            if (name == null || name.length() < 2) {
                throw ApiException.field("name", "informe seu nome");
            }
            user.setName(name);
        }
        if (request.isOrganizationIdPresent()) {
            user.setOrganization(request.getOrganizationId() == null ? null
                    : organizations.findById(request.getOrganizationId())
                    .orElseThrow(() -> ApiException.field("organizationId", "organização não encontrada")));
        }
        return UserMe.of(user);
    }

    /** Troca o hash e incrementa token_version: access tokens antigos deixam de valer na hora. */
    @Transactional
    public User updatePassword(UUID userId, String newHash) {
        User user = require(userId);
        user.setPasswordHash(newHash);
        user.incrementTokenVersion();
        return user;
    }

    User require(UUID userId) {
        return users.findById(userId).orElseThrow(() -> new ApiException(ErrorCode.UNAUTHORIZED, "Sessão inválida."));
    }
}
