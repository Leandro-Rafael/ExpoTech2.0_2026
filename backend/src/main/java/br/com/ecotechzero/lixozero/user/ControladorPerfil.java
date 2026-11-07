package br.com.ecotechzero.lixozero.user;

import br.com.ecotechzero.lixozero.auth.DtosAutenticacao;
import br.com.ecotechzero.lixozero.auth.ServicoAutenticacao;
import br.com.ecotechzero.lixozero.organization.DtoOrganizacao;
import br.com.ecotechzero.lixozero.organization.RepositorioOrganizacoes;
import br.com.ecotechzero.lixozero.security.UsuarioAutenticado;
import br.com.ecotechzero.lixozero.user.DtosUsuario.UserMe;
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
public class ControladorPerfil {

    private final ServicoUsuarios servicoUsuario;
    private final ServicoAutenticacao servicoAutenticacao;
    private final RepositorioOrganizacoes organizacoes;

    public ControladorPerfil(ServicoUsuarios servicoUsuario, ServicoAutenticacao servicoAutenticacao, RepositorioOrganizacoes organizacoes) {
        this.servicoUsuario = servicoUsuario;
        this.servicoAutenticacao = servicoAutenticacao;
        this.organizacoes = organizacoes;
    }

    @PatchMapping("/api/me")
    public UserMe atualizar(@AuthenticationPrincipal UsuarioAutenticado logado, @Valid @RequestBody DtosUsuario.UpdateProfileRequest corpo) {
        return servicoUsuario.atualizarPerfil(logado.id(), corpo);
    }

    @PostMapping("/api/me/password")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void trocarSenha(@AuthenticationPrincipal UsuarioAutenticado logado, @Valid @RequestBody DtosAutenticacao.ChangePasswordRequest corpo,
                               HttpServletRequest request, HttpServletResponse response) {
        servicoAutenticacao.trocarSenha(logado.id(), corpo, request, response);
    }

    @GetMapping("/api/organizations")
    @Transactional(readOnly = true)
    public List<DtoOrganizacao> organizacoes() {
        return organizacoes.findAllByOrderByName().stream().map(DtoOrganizacao::of).toList();
    }
}
