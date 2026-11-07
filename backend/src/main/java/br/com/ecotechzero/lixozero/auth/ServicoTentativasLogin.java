package br.com.ecotechzero.lixozero.auth;

import br.com.ecotechzero.lixozero.user.User;
import br.com.ecotechzero.lixozero.user.RepositorioUsuarios;
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
public class ServicoTentativasLogin {

    public static final int MAX_FAILURES = 5;
    public static final Duration LOCK_DURATION = Duration.ofMinutes(15);
    /** Teto de e-mails acompanhados em memória (o rate limit por IP já limita o ritmo de novas entradas). */
    static final int MAX_TRACKED = 50_000;

    private record Attempt(int falhas, Instant ultimaFalha, Instant bloqueadoAte) {
    }

    private final Map<String, Attempt> tentativas = new ConcurrentHashMap<>();
    private final RepositorioUsuarios usuarios;
    private final Clock relogio;

    public ServicoTentativasLogin(RepositorioUsuarios usuarios, Clock relogio) {
        this.usuarios = usuarios;
        this.relogio = relogio;
    }

    /** Tempo restante de bloqueio, se houver. */
    public Optional<Duration> tempoBloqueioRestante(String email, User usuario) {
        Instant agora = relogio.instant();
        Instant ate = null;
        Attempt a = tentativas.get(email);
        if (a != null && a.bloqueadoAte() != null && a.bloqueadoAte().isAfter(agora)) {
            ate = a.bloqueadoAte();
        }
        if (usuario != null && usuario.isLocked(agora) && (ate == null || usuario.getLockedUntil().isAfter(ate))) {
            ate = usuario.getLockedUntil();
        }
        return ate == null ? Optional.empty() : Optional.of(Duration.between(agora, ate));
    }

    /** Registra uma falha. Devolve true se esta falha disparou o bloqueio. */
    @Transactional
    public boolean registrarFalha(String email, User usuario) {
        Instant agora = relogio.instant();
        if (tentativas.size() >= MAX_TRACKED && !tentativas.containsKey(email)) {
            removerAntigas(); // memória limitada: e-mails inventados não podem crescer o mapa sem fim
            if (tentativas.size() >= MAX_TRACKED) {
                // ainda cheio: descarta contadores parciais (bloqueios ativos e o estado no banco são mantidos)
                tentativas.values().removeIf(a -> a.bloqueadoAte() == null);
            }
        }
        Attempt atualizada = tentativas.compute(email, (k, anterior) -> {
            int falhasAnteriores = anterior == null || anterior.ultimaFalha().plus(LOCK_DURATION).isBefore(agora) ? 0 : anterior.falhas();
            int falhas = falhasAnteriores + 1;
            Instant bloqueadoAte = falhas >= MAX_FAILURES ? agora.plus(LOCK_DURATION) : null;
            return new Attempt(bloqueadoAte != null ? 0 : falhas, agora, bloqueadoAte);
        });
        if (usuario != null) {
            usuarios.updateLoginFailures(usuario.getId(), atualizada.bloqueadoAte() != null ? MAX_FAILURES : atualizada.falhas(), atualizada.bloqueadoAte());
        }
        return atualizada.bloqueadoAte() != null;
    }

    @Transactional
    public void registrarSucesso(String email, User usuario) {
        tentativas.remove(email);
        usuarios.registerSuccessfulLogin(usuario.getId(), relogio.instant());
    }

    /** Usado pelo admin ao reativar uma conta. */
    public void limpar(String email) {
        tentativas.remove(email);
    }

    @Scheduled(fixedDelay = 600_000)
    public void removerAntigas() {
        Instant limite = relogio.instant().minus(LOCK_DURATION);
        tentativas.values().removeIf(a -> a.ultimaFalha().isBefore(limite)
                && (a.bloqueadoAte() == null || a.bloqueadoAte().isBefore(relogio.instant())));
    }
}
