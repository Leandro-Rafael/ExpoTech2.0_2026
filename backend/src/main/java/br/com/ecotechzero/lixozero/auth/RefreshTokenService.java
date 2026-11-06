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

    private static final SecureRandom ALEATORIO = new SecureRandom();

    public enum Outcome { ROTATED, INVALID, REUSE_DETECTED }

    public record Issued(String rawToken, UUID familyId) {
    }

    public record Rotation(Outcome outcome, User user, String newRawToken) {
    }

    private final RefreshTokenRepository repositorio;
    private final AppProperties propriedades;
    private final Clock relogio;

    public RefreshTokenService(RefreshTokenRepository repositorio, AppProperties propriedades, Clock relogio) {
        this.repositorio = repositorio;
        this.propriedades = propriedades;
        this.relogio = relogio;
    }

    @Transactional
    public Issued emitir(User usuario, UUID idFamilia) {
        byte[] bytes = new byte[32];
        ALEATORIO.nextBytes(bytes);
        String bruto = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        UUID familia = idFamilia != null ? idFamilia : UUID.randomUUID();
        repositorio.save(new RefreshToken(usuario, familia, gerarHash(bruto), relogio.instant().plus(propriedades.jwt().refreshTtl()),
                RequestContext.ipAtual(), RequestContext.userAgentAtual()));
        return new Issued(bruto, familia);
    }

    /**
     * Rotaciona o token. Não lança exceção: devolve o resultado para que a revogação da família
     * (em caso de reuso) seja efetivada (commit) antes de o chamador responder 401.
     */
    @Transactional
    public Rotation rotacionar(String tokenBruto) {
        Optional<RefreshToken> encontrado = repositorio.findByHashForUpdate(gerarHash(tokenBruto));
        if (encontrado.isEmpty()) {
            return new Rotation(Outcome.INVALID, null, null);
        }
        RefreshToken token = encontrado.get();
        User usuario = token.getUser();
        Instant agora = relogio.instant();

        if (token.isRevoked()) {
            if (RefreshToken.REASON_ROTATED.equals(token.getRevokedReason())) {
                Duration tolerancia = propriedades.jwt().refreshGrace();
                boolean dentroDaTolerancia = !tolerancia.isZero() && token.getRevokedAt().plus(tolerancia).isAfter(agora) && usuario.isEnabled();
                if (dentroDaTolerancia) {
                    // requisições simultâneas legítimas (várias abas): tolera dentro da janela configurada
                    return new Rotation(Outcome.ROTATED, usuario, emitir(usuario, token.getFamilyId()).rawToken());
                }
                repositorio.revokeFamily(token.getFamilyId(), agora, RefreshToken.REASON_REUSE);
                return new Rotation(Outcome.REUSE_DETECTED, usuario, null);
            }
            return new Rotation(Outcome.INVALID, usuario, null);
        }
        if (token.isExpired(agora) || !usuario.isEnabled() || usuario.isSecurityLocked(agora)) {
            token.revoke(agora, RefreshToken.REASON_LOGOUT);
            return new Rotation(Outcome.INVALID, usuario, null);
        }
        token.revoke(agora, RefreshToken.REASON_ROTATED);
        return new Rotation(Outcome.ROTATED, usuario, emitir(usuario, token.getFamilyId()).rawToken());
    }

    /** Logout: revoga a família do token apresentado. */
    @Transactional
    public void revogarFamiliaDe(String tokenBruto) {
        repositorio.findByTokenHash(gerarHash(tokenBruto))
                .ifPresent(t -> repositorio.revokeFamily(t.getFamilyId(), relogio.instant(), RefreshToken.REASON_LOGOUT));
    }

    @Transactional
    public void revogarTodasDoUsuario(UUID idUsuario, String motivo) {
        repositorio.revokeAllForUser(idUsuario, null, relogio.instant(), motivo);
    }

    /** Limpeza diária de tokens expirados há mais de um dia. */
    @Scheduled(cron = "0 30 3 * * *")
    @Transactional
    public void limparExpirados() {
        repositorio.deleteExpiredBefore(relogio.instant().minus(Duration.ofDays(1)));
    }

    static String gerarHash(String bruto) {
        try {
            byte[] resumo = MessageDigest.getInstance("SHA-256").digest(bruto.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(resumo);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
