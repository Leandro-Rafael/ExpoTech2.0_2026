package br.com.ecotechzero.lixozero.auth;

import br.com.ecotechzero.lixozero.audit.AuditAction;
import br.com.ecotechzero.lixozero.audit.AuditService;
import br.com.ecotechzero.lixozero.common.ApiException;
import br.com.ecotechzero.lixozero.common.ErrorCode;
import br.com.ecotechzero.lixozero.common.RequestContext;
import br.com.ecotechzero.lixozero.common.Text;
import br.com.ecotechzero.lixozero.common.TokenBucketRateLimiter;
import br.com.ecotechzero.lixozero.common.TokenBucketRateLimiter.Policy;
import br.com.ecotechzero.lixozero.security.AuthCookies;
import br.com.ecotechzero.lixozero.security.InspectionService;
import br.com.ecotechzero.lixozero.security.JwtService;
import br.com.ecotechzero.lixozero.security.PasswordPolicy;
import br.com.ecotechzero.lixozero.user.Role;
import br.com.ecotechzero.lixozero.user.User;
import br.com.ecotechzero.lixozero.user.UserDtos.UserMe;
import br.com.ecotechzero.lixozero.user.UserRepository;
import br.com.ecotechzero.lixozero.user.UserService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

/**
 * Fluxos de autenticação: cadastro, login, renovação, logout e troca de senha.
 * <p>
 * Esta classe NÃO é transacional de propósito: cada etapa (registrar falha, emitir token, auditar)
 * é confirmada separadamente, para que uma falha de login seja contabilizada mesmo que a resposta seja erro.
 */
@Service
public class AuthService {

    private static final String CREDENCIAIS_INVALIDAS = "E-mail ou senha incorretos.";

    private final UserRepository usuarios;
    private final UserService servicoUsuario;
    private final PasswordEncoder codificador;
    private final PasswordPolicy politicaSenha;
    private final JwtService servicoJwt;
    private final RefreshTokenService tokensRenovacao;
    private final LoginAttemptService tentativasLogin;
    private final AuthCookies cookies;
    private final AuditService auditoria;
    private final TokenBucketRateLimiter limitador;
    private final Clock relogio;
    /** Hash fictício: comparamos a senha mesmo quando o e-mail não existe (tempo de resposta uniforme). */
    private final String hashFicticio;

    public AuthService(UserRepository usuarios, UserService servicoUsuario, PasswordEncoder codificador, PasswordPolicy politicaSenha,
                       JwtService servicoJwt, RefreshTokenService tokensRenovacao, LoginAttemptService tentativasLogin,
                       AuthCookies cookies, AuditService auditoria, TokenBucketRateLimiter limitador, Clock relogio) {
        this.usuarios = usuarios;
        this.servicoUsuario = servicoUsuario;
        this.codificador = codificador;
        this.politicaSenha = politicaSenha;
        this.servicoJwt = servicoJwt;
        this.tokensRenovacao = tokensRenovacao;
        this.tentativasLogin = tentativasLogin;
        this.cookies = cookies;
        this.auditoria = auditoria;
        this.limitador = limitador;
        this.relogio = relogio;
        this.hashFicticio = codificador.encode(UUID.randomUUID().toString());
    }

    public UserMe cadastrar(AuthDtos.RegisterRequest dados, HttpServletRequest request, HttpServletResponse response) {
        // 1. Limita cadastros por IP e valida nome e força da senha.
        limitador.verificar(Policy.REGISTER_IP, RequestContext.ipCliente(request));
        String email = Text.normalizarEmail(dados.email());
        String nome = Text.limpar(dados.name());
        if (nome == null || nome.length() < 2) {
            throw ApiException.campo("name", "informe seu nome");
        }
        politicaSenha.validar("password", dados.password(), email);
        // 2. Cria a conta como morador (USER); no banco vai só o hash da senha.
        User usuario = servicoUsuario.criarUsuario(nome, email, codificador.encode(dados.password()), Role.USER);
        auditoria.registrarComo(usuario.getId(), rotulo(usuario), AuditAction.USER_REGISTERED, "User", usuario.getId(), null);
        // 3. Já abre a sessão, então a pessoa sai do cadastro logada.
        iniciarSessao(usuario, request, response);
        return servicoUsuario.buscarPerfil(usuario.getId());
    }

