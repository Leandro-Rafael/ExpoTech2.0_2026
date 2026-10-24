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

    private static final String BAD_CREDENTIALS = "E-mail ou senha incorretos.";

    private final UserRepository users;
    private final UserService userService;
    private final PasswordEncoder encoder;
    private final PasswordPolicy passwordPolicy;
    private final JwtService jwtService;
    private final RefreshTokenService refreshTokens;
    private final LoginAttemptService loginAttempts;
    private final AuthCookies cookies;
    private final AuditService audit;
    private final TokenBucketRateLimiter limiter;
    private final Clock clock;
    /** Hash fictício: comparamos a senha mesmo quando o e-mail não existe (tempo de resposta uniforme). */
    private final String dummyHash;

    public AuthService(UserRepository users, UserService userService, PasswordEncoder encoder, PasswordPolicy passwordPolicy,
                       JwtService jwtService, RefreshTokenService refreshTokens, LoginAttemptService loginAttempts,
                       AuthCookies cookies, AuditService audit, TokenBucketRateLimiter limiter, Clock clock) {
        this.users = users;
        this.userService = userService;
        this.encoder = encoder;
        this.passwordPolicy = passwordPolicy;
        this.jwtService = jwtService;
        this.refreshTokens = refreshTokens;
        this.loginAttempts = loginAttempts;
        this.cookies = cookies;
        this.audit = audit;
        this.limiter = limiter;
        this.clock = clock;
        this.dummyHash = encoder.encode(UUID.randomUUID().toString());
    }

    public UserMe register(AuthDtos.RegisterRequest req, HttpServletRequest request, HttpServletResponse response) {
        limiter.check(Policy.REGISTER_IP, RequestContext.clientIp(request));
        String email = Text.normalizeEmail(req.email());
        String name = Text.clean(req.name());
        if (name == null || name.length() < 2) {
            throw ApiException.field("name", "informe seu nome");
        }
        passwordPolicy.validate("password", req.password(), email);
        User user = userService.createUser(name, email, encoder.encode(req.password()), Role.USER);
        audit.recordAs(user.getId(), label(user), AuditAction.USER_REGISTERED, "User", user.getId(), null);
        startSession(user, request, response);
        return userService.getMe(user.getId());
    }

    public UserMe login(AuthDtos.LoginRequest req, HttpServletRequest request, HttpServletResponse response) {
        String ip = RequestContext.clientIp(request);
        limiter.check(Policy.LOGIN_IP, ip);
        String email = Text.normalizeEmail(req.email());
        limiter.check(Policy.LOGIN_EMAIL, email);

        Optional<User> found = users.findByEmail(email);
        User user = found.orElse(null);
        loginAttempts.lockRemaining(email, user).ifPresent(this::throwLocked);

        boolean passwordOk;
        if (user != null) {
            passwordOk = encoder.matches(req.password(), user.getPasswordHash());
        } else {
            encoder.matches(req.password(), dummyHash); // mesmo custo de CPU: não revela se o e-mail existe
            passwordOk = false;
        }

        if (!passwordOk) {
            boolean lockedNow = loginAttempts.recordFailure(email, user);
            audit.recordAs(user == null ? null : user.getId(), Text.truncate(email, 160), AuditAction.LOGIN_FAILED, "User",
                    user == null ? null : user.getId(), user == null ? "e-mail não cadastrado" : "senha incorreta");
            if (lockedNow) {
                audit.recordAs(user == null ? null : user.getId(), Text.truncate(email, 160), AuditAction.ACCOUNT_LOCKED,
                        "User", user == null ? null : user.getId(), "bloqueio por " + LoginAttemptService.LOCK_DURATION.toMinutes() + " min");
                throwLocked(LoginAttemptService.LOCK_DURATION);
            }
            throw new ApiException(ErrorCode.BAD_CREDENTIALS, BAD_CREDENTIALS);
        }
        if (!user.isEnabled()) {
            audit.recordAs(user.getId(), label(user), AuditAction.LOGIN_DISABLED_ACCOUNT, "User", user.getId(), null);
            throw new ApiException(ErrorCode.FORBIDDEN, "Esta conta está desativada. Procure o administrador.");
        }
        // bloqueio por inspeção: checado só DEPOIS da senha correta (não revela a terceiros que a conta existe)
        Instant now = clock.instant();
        if (user.isSecurityLocked(now)) {
            audit.recordAs(user.getId(), label(user), AuditAction.LOGIN_BLOCKED_INSPECTION, "User", user.getId(),
                    "bloqueado até " + user.getSecurityLockedUntil());
            throw InspectionService.lockedException(user.getSecurityLockedUntil(), now);
        }
        loginAttempts.recordSuccess(email, user);
        startSession(user, request, response);
        audit.recordAs(user.getId(), label(user), AuditAction.LOGIN_SUCCESS, "User", user.getId(), null);
        return userService.getMe(user.getId());
    }

    public UserMe refresh(HttpServletRequest request, HttpServletResponse response) {
        limiter.check(Policy.REFRESH_IP, RequestContext.clientIp(request));
        String raw = AuthCookies.read(request, AuthCookies.REFRESH)
                .orElseThrow(() -> new ApiException(ErrorCode.UNAUTHORIZED, "Sessão expirada. Faça login novamente."));
        RefreshTokenService.Rotation rotation = refreshTokens.rotate(raw);
        Instant now = clock.instant();
        if (rotation.user() != null && rotation.user().isSecurityLocked(now)) {
            cookies.clear(request, response);
            throw InspectionService.lockedException(rotation.user().getSecurityLockedUntil(), now);
        }
        switch (rotation.outcome()) {
            case ROTATED -> {
                User user = rotation.user();
                cookies.writeSession(request, response, jwtService.issueAccessToken(user), rotation.newRawToken());
                return userService.getMe(user.getId());
            }
            case REUSE_DETECTED -> audit.recordAs(rotation.user().getId(), label(rotation.user()), AuditAction.REFRESH_TOKEN_REUSE,
                    "User", rotation.user().getId(), "refresh token reutilizado: todas as sessões desta família foram revogadas");
            case INVALID -> {
                // nada a auditar
            }
        }
        cookies.clear(request, response);
        throw new ApiException(ErrorCode.UNAUTHORIZED, "Sessão expirada. Faça login novamente.");
    }

    public void logout(UUID currentUserId, HttpServletRequest request, HttpServletResponse response) {
        AuthCookies.read(request, AuthCookies.REFRESH).ifPresent(refreshTokens::revokeFamilyOf);
        cookies.clear(request, response);
        if (currentUserId != null) {
            audit.record(AuditAction.LOGOUT, "User", currentUserId, null);
        }
    }

    /** Troca de senha: revoga TODAS as sessões e abre uma nova apenas para este navegador. */
    public void changePassword(UUID userId, AuthDtos.ChangePasswordRequest req, HttpServletRequest request, HttpServletResponse response) {
        limiter.check(Policy.PASSWORD_CHANGE_USER, userId.toString());
        User user = users.findById(userId).orElseThrow(() -> new ApiException(ErrorCode.UNAUTHORIZED, "Sessão inválida."));
        if (!encoder.matches(req.currentPassword(), user.getPasswordHash())) {
            throw ApiException.field("currentPassword", "senha atual incorreta");
        }
        if (req.currentPassword().equals(req.newPassword())) {
            throw ApiException.field("newPassword", "a nova senha deve ser diferente da atual");
        }
        passwordPolicy.validate("newPassword", req.newPassword(), user.getEmail());
        User updated = userService.updatePassword(userId, encoder.encode(req.newPassword()));
        refreshTokens.revokeAllForUser(userId, RefreshToken.REASON_PASSWORD);
        startSession(updated, request, response);
        audit.record(AuditAction.PASSWORD_CHANGED, "User", userId, "demais sessões encerradas");
    }

    private void startSession(User user, HttpServletRequest request, HttpServletResponse response) {
        RefreshTokenService.Issued refresh = refreshTokens.issue(user, null);
        cookies.writeSession(request, response, jwtService.issueAccessToken(user), refresh.rawToken());
    }

    private void throwLocked(Duration remaining) {
        long seconds = Math.max(1, remaining.toSeconds());
        long minutes = Math.max(1, (seconds + 59) / 60);
        throw new ApiException(ErrorCode.ACCOUNT_LOCKED, HttpStatus.LOCKED,
                "Muitas tentativas inválidas. Tente novamente em " + minutes + " minuto(s).", null, seconds);
    }

    private static String label(User user) {
        return user.getName() + " <" + user.getEmail() + ">";
    }
}
