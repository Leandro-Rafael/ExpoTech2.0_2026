package br.com.ecotechzero.lixozero.user;

import br.com.ecotechzero.lixozero.auth.AuthDtos;
import br.com.ecotechzero.lixozero.auth.AuthService;
import br.com.ecotechzero.lixozero.organization.OrganizationDto;
import br.com.ecotechzero.lixozero.organization.OrganizationRepository;
import br.com.ecotechzero.lixozero.security.AuthUser;
import br.com.ecotechzero.lixozero.user.UserDtos.UserMe;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** Perfil do usuário logado e lista pública de organizações. */
@RestController
public class ProfileController {

    private final UserService servicoUsuario;
    private final AuthService servicoAutenticacao;
    private final OrganizationRepository organizacoes;

    public ProfileController(UserService servicoUsuario, AuthService servicoAutenticacao, OrganizationRepository organizacoes) {
        this.servicoUsuario = servicoUsuario;
        this.servicoAutenticacao = servicoAutenticacao;
        this.organizacoes = organizacoes;
    }

    @PatchMapping("/api/me")
    public UserMe atualizar(@AuthenticationPrincipal AuthUser logado, @Valid @RequestBody UserDtos.UpdateProfileRequest corpo) {
        return servicoUsuario.atualizarPerfil(logado.id(), corpo);
    }

    @PostMapping("/api/me/password")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void trocarSenha(@AuthenticationPrincipal AuthUser logado, @Valid @RequestBody AuthDtos.ChangePasswordRequest corpo,
                               HttpServletRequest request, HttpServletResponse response) {
        servicoAutenticacao.trocarSenha(logado.id(), corpo, request, response);
    }

    @GetMapping("/api/organizations")
    @Transactional(readOnly = true)
    public List<OrganizationDto> organizacoes() {
        return organizacoes.findAllByOrderByName().stream().map(OrganizationDto::of).toList();
    }
}
