package br.com.ecotechzero.lixozero.auth;

import br.com.ecotechzero.lixozero.common.ExcecaoApi;
import br.com.ecotechzero.lixozero.common.CodigoErro;
import br.com.ecotechzero.lixozero.security.CookiesAutenticacao;
import br.com.ecotechzero.lixozero.security.UsuarioAutenticado;
import br.com.ecotechzero.lixozero.user.DtosUsuario.UserMe;
import br.com.ecotechzero.lixozero.user.ServicoUsuarios;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Rotas de /api/auth (cadastro, login, refresh, logout e sessão atual); a lógica fica no ServicoAutenticacao. */
@RestController
@RequestMapping("/api/auth")
public class ControladorAutenticacao {

    private final ServicoAutenticacao servicoAutenticacao;
    private final ServicoUsuarios servicoUsuario;

    public ControladorAutenticacao(ServicoAutenticacao servicoAutenticacao, ServicoUsuarios servicoUsuario) {
        this.servicoAutenticacao = servicoAutenticacao;
        this.servicoUsuario = servicoUsuario;
    }

    /** Garante o cookie XSRF-TOKEN (o front-end chama no boot da aplicação). */
    @GetMapping("/csrf")
    public ResponseEntity<Void> csrf(CsrfToken token) {
        token.getToken();
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public UserMe cadastrar(@Valid @RequestBody DtosAutenticacao.RegisterRequest corpo, HttpServletRequest request, HttpServletResponse response) {
        return servicoAutenticacao.cadastrar(corpo, request, response);
    }

    @PostMapping("/login")
    public UserMe entrar(@Valid @RequestBody DtosAutenticacao.LoginRequest corpo, HttpServletRequest request, HttpServletResponse response) {
        return servicoAutenticacao.entrar(corpo, request, response);
    }

    @PostMapping("/refresh")
    public UserMe renovar(HttpServletRequest request, HttpServletResponse response) {
        return servicoAutenticacao.renovar(request, response);
    }

    @PostMapping("/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void sair(@AuthenticationPrincipal UsuarioAutenticado logado, HttpServletRequest request, HttpServletResponse response) {
        servicoAutenticacao.sair(logado == null ? null : logado.id(), request, response);
    }

    /**
     * Sessão atual para o boot do SPA, sem erro para visitante: 200 {@code UserMe} com sessão válida; 204 sem sessão;
     * 401 só quando o access token venceu mas há refresh token (o cliente renova e repete). Assim a landing e o
     * login não geram 401 no console de quem nunca entrou.
     */
    @GetMapping("/session")
    public ResponseEntity<UserMe> sessao(@AuthenticationPrincipal UsuarioAutenticado logado, HttpServletRequest request) {
        if (logado != null) {
            return ResponseEntity.ok(servicoUsuario.buscarPerfil(logado.id()));
        }
        if (CookiesAutenticacao.ler(request, CookiesAutenticacao.REFRESH).isPresent()) {
            throw new ExcecaoApi(CodigoErro.UNAUTHORIZED, "Sessão expirada. Faça login novamente.");
        }
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/me")
    public UserMe perfil(@AuthenticationPrincipal UsuarioAutenticado logado) {
        return servicoUsuario.buscarPerfil(logado.id());
    }
}
