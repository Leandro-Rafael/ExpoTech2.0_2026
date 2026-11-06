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
    private final RefreshTokenService tokensRenovacao;
    private final AuditService auditoria;
    private final TokenBucketRateLimiter limitador;
    private final Clock relogio;

    public InspectionService(EntityManager em, RefreshTokenService tokensRenovacao, AuditService auditoria,
                             TokenBucketRateLimiter limitador, Clock relogio) {
        this.em = em;
        this.tokensRenovacao = tokensRenovacao;
        this.auditoria = auditoria;
        this.limitador = limitador;
        this.relogio = relogio;
    }

    @Transactional
    public InspectionEventResult registrarAviso(UUID idUsuario, Trigger gatilho) {
        limitador.verificar(TokenBucketRateLimiter.Policy.INSPECTION_EVENT_USER, idUsuario.toString());
        // 1. Trava a linha do usuário para avisos de várias abas contarem um de cada vez.
        User usuario = em.find(User.class, idUsuario);
        if (usuario == null) {
            throw new ApiException(ErrorCode.UNAUTHORIZED, "Sessão inválida.");
        }
        em.refresh(usuario, LockModeType.PESSIMISTIC_WRITE); // eventos simultâneos (várias abas) contam em sequência
        Instant agora = relogio.instant();
        // 2. Se já está bloqueado, ou o aviso veio a menos de 5 s do anterior (mesmo gesto), não conta de novo.
        usuario.clearExpiredSecurityLock(agora);
        if (usuario.isSecurityLocked(agora)) {
            return resultado(usuario, agora);
        }
        Instant ultimo = usuario.getSecurityLastEventAt();
        if (ultimo != null && ultimo.plus(DEDUPE_WINDOW).isAfter(agora)) {
            return resultado(usuario, agora); // mesmo gesto (ex.: F12 + DevTools aberto): já contado
        }
        // 3. Conta o aviso e audita; o 3º bloqueia por 30 minutos.
        boolean bloqueouAgora = usuario.registerSecurityWarning(agora, MAX_WARNINGS, LOCK_DURATION);
        auditoria.registrar(AuditAction.SECURITY_INSPECTION_WARNING, "User", idUsuario,
                "aviso " + usuario.getSecurityWarnings() + " de " + MAX_WARNINGS + " (" + gatilho + ")");
        // 4. No bloqueio, derruba todas as sessões do usuário.
        if (bloqueouAgora) {
            tokensRenovacao.revogarTodasDoUsuario(idUsuario, RefreshToken.REASON_SECURITY);
            auditoria.registrar(AuditAction.SECURITY_INSPECTION_LOCK, "User", idUsuario,
                    "acesso bloqueado até " + usuario.getSecurityLockedUntil() + "; sessões encerradas");
        }
        return resultado(usuario, agora);
    }

    private static InspectionEventResult resultado(User usuario, Instant agora) {
        boolean bloqueado = usuario.isSecurityLocked(agora);
        return new InspectionEventResult(usuario.activeSecurityWarnings(agora), MAX_WARNINGS, bloqueado,
                bloqueado ? usuario.getSecurityLockedUntil() : null);
    }

    /** Resposta 423 padronizada (login, refresh e requisições autenticadas). */
    public static ApiException excecaoBloqueio(Instant bloqueadoAte, Instant agora) {
        return new ApiException(ErrorCode.ACCOUNT_LOCKED, HttpStatus.LOCKED, LOCK_MESSAGE, null, segundosAteLiberar(bloqueadoAte, agora));
    }

    public static long segundosAteLiberar(Instant bloqueadoAte, Instant agora) {
        return Math.max(1, Duration.between(agora, bloqueadoAte).toSeconds() + 1);
    }
}
