package br.com.ecotechzero.lixozero.security;

import br.com.ecotechzero.lixozero.common.CodigoErro;
import br.com.ecotechzero.lixozero.user.User;
import br.com.ecotechzero.lixozero.user.RepositorioUsuarios;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

/**
 * Autentica a requisição a partir do cookie {@code ez_access}.
 * <p>
 * Além de validar a assinatura do JWT, recarrega o usuário do banco a cada requisição para que
 * desativação, mudança de perfil e troca de senha (token_version) tenham efeito IMEDIATO,
 * sem esperar o token expirar.
 * <p>
 * Conta bloqueada por tentativa de inspeção: responde 423 (ACCOUNT_LOCKED + Retry-After) em qualquer rota
 * da API, exceto csrf, logout, login e cadastro (o navegador ainda consegue sair; o login faz a própria checagem).
 */
public class FiltroAutenticacaoJwt extends OncePerRequestFilter {

    private final ServicoJwt servicoJwt;
    private final RepositorioUsuarios usuarios;
    private final EscritorRespostaProblema problemas;
    private final Clock relogio;

    public FiltroAutenticacaoJwt(ServicoJwt servicoJwt, RepositorioUsuarios usuarios, EscritorRespostaProblema problemas, Clock relogio) {
        this.servicoJwt = servicoJwt;
        this.usuarios = usuarios;
        this.problemas = problemas;
        this.relogio = relogio;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !request.getRequestURI().startsWith("/api/");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain cadeia)
            throws ServletException, IOException {
        Optional<User> encontrado = CookiesAutenticacao.ler(request, CookiesAutenticacao.ACCESS)
                .flatMap(servicoJwt::interpretar)
                .flatMap(dadosToken -> usuarios.findById(dadosToken.userId())
                        .filter(User::isEnabled)
                        .filter(u -> u.getTokenVersion() == dadosToken.tokenVersion()));
        if (encontrado.isPresent()) {
            User usuario = encontrado.get();
            Instant agora = relogio.instant();
            if (usuario.isSecurityLocked(agora) && !ehIsento(request)) {
                problemas.escrever(response, CodigoErro.ACCOUNT_LOCKED, 423, ServicoInspecao.LOCK_MESSAGE,
                        ServicoInspecao.segundosAteLiberar(usuario.getSecurityLockedUntil(), agora));
                return;
            }
            UsuarioAutenticado principal = new UsuarioAutenticado(usuario.getId(), usuario.getEmail(), usuario.getName(), usuario.getRole());
            var autenticacao = new UsernamePasswordAuthenticationToken(principal, null,
                    List.of(new SimpleGrantedAuthority("ROLE_" + usuario.getRole().name())));
            SecurityContextHolder.getContext().setAuthentication(autenticacao);
        }
        cadeia.doFilter(request, response);
    }

    private static boolean ehIsento(HttpServletRequest request) {
        String uri = request.getRequestURI();
        // login/cadastro fazem a própria checagem (e outra pessoa pode entrar no mesmo navegador)
        return uri.equals("/api/auth/logout") || uri.equals("/api/auth/csrf")
                || uri.equals("/api/auth/login") || uri.equals("/api/auth/register");
    }
}