    public UserMe entrar(AuthDtos.LoginRequest dados, HttpServletRequest request, HttpServletResponse response) {
        // 1. Limite de tentativas por IP e por e-mail, para frear robô testando senha.
        String ip = RequestContext.ipCliente(request);
        limitador.verificar(Policy.LOGIN_IP, ip);
        String email = Text.normalizarEmail(dados.email());
        limitador.verificar(Policy.LOGIN_EMAIL, email);

        // 2. Se o e-mail já está bloqueado por erros anteriores, nem confere a senha.
        Optional<User> encontrado = usuarios.findByEmail(email);
        User usuario = encontrado.orElse(null);
        tentativasLogin.tempoBloqueioRestante(email, usuario).ifPresent(this::lancarBloqueio);

        boolean senhaCorreta;
        if (usuario != null) {
            senhaCorreta = codificador.matches(dados.password(), usuario.getPasswordHash());
        } else {
            codificador.matches(dados.password(), hashFicticio); // mesmo custo de CPU: não revela se o e-mail existe
            senhaCorreta = false;
        }

        // 3. Senha errada conta uma falha; ao chegar no limite a conta fica bloqueada por um tempo.
        if (!senhaCorreta) {
            boolean bloqueouAgora = tentativasLogin.registrarFalha(email, usuario);
            auditoria.registrarComo(usuario == null ? null : usuario.getId(), Text.truncar(email, 160), AuditAction.LOGIN_FAILED, "User",
                    usuario == null ? null : usuario.getId(), usuario == null ? "e-mail não cadastrado" : "senha incorreta");
            if (bloqueouAgora) {
                auditoria.registrarComo(usuario == null ? null : usuario.getId(), Text.truncar(email, 160), AuditAction.ACCOUNT_LOCKED,
                        "User", usuario == null ? null : usuario.getId(), "bloqueio por " + LoginAttemptService.LOCK_DURATION.toMinutes() + " min");
                lancarBloqueio(LoginAttemptService.LOCK_DURATION);
            }
            throw new ApiException(ErrorCode.BAD_CREDENTIALS, CREDENCIAIS_INVALIDAS);
        }
        // 4. Mesmo com a senha certa, conta desativada ou bloqueada por inspeção não entra.
        if (!usuario.isEnabled()) {
            auditoria.registrarComo(usuario.getId(), rotulo(usuario), AuditAction.LOGIN_DISABLED_ACCOUNT, "User", usuario.getId(), null);
            throw new ApiException(ErrorCode.FORBIDDEN, "Esta conta está desativada. Procure o administrador.");
        }
        // bloqueio por inspeção: checado só DEPOIS da senha correta (não revela a terceiros que a conta existe)
        Instant agora = relogio.instant();
        if (usuario.isSecurityLocked(agora)) {
            auditoria.registrarComo(usuario.getId(), rotulo(usuario), AuditAction.LOGIN_BLOCKED_INSPECTION, "User", usuario.getId(),
                    "bloqueado até " + usuario.getSecurityLockedUntil());
            throw InspectionService.excecaoBloqueio(usuario.getSecurityLockedUntil(), agora);
        }
        // 5. Deu certo: zera as falhas, grava os cookies da sessão e registra na auditoria.
        tentativasLogin.registrarSucesso(email, usuario);
        iniciarSessao(usuario, request, response);
        auditoria.registrarComo(usuario.getId(), rotulo(usuario), AuditAction.LOGIN_SUCCESS, "User", usuario.getId(), null);
        return servicoUsuario.buscarPerfil(usuario.getId());
    }

