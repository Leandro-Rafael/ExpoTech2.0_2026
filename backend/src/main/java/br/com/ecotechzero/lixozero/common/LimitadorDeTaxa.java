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
public class LimitadorDeTaxa {

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

        final int capacidade;
        final Duration periodoRecarga;

        Policy(int capacidade, Duration periodoRecarga) {
            this.capacidade = capacidade;
            this.periodoRecarga = periodoRecarga;
        }
    }

    public record Result(boolean allowed, long retryAfterSeconds) {
    }

    /** Teto de chaves em memória (~100 bytes cada: bem abaixo de 10 MB). */
    static final int MAX_BUCKETS = 50_000;
    private static final String CHAVE_EXCEDENTE = "*overflow*";

    private static final long INTERVALO_LIMPEZA_NANOS = Duration.ofSeconds(1).toNanos();

    private final Map<String, Bucket> baldes = new ConcurrentHashMap<>();
    private final AtomicLong ultimaLimpeza = new AtomicLong(System.nanoTime() - INTERVALO_LIMPEZA_NANOS * 2);

    public Result tentarConsumir(Policy politica, String chave) {
        String chaveCompleta = politica.name() + ':' + chave;
        Bucket balde = baldes.get(chaveCompleta);
        if (balde == null) {
            long agora = System.nanoTime();
            long ultima = ultimaLimpeza.get();
            // limpeza sob demanda no máximo 1x por segundo (varrer o mapa a cada requisição seria outro vetor de DoS)
            if (baldes.size() >= MAX_BUCKETS && agora - ultima > INTERVALO_LIMPEZA_NANOS && ultimaLimpeza.compareAndSet(ultima, agora)) {
                removerOciosos();
            }
            if (baldes.size() >= MAX_BUCKETS) {
                chaveCompleta = politica.name() + ':' + CHAVE_EXCEDENTE;
            }
            balde = baldes.computeIfAbsent(chaveCompleta, k -> new Bucket(politica));
        }
        return balde.tentarConsumir(System.nanoTime());
    }

    /** Quantidade de baldes em memória (monitoramento e testes). */
    int tamanho() {
        return baldes.size();
    }

    /** Lança 429 (RATE_LIMITED) quando o limite é excedido. */
    public void verificar(Policy politica, String chave) {
        Result resultado = tentarConsumir(politica, chave == null ? "unknown" : chave);
        if (!resultado.allowed()) {
            throw ExcecaoApi.limiteExcedido(resultado.retryAfterSeconds());
        }
    }

    /** Remove baldes cheios (ociosos) a cada 10 minutos para o mapa não crescer indefinidamente. */
    @Scheduled(fixedDelay = 600_000)
    public void removerOciosos() {
        long agora = System.nanoTime();
        baldes.values().removeIf(b -> b.estaCheio(agora));
    }

    /** Reinicia todos os baldes (uso em testes). */
    public void reiniciar() {
        baldes.clear();
    }

    private static final class Bucket {
        private final int capacidade;
        private final double recargaPorNano;
        private double fichas;
        private long ultimaRecarga;

        Bucket(Policy politica) {
            this.capacidade = politica.capacidade;
            this.recargaPorNano = politica.capacidade / (double) politica.periodoRecarga.toNanos();
            this.fichas = politica.capacidade;
            this.ultimaRecarga = System.nanoTime();
        }

        synchronized Result tentarConsumir(long agora) {
            recarregar(agora);
            if (fichas >= 1) {
                fichas -= 1;
                return new Result(true, 0);
            }
            long nanosAteProximaFicha = (long) Math.ceil((1 - fichas) / recargaPorNano);
            return new Result(false, Math.max(1, Duration.ofNanos(nanosAteProximaFicha).toSeconds() + 1));
        }

        synchronized boolean estaCheio(long agora) {
            recarregar(agora);
            return fichas >= capacidade;
        }

        private void recarregar(long agora) {
            long decorrido = agora - ultimaRecarga;
            if (decorrido > 0) {
                fichas = Math.min(capacidade, fichas + decorrido * recargaPorNano);
                ultimaRecarga = agora;
            }
        }
    }
}
