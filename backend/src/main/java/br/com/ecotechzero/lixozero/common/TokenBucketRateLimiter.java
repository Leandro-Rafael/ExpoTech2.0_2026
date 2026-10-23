package br.com.ecotechzero.lixozero.common;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Rate limiter em memória pelo algoritmo Token Bucket.
 * Cada chave (ex.: IP ou e-mail) tem um "balde" com capacidade N fichas que se recarrega
 * continuamente; cada requisição consome uma ficha. Sem fichas -> HTTP 429 com Retry-After.
 */
@Component
public class TokenBucketRateLimiter {

    /** Políticas usadas na aplicação: capacidade e tempo para recarregar o balde inteiro. */
    public enum Policy {
        LOGIN_IP(30, Duration.ofMinutes(1)),
        LOGIN_EMAIL(10, Duration.ofMinutes(5)),
        REGISTER_IP(20, Duration.ofHours(1)),
        REFRESH_IP(60, Duration.ofMinutes(1)),
        PASSWORD_CHANGE_USER(5, Duration.ofMinutes(15)),
        API_IP(1200, Duration.ofMinutes(1)),
        PHOTO_UPLOAD_USER(30, Duration.ofMinutes(10)),
        DISPOSAL_USER(30, Duration.ofMinutes(10)),
        REDEEM_USER(10, Duration.ofMinutes(10)),
        COLLECTION_REQUEST_USER(10, Duration.ofHours(1)),
        IOT_DEVICE(12, Duration.ofMinutes(1)),
        SIMULATION_IP(60, Duration.ofMinutes(1));

        final int capacity;
        final Duration refillPeriod;

        Policy(int capacity, Duration refillPeriod) {
            this.capacity = capacity;
            this.refillPeriod = refillPeriod;
        }
    }

    public record Result(boolean allowed, long retryAfterSeconds) {
    }

    private final Map<String, Bucket> buckets = new ConcurrentHashMap<>();

    public Result tryConsume(Policy policy, String key) {
        Bucket bucket = buckets.computeIfAbsent(policy.name() + ':' + key, k -> new Bucket(policy));
        return bucket.tryConsume(System.nanoTime());
    }

    /** Lança 429 (RATE_LIMITED) quando o limite é excedido. */
    public void check(Policy policy, String key) {
        Result result = tryConsume(policy, key == null ? "unknown" : key);
        if (!result.allowed()) {
            throw ApiException.rateLimited(result.retryAfterSeconds());
        }
    }

    /** Remove baldes cheios (ociosos) a cada 10 minutos para o mapa não crescer indefinidamente. */
    @Scheduled(fixedDelay = 600_000)
    public void evictIdle() {
        long now = System.nanoTime();
        buckets.values().removeIf(b -> b.isFull(now));
    }

    /** Reinicia todos os baldes (uso em testes). */
    public void reset() {
        buckets.clear();
    }

    private static final class Bucket {
        private final int capacity;
        private final double refillPerNano;
        private double tokens;
        private long lastRefill;

        Bucket(Policy policy) {
            this.capacity = policy.capacity;
            this.refillPerNano = policy.capacity / (double) policy.refillPeriod.toNanos();
            this.tokens = policy.capacity;
            this.lastRefill = System.nanoTime();
        }

        synchronized Result tryConsume(long now) {
            refill(now);
            if (tokens >= 1) {
                tokens -= 1;
                return new Result(true, 0);
            }
            long nanosToNextToken = (long) Math.ceil((1 - tokens) / refillPerNano);
            return new Result(false, Math.max(1, Duration.ofNanos(nanosToNextToken).toSeconds() + 1));
        }

        synchronized boolean isFull(long now) {
            refill(now);
            return tokens >= capacity;
        }

        private void refill(long now) {
            long elapsed = now - lastRefill;
            if (elapsed > 0) {
                tokens = Math.min(capacity, tokens + elapsed * refillPerNano);
                lastRefill = now;
            }
        }
    }
}