    public UserMe renovar(HttpServletRequest request, HttpServletResponse response) {
        limitador.verificar(Policy.REFRESH_IP, RequestContext.ipCliente(request));
        String tokenBruto = AuthCookies.ler(request, AuthCookies.REFRESH)
                .orElseThrow(() -> new ApiException(ErrorCode.UNAUTHORIZED, "Sessão expirada. Faça login novamente."));
        // 1. O JWT de acesso dura pouco. Aqui o refresh token do cookie é trocado por um novo (cada um só vale uma vez).
        RefreshTokenService.Rotation rotacao = tokensRenovacao.rotacionar(tokenBruto);
        Instant agora = relogio.instant();
        if (rotacao.user() != null && rotacao.user().isSecurityLocked(agora)) {
            cookies.limpar(request, response);
            throw InspectionService.excecaoBloqueio(rotacao.user().getSecurityLockedUntil(), agora);
        }
        // 2. Se um token já usado aparece de novo, provavelmente foi roubado: a família toda é revogada e auditada.
        switch (rotacao.outcome()) {
            case ROTATED -> {
                User usuario = rotacao.user();
                cookies.gravarSessao(request, response, servicoJwt.emitirTokenAcesso(usuario), rotacao.newRawToken());
                return servicoUsuario.buscarPerfil(usuario.getId());
            }
            case REUSE_DETECTED -> auditoria.registrarComo(rotacao.user().getId(), rotulo(rotacao.user()), AuditAction.REFRESH_TOKEN_REUSE,
                    "User", rotacao.user().getId(), "refresh token reutilizado: todas as sessões desta família foram revogadas");
            case INVALID -> {
                // nada a auditar
            }
        }
        cookies.limpar(request, response);
        throw new ApiException(ErrorCode.UNAUTHORIZED, "Sessão expirada. Faça login novamente.");
    }

    public void sair(UUID idUsuarioAtual, HttpServletRequest request, HttpServletResponse response) {
        AuthCookies.ler(request, AuthCookies.REFRESH).ifPresent(tokensRenovacao::revogarFamiliaDe);
        cookies.limpar(request, response);
        if (idUsuarioAtual != null) {
            auditoria.registrar(AuditAction.LOGOUT, "User", idUsuarioAtual, null);
        }
    }

    /** Troca de senha: revoga TODAS as sessões e abre uma nova apenas para este navegador. */
    public void trocarSenha(UUID idUsuario, AuthDtos.ChangePasswordRequest dados, HttpServletRequest request, HttpServletResponse response) {
        limitador.verificar(Policy.PASSWORD_CHANGE_USER, idUsuario.toString());
        User usuario = usuarios.findById(idUsuario).orElseThrow(() -> new ApiException(ErrorCode.UNAUTHORIZED, "Sessão inválida."));
        if (!codificador.matches(dados.currentPassword(), usuario.getPasswordHash())) {
            throw ApiException.campo("currentPassword", "senha atual incorreta");
        }
        if (dados.currentPassword().equals(dados.newPassword())) {
            throw ApiException.campo("newPassword", "a nova senha deve ser diferente da atual");
        }
        politicaSenha.validar("newPassword", dados.newPassword(), usuario.getEmail());
        User atualizado = servicoUsuario.atualizarSenha(idUsuario, codificador.encode(dados.newPassword()));
        tokensRenovacao.revogarTodasDoUsuario(idUsuario, RefreshToken.REASON_PASSWORD);
        iniciarSessao(atualizado, request, response);
        auditoria.registrar(AuditAction.PASSWORD_CHANGED, "User", idUsuario, "demais sessões encerradas");
    }

    private void iniciarSessao(User usuario, HttpServletRequest request, HttpServletResponse response) {
        RefreshTokenService.Issued emitido = tokensRenovacao.emitir(usuario, null);
        cookies.gravarSessao(request, response, servicoJwt.emitirTokenAcesso(usuario), emitido.rawToken());
    }

    private void lancarBloqueio(Duration restante) {
        long segundos = Math.max(1, restante.toSeconds());
        long minutos = Math.max(1, (segundos + 59) / 60);
        throw new ApiException(ErrorCode.ACCOUNT_LOCKED, HttpStatus.LOCKED,
                "Muitas tentativas inválidas. Tente novamente em " + minutos + " minuto(s).", null, segundos);
    }

    private static String rotulo(User usuario) {
        return usuario.getName() + " <" + usuario.getEmail() + ">";
    }
}
