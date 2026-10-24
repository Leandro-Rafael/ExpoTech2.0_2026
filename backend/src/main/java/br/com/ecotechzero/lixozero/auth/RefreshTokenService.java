package br.com.ecotechzero.lixozero.auth;

import br.com.ecotechzero.lixozero.common.RequestContext;
import br.com.ecotechzero.lixozero.config.AppProperties;
import br.com.ecotechzero.lixozero.user.User;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Optional;
import java.util.UUID;

/**
 * Refresh tokens opacos com ROTAÇÃO e DETECÇÃO DE REUSO.
 * <ol>
 *   <li>Login gera um token aleatório de 256 bits; o banco guarda só o SHA-256.</li>
 *   <li>Cada /refresh invalida o token apresentado e emite outro da mesma família.</li>
 *   <li>Se um token já rotacionado reaparecer, alguém o copiou: a família inteira é revogada
 *       e o usuário precisa fazer login de novo.</li>
 * </ol>
 */
@Service
public class RefreshTokenService {

    private static final SecureRandom RANDOM = new SecureRandom();

    public enum Outcome { ROTATED, INVALID, REUSE_DETECTED }

    public record Issued(String rawToken, UUID familyId) {
    }

    public record Rotation(Outcome outcome, User user, String newRawToken) {
    }

    private final RefreshTokenRepository repository;
    private final AppProperties props;
    private final Clock clock;

    public RefreshTokenService(RefreshTokenRepository repository, AppProperties props, Clock clock) {
        this.repository = repository;
        this.props = props;
        this.clock = clock;
    }

    @Transactional
    public Issued issue(User user, UUID familyId) {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        String raw = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        UUID family = familyId != null ? familyId : UUID.randomUUID();
        repository.save(new RefreshToken(user, family, hash(raw), clock.instant().plus(props.jwt().refreshTtl()),
                RequestContext.currentIp(), RequestContext.currentUserAgent()));
        return new Issued(raw, family);
    }

    /**
     * Rotaciona o token. Não lança exceção: devolve o resultado para que a revogação da família
     * (em caso de reuso) seja efetivada (commit) antes de o chamador responder 401.
     */
    @Transactional
    public Rotation rotate(String rawToken) {
        Optional<RefreshToken> found = repository.findByHashForUpdate(hash(rawToken));
        if (found.isEmpty()) {
            return new Rotation(Outcome.INVALID, null, null);
        }
        RefreshToken token = found.get();
        User user = token.getUser();
        Instant now = clock.instant();

        if (token.isRevoked()) {
            if (RefreshToken.REASON_ROTATED.equals(token.getRevokedReason())) {
                Duration grace = props.jwt().refreshGrace();
                boolean withinGrace = !grace.isZero() && token.getRevokedAt().plus(grace).isAfter(now) && user.isEnabled();
                if (withinGrace) {
                    // requisições simultâneas legítimas (várias abas): tolera dentro da janela configurada
                    return new Rotation(Outcome.ROTATED, user, issue(user, token.getFamilyId()).rawToken());
                }
                repository.revokeFamily(token.getFamilyId(), now, RefreshToken.REASON_REUSE);
                return new Rotation(Outcome.REUSE_DETECTED, user, null);
            }
            return new Rotation(Outcome.INVALID, user, null);
        }
        if (token.isExpired(now) || !user.isEnabled() || user.isSecurityLocked(now)) {
            token.revoke(now, RefreshToken.REASON_LOGOUT);
            return new Rotation(Outcome.INVALID, user, null);
        }
        token.revoke(now, RefreshToken.REASON_ROTATED);
        return new Rotation(Outcome.ROTATED, user, issue(user, token.getFamilyId()).rawToken());
    }

    /** Logout: revoga a família do token apresentado. */
    @Transactional
    public void revokeFamilyOf(String rawToken) {
        repository.findByTokenHash(hash(rawToken))
                .ifPresent(t -> repository.revokeFamily(t.getFamilyId(), clock.instant(), RefreshToken.REASON_LOGOUT));
    }

    @Transactional
    public void revokeAllForUser(UUID userId, String reason) {
        repository.revokeAllForUser(userId, null, clock.instant(), reason);
    }

    /** Limpeza diária de tokens expirados há mais de um dia. */
    @Scheduled(cron = "0 30 3 * * *")
    @Transactional
    public void purgeExpired() {
        repository.deleteExpiredBefore(clock.instant().minus(Duration.ofDays(1)));
    }

    static String hash(String raw) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(raw.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
