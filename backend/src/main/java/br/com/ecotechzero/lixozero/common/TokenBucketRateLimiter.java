package br.com.ecotechzero.lixozero.common;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Rate limiter em memória pelo algoritmo Token Bucket.
 * Cada chave (ex.: IP ou e-mail) tem um "balde" com capacidade N fichas que se recarrega
 * continuamente; cada requisição consome uma ficha. Sem fichas -> HTTP 429 com Retry-After.
 * <p>
 * Memória limitada: as chaves vêm do cliente (IP, e-mail digitado, id de dispositivo), então um atacante
 * poderia criar milhões de baldes. Acima de {@link #MAX_BUCKETS} chaves, os baldes ociosos são removidos na
 * hora; se ainda assim o mapa estiver cheio, as chaves novas passam a dividir um balde "overflow" da política
 * (continua limitando, só que de forma coletiva) até a próxima limpeza.
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
        HOUSEHOLD_JOIN_USER(10, Duration.ofMinutes(10)),
        IOT_DEVICE(12, Duration.ofMinutes(1)),
        SIMULATION_IP(60, Duration.ofMinutes(1)),
        IOT_IP(120, Duration.ofMinutes(1)),
        INSPECTION_EVENT_USER(20, Duration.ofMinutes(1)),
        INTEGRITY_CHECK_USER(6, Duration.ofMinutes(1));

        final int capacity;
        final Duration refillPeriod;

        Policy(int capacity, Duration refillPeriod) {
            this.capacity = capacity;
            this.refillPeriod = refillPeriod;
        }
    }

    public record Result(boolean allowed, long retryAfterSeconds) {
    }

    /** Teto de chaves em memória (~100 bytes cada: bem abaixo de 10 MB). */
    static final int MAX_BUCKETS = 50_000;
    private static final String OVERFLOW_KEY = "*overflow*";

    private static final long EVICTION_INTERVAL_NANOS = Duration.ofSeconds(1).toNanos();

    private final Map<String, Bucket> buckets = new ConcurrentHashMap<>();
    private final AtomicLong lastEviction = new AtomicLong(System.nanoTime() - EVICTION_INTERVAL_NANOS * 2);

    public Result tryConsume(Policy policy, String key) {
        String fullKey = policy.name() + ':' + key;
        Bucket bucket = buckets.get(fullKey);
        if (bucket == null) {
            long now = System.nanoTime();
            long last = lastEviction.get();
            // limpeza sob demanda no máximo 1x por segundo (varrer o mapa a cada requisição seria outro vetor de DoS)
            if (buckets.size() >= MAX_BUCKETS && now - last > EVICTION_INTERVAL_NANOS && lastEviction.compareAndSet(last, now)) {
                evictIdle();
            }
            if (buckets.size() >= MAX_BUCKETS) {
                fullKey = policy.name() + ':' + OVERFLOW_KEY;
            }
            bucket = buckets.computeIfAbsent(fullKey, k -> new Bucket(policy));
        }
        return bucket.tryConsume(System.nanoTime());
    }

    /** Quantidade de baldes em memória (monitoramento e testes). */
    int size() {
        return buckets.size();
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
