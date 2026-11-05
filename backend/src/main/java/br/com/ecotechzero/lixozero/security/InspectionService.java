package br.com.ecotechzero.lixozero.security;

import br.com.ecotechzero.lixozero.audit.AuditAction;
import br.com.ecotechzero.lixozero.audit.AuditService;
import br.com.ecotechzero.lixozero.auth.RefreshToken;
import br.com.ecotechzero.lixozero.auth.RefreshTokenService;
import br.com.ecotechzero.lixozero.common.ApiException;
import br.com.ecotechzero.lixozero.common.ErrorCode;
import br.com.ecotechzero.lixozero.common.TokenBucketRateLimiter;
import br.com.ecotechzero.lixozero.user.User;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

/**
 * Dissuasão de inspeção do sistema (DevTools, Ctrl+U) na área logada.
 * <p>
 * O navegador só AVISA o servidor; quem conta os avisos e aplica o bloqueio é o back-end (fonte da verdade):
 * eventos do mesmo usuário a menos de 5 s do último aviso contado valem como um só (F12 + detector de
 * DevTools aberto), o 3º aviso bloqueia o acesso por 30 minutos e encerra TODAS as sessões. Enquanto bloqueado,
 * login, refresh e qualquer requisição autenticada recebem 423 ({@link JwtAuthenticationFilter}).
 * <p>
 * Limite honesto: bloquear o inspetor no navegador é só um impedimento; a proteção real dos dados está nas
 * regras do servidor (autorização, validação, antifraude, integridade).
 */
@Service
public class InspectionService {

    public static final int MAX_WARNINGS = 3;
    public static final Duration LOCK_DURATION = Duration.ofMinutes(30);
    static final Duration DEDUPE_WINDOW = Duration.ofSeconds(5);
    public static final String LOCK_MESSAGE = "Acesso bloqueado por 30 minutos por tentativa de inspeção do sistema.";

    public enum Trigger { F12, CTRL_SHIFT_I, CTRL_SHIFT_J, CTRL_SHIFT_C, CTRL_U, CONTEXT_MENU, DEVTOOLS_OPEN }

    public record InspectionEventRequest(@NotNull Trigger trigger) {
    }

    public record InspectionEventResult(int warnings, int maxWarnings, boolean locked, Instant lockedUntil) {
    }

    private final EntityManager em;
    private final RefreshTokenService refreshTokens;
    private final AuditService audit;
    private final TokenBucketRateLimiter limiter;
    private final Clock clock;

    public InspectionService(EntityManager em, RefreshTokenService refreshTokens, AuditService audit,
                             TokenBucketRateLimiter limiter, Clock clock) {
        this.em = em;
        this.refreshTokens = refreshTokens;
        this.audit = audit;
        this.limiter = limiter;
        this.clock = clock;
    }

    @Transactional
    public InspectionEventResult report(UUID userId, Trigger trigger) {
        limiter.check(TokenBucketRateLimiter.Policy.INSPECTION_EVENT_USER, userId.toString());
        // 1. Trava a linha do usuário para avisos de várias abas contarem um de cada vez.
        User user = em.find(User.class, userId);
        if (user == null) {
            throw new ApiException(ErrorCode.UNAUTHORIZED, "Sessão inválida.");
        }
        em.refresh(user, LockModeType.PESSIMISTIC_WRITE); // eventos simultâneos (várias abas) contam em sequência
        Instant now = clock.instant();
        // 2. Se já está bloqueado, ou o aviso veio a menos de 5 s do anterior (mesmo gesto), não conta de novo.
        user.clearExpiredSecurityLock(now);
        if (user.isSecurityLocked(now)) {
            return result(user, now);
        }
        Instant last = user.getSecurityLastEventAt();
        if (last != null && last.plus(DEDUPE_WINDOW).isAfter(now)) {
            return result(user, now); // mesmo gesto (ex.: F12 + DevTools aberto): já contado
        }
        // 3. Conta o aviso e audita; o 3º bloqueia por 30 minutos.
        boolean lockedNow = user.registerSecurityWarning(now, MAX_WARNINGS, LOCK_DURATION);
        audit.record(AuditAction.SECURITY_INSPECTION_WARNING, "User", userId,
                "aviso " + user.getSecurityWarnings() + " de " + MAX_WARNINGS + " (" + trigger + ")");
        // 4. No bloqueio, derruba todas as sessões do usuário.
        if (lockedNow) {
            refreshTokens.revokeAllForUser(userId, RefreshToken.REASON_SECURITY);
            audit.record(AuditAction.SECURITY_INSPECTION_LOCK, "User", userId,
                    "acesso bloqueado até " + user.getSecurityLockedUntil() + "; sessões encerradas");
        }
        return result(user, now);
    }

    private static InspectionEventResult result(User user, Instant now) {
        boolean locked = user.isSecurityLocked(now);
        return new InspectionEventResult(user.activeSecurityWarnings(now), MAX_WARNINGS, locked,
                locked ? user.getSecurityLockedUntil() : null);
    }

    /** Resposta 423 padronizada (login, refresh e requisições autenticadas). */
    public static ApiException lockedException(Instant lockedUntil, Instant now) {
        return new ApiException(ErrorCode.ACCOUNT_LOCKED, HttpStatus.LOCKED, LOCK_MESSAGE, null, retryAfterSeconds(lockedUntil, now));
    }

    public static long retryAfterSeconds(Instant lockedUntil, Instant now) {
        return Math.max(1, Duration.between(now, lockedUntil).toSeconds() + 1);
    }
}
