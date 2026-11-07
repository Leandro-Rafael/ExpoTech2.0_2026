package br.com.ecotechzero.lixozero.auth;

import br.com.ecotechzero.lixozero.audit.AcaoAuditoria;
import br.com.ecotechzero.lixozero.audit.ServicoAuditoria;
import br.com.ecotechzero.lixozero.common.ExcecaoApi;
import br.com.ecotechzero.lixozero.common.CodigoErro;
import br.com.ecotechzero.lixozero.common.ContextoRequisicao;
import br.com.ecotechzero.lixozero.common.Textos;
import br.com.ecotechzero.lixozero.common.LimitadorDeTaxa;
import br.com.ecotechzero.lixozero.common.LimitadorDeTaxa.Policy;
import br.com.ecotechzero.lixozero.security.CookiesAutenticacao;
import br.com.ecotechzero.lixozero.security.ServicoInspecao;
import br.com.ecotechzero.lixozero.security.ServicoJwt;
import br.com.ecotechzero.lixozero.security.PoliticaSenha;
import br.com.ecotechzero.lixozero.user.PerfilUsuario;
import br.com.ecotechzero.lixozero.user.User;
import br.com.ecotechzero.lixozero.user.DtosUsuario.UserMe;
import br.com.ecotechzero.lixozero.user.RepositorioUsuarios;
import br.com.ecotechzero.lixozero.user.ServicoUsuarios;
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
public class ServicoAutenticacao {

    private static final String CREDENCIAIS_INVALIDAS = "E-mail ou senha incorretos.";

    private final RepositorioUsuarios usuarios;
    private final ServicoUsuarios servicoUsuario;
    private final PasswordEncoder codificador;
    private final PoliticaSenha politicaSenha;
    private final ServicoJwt servicoJwt;
    private final ServicoTokensRenovacao tokensRenovacao;
    private final ServicoTentativasLogin tentativasLogin;
    private final CookiesAutenticacao cookies;
    private final ServicoAuditoria auditoria;
    private final LimitadorDeTaxa limitador;
    private final Clock relogio;
    /** Hash fictício: comparamos a senha mesmo quando o e-mail não existe (tempo de resposta uniforme). */
    private final String hashFicticio;

    public ServicoAutenticacao(RepositorioUsuarios usuarios, ServicoUsuarios servicoUsuario, PasswordEncoder codificador, PoliticaSenha politicaSenha,
                       ServicoJwt servicoJwt, ServicoTokensRenovacao tokensRenovacao, ServicoTentativasLogin tentativasLogin,
                       CookiesAutenticacao cookies, ServicoAuditoria auditoria, LimitadorDeTaxa limitador, Clock relogio) {
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

    public UserMe cadastrar(DtosAutenticacao.RegisterRequest dados, HttpServletRequest request, HttpServletResponse response) {
        // 1. Limita cadastros por IP e valida nome e força da senha.
        limitador.verificar(Policy.REGISTER_IP, ContextoRequisicao.ipCliente(request));
        String email = Textos.normalizarEmail(dados.email());
        String nome = Textos.limpar(dados.name());
        if (nome == null || nome.length() < 2) {
            throw ExcecaoApi.campo("name", "informe seu nome");
        }
        politicaSenha.validar("password", dados.password(), email);
        // 2. Cria a conta como morador (USER); no banco vai só o hash da senha.
        User usuario = servicoUsuario.criarUsuario(nome, email, codificador.encode(dados.password()), PerfilUsuario.USER);
        auditoria.registrarComo(usuario.getId(), rotulo(usuario), AcaoAuditoria.USER_REGISTERED, "User", usuario.getId(), null);
        // 3. Já abre a sessão, então a pessoa sai do cadastro logada.
        iniciarSessao(usuario, request, response);
        return servicoUsuario.buscarPerfil(usuario.getId());
    }

    public UserMe entrar(DtosAutenticacao.LoginRequest dados, HttpServletRequest request, HttpServletResponse response) {
        // 1. Limite de tentativas por IP e por e-mail, para frear robô testando senha.
        String ip = ContextoRequisicao.ipCliente(request);
        limitador.verificar(Policy.LOGIN_IP, ip);
        String email = Textos.normalizarEmail(dados.email());
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
            auditoria.registrarComo(usuario == null ? null : usuario.getId(), Textos.truncar(email, 160), AcaoAuditoria.LOGIN_FAILED, "User",
                    usuario == null ? null : usuario.getId(), usuario == null ? "e-mail não cadastrado" : "senha incorreta");
            if (bloqueouAgora) {
                auditoria.registrarComo(usuario == null ? null : usuario.getId(), Textos.truncar(email, 160), AcaoAuditoria.ACCOUNT_LOCKED,
                        "User", usuario == null ? null : usuario.getId(), "bloqueio por " + ServicoTentativasLogin.LOCK_DURATION.toMinutes() + " min");
                lancarBloqueio(ServicoTentativasLogin.LOCK_DURATION);
            }
            throw new ExcecaoApi(CodigoErro.BAD_CREDENTIALS, CREDENCIAIS_INVALIDAS);
        }
        // 4. Mesmo com a senha certa, conta desativada ou bloqueada por inspeção não entra.
        if (!usuario.isEnabled()) {
            auditoria.registrarComo(usuario.getId(), rotulo(usuario), AcaoAuditoria.LOGIN_DISABLED_ACCOUNT, "User", usuario.getId(), null);
            throw new ExcecaoApi(CodigoErro.FORBIDDEN, "Esta conta está desativada. Procure o administrador.");
        }
        // bloqueio por inspeção: checado só DEPOIS da senha correta (não revela a terceiros que a conta existe)
        Instant agora = relogio.instant();
        if (usuario.isSecurityLocked(agora)) {
            auditoria.registrarComo(usuario.getId(), rotulo(usuario), AcaoAuditoria.LOGIN_BLOCKED_INSPECTION, "User", usuario.getId(),
                    "bloqueado até " + usuario.getSecurityLockedUntil());
            throw ServicoInspecao.excecaoBloqueio(usuario.getSecurityLockedUntil(), agora);
        }
        // 5. Deu certo: zera as falhas, grava os cookies da sessão e registra na auditoria.
        tentativasLogin.registrarSucesso(email, usuario);
        iniciarSessao(usuario, request, response);
        auditoria.registrarComo(usuario.getId(), rotulo(usuario), AcaoAuditoria.LOGIN_SUCCESS, "User", usuario.getId(), null);
        return servicoUsuario.buscarPerfil(usuario.getId());
    }

