package br.com.ecotechzero.lixozero.auth;

import br.com.ecotechzero.lixozero.user.User;
import br.com.ecotechzero.lixozero.user.UserRepository;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Bloqueio de conta contra força bruta: 5 senhas erradas seguidas -> 15 minutos bloqueada.
 * <p>
 * O contador é mantido por e-mail em memória para TODOS os e-mails (inclusive inexistentes), de modo
 * que o comportamento seja idêntico e não revele quais contas existem. Para contas reais, o estado
 * também é gravado no banco (visível no painel admin e preservado após reinício).
 */
@Service
public class LoginAttemptService {

    public static final int MAX_FAILURES = 5;
    public static final Duration LOCK_DURATION = Duration.ofMinutes(15);
    /** Teto de e-mails acompanhados em memória (o rate limit por IP já limita o ritmo de novas entradas). */
    static final int MAX_TRACKED = 50_000;

    private record Attempt(int failures, Instant lastFailure, Instant lockedUntil) {
    }

    private final Map<String, Attempt> attempts = new ConcurrentHashMap<>();
    private final UserRepository users;
    private final Clock clock;

    public LoginAttemptService(UserRepository users, Clock clock) {
        this.users = users;
        this.clock = clock;
    }

    /** Tempo restante de bloqueio, se houver. */
    public Optional<Duration> lockRemaining(String email, User user) {
        Instant now = clock.instant();
        Instant until = null;
        Attempt a = attempts.get(email);
        if (a != null && a.lockedUntil() != null && a.lockedUntil().isAfter(now)) {
            until = a.lockedUntil();
        }
        if (user != null && user.isLocked(now) && (until == null || user.getLockedUntil().isAfter(until))) {
            until = user.getLockedUntil();
        }
        return until == null ? Optional.empty() : Optional.of(Duration.between(now, until));
    }

    /** Registra uma falha. Devolve true se esta falha disparou o bloqueio. */
    @Transactional
    public boolean recordFailure(String email, User user) {
        Instant now = clock.instant();
        if (attempts.size() >= MAX_TRACKED && !attempts.containsKey(email)) {
            evictStale(); // memória limitada: e-mails inventados não podem crescer o mapa sem fim
            if (attempts.size() >= MAX_TRACKED) {
                // ainda cheio: descarta contadores parciais (bloqueios ativos e o estado no banco são mantidos)
                attempts.values().removeIf(a -> a.lockedUntil() == null);
            }
        }
        Attempt updated = attempts.compute(email, (k, old) -> {
            int previous = old == null || old.lastFailure().plus(LOCK_DURATION).isBefore(now) ? 0 : old.failures();
            int failures = previous + 1;
            Instant lockedUntil = failures >= MAX_FAILURES ? now.plus(LOCK_DURATION) : null;
            return new Attempt(lockedUntil != null ? 0 : failures, now, lockedUntil);
        });
        if (user != null) {
            users.updateLoginFailures(user.getId(), updated.lockedUntil() != null ? MAX_FAILURES : updated.failures(), updated.lockedUntil());
        }
        return updated.lockedUntil() != null;
    }

    @Transactional
    public void recordSuccess(String email, User user) {
        attempts.remove(email);
        users.registerSuccessfulLogin(user.getId(), clock.instant());
    }

    /** Usado pelo admin ao reativar uma conta. */
    public void clear(String email) {
        attempts.remove(email);
    }

    @Scheduled(fixedDelay = 600_000)
    public void evictStale() {
        Instant cutoff = clock.instant().minus(LOCK_DURATION);
        attempts.values().removeIf(a -> a.lastFailure().isBefore(cutoff)
                && (a.lockedUntil() == null || a.lockedUntil().isBefore(clock.instant())));
    }
}