    public UserMe renovar(HttpServletRequest request, HttpServletResponse response) {
        limitador.verificar(Policy.REFRESH_IP, ContextoRequisicao.ipCliente(request));
        String tokenBruto = CookiesAutenticacao.ler(request, CookiesAutenticacao.REFRESH)
                .orElseThrow(() -> new ExcecaoApi(CodigoErro.UNAUTHORIZED, "Sessão expirada. Faça login novamente."));
        // 1. O JWT de acesso dura pouco. Aqui o refresh token do cookie é trocado por um novo (cada um só vale uma vez).
        ServicoTokensRenovacao.Rotation rotacao = tokensRenovacao.rotacionar(tokenBruto);
        Instant agora = relogio.instant();
        if (rotacao.user() != null && rotacao.user().isSecurityLocked(agora)) {
            cookies.limpar(request, response);
            throw ServicoInspecao.excecaoBloqueio(rotacao.user().getSecurityLockedUntil(), agora);
        }
        // 2. Se um token já usado aparece de novo, provavelmente foi roubado: a família toda é revogada e auditada.
        switch (rotacao.outcome()) {
            case ROTATED -> {
                User usuario = rotacao.user();
                cookies.gravarSessao(request, response, servicoJwt.emitirTokenAcesso(usuario), rotacao.newRawToken());
                return servicoUsuario.buscarPerfil(usuario.getId());
            }
            case REUSE_DETECTED -> auditoria.registrarComo(rotacao.user().getId(), rotulo(rotacao.user()), AcaoAuditoria.REFRESH_TOKEN_REUSE,
                    "User", rotacao.user().getId(), "refresh token reutilizado: todas as sessões desta família foram revogadas");
            case INVALID -> {
                // nada a auditar
            }
        }
        cookies.limpar(request, response);
        throw new ExcecaoApi(CodigoErro.UNAUTHORIZED, "Sessão expirada. Faça login novamente.");
    }

    public void sair(UUID idUsuarioAtual, HttpServletRequest request, HttpServletResponse response) {
        CookiesAutenticacao.ler(request, CookiesAutenticacao.REFRESH).ifPresent(tokensRenovacao::revogarFamiliaDe);
        cookies.limpar(request, response);
        if (idUsuarioAtual != null) {
            auditoria.registrar(AcaoAuditoria.LOGOUT, "User", idUsuarioAtual, null);
        }
    }

    /** Troca de senha: revoga TODAS as sessões e abre uma nova apenas para este navegador. */
    public void trocarSenha(UUID idUsuario, DtosAutenticacao.ChangePasswordRequest dados, HttpServletRequest request, HttpServletResponse response) {
        limitador.verificar(Policy.PASSWORD_CHANGE_USER, idUsuario.toString());
        User usuario = usuarios.findById(idUsuario).orElseThrow(() -> new ExcecaoApi(CodigoErro.UNAUTHORIZED, "Sessão inválida."));
        if (!codificador.matches(dados.currentPassword(), usuario.getPasswordHash())) {
            throw ExcecaoApi.campo("currentPassword", "senha atual incorreta");
        }
        if (dados.currentPassword().equals(dados.newPassword())) {
            throw ExcecaoApi.campo("newPassword", "a nova senha deve ser diferente da atual");
        }
        politicaSenha.validar("newPassword", dados.newPassword(), usuario.getEmail());
        User atualizado = servicoUsuario.atualizarSenha(idUsuario, codificador.encode(dados.newPassword()));
        tokensRenovacao.revogarTodasDoUsuario(idUsuario, RefreshToken.REASON_PASSWORD);
        iniciarSessao(atualizado, request, response);
        auditoria.registrar(AcaoAuditoria.PASSWORD_CHANGED, "User", idUsuario, "demais sessões encerradas");
    }

    private void iniciarSessao(User usuario, HttpServletRequest request, HttpServletResponse response) {
        ServicoTokensRenovacao.Issued emitido = tokensRenovacao.emitir(usuario, null);
        cookies.gravarSessao(request, response, servicoJwt.emitirTokenAcesso(usuario), emitido.rawToken());
    }

    private void lancarBloqueio(Duration restante) {
        long segundos = Math.max(1, restante.toSeconds());
        long minutos = Math.max(1, (segundos + 59) / 60);
        throw new ExcecaoApi(CodigoErro.ACCOUNT_LOCKED, HttpStatus.LOCKED,
                "Muitas tentativas inválidas. Tente novamente em " + minutos + " minuto(s).", null, segundos);
    }

    private static String rotulo(User usuario) {
        return usuario.getName() + " <" + usuario.getEmail() + ">";
    }
}
