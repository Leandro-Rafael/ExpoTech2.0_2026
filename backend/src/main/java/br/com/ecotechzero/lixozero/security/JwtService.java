package br.com.ecotechzero.lixozero.security;

import br.com.ecotechzero.lixozero.config.AppProperties;
import br.com.ecotechzero.lixozero.user.User;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Instant;
import java.util.Base64;
import java.util.Date;
import java.util.Optional;
import java.util.UUID;

/**
 * Emite e valida o access token (JWT assinado com HMAC-SHA256).
 * <p>
 * O token é curto (~15 min) e vai num cookie HttpOnly, invisível ao JavaScript.
 * Claims: sub (id do usuário), ver (versão do token, muda ao trocar a senha), role, iat, exp, jti.
 * O segredo vem de APP_JWT_SECRET (>= 256 bits); se ausente, é gerado aleatoriamente e salvo em
 * data/jwt-secret.key para que as sessões sobrevivam a reinícios no ambiente de desenvolvimento.
 */
@Service
public class JwtService {

    private static final Logger log = LoggerFactory.getLogger(JwtService.class);
    private static final String ISSUER = "lixozero-api";
    private static final int MIN_SECRET_BYTES = 32;

    private final SecretKey key;
    private final AppProperties props;
    private final Clock clock;

    public JwtService(AppProperties props, Clock clock) {
        this.props = props;
        this.clock = clock;
        this.key = Keys.hmacShaKeyFor(resolveSecret(props));
    }

    /** Dados mínimos extraídos de um token válido. */
    public record TokenClaims(UUID userId, int tokenVersion) {
    }

    public String issueAccessToken(User user) {
        Instant now = clock.instant();
        return Jwts.builder()
                .issuer(ISSUER)
                .subject(user.getId().toString())
                .claim("ver", user.getTokenVersion())
                .claim("role", user.getRole().name())
                .id(UUID.randomUUID().toString())
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plus(props.jwt().accessTtl())))
                .signWith(key, Jwts.SIG.HS256)
                .compact();
    }

    /** Valida assinatura, emissor e expiração. Tokens inválidos simplesmente não autenticam. */
    public Optional<TokenClaims> parse(String token) {
        try {
            Claims claims = Jwts.parser()
                    .verifyWith(key)
                    .requireIssuer(ISSUER)
                    .clockSkewSeconds(30)
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
            Integer version = claims.get("ver", Integer.class);
            return Optional.of(new TokenClaims(UUID.fromString(claims.getSubject()), version == null ? -1 : version));
        } catch (JwtException | IllegalArgumentException e) {
            return Optional.empty();
        }
    }

    private static byte[] resolveSecret(AppProperties props) {
        String configured = props.jwt().secret();
        if (configured != null && !configured.isBlank()) {
            byte[] bytes = decodeSecret(configured.strip());
            if (bytes.length < MIN_SECRET_BYTES) {
                throw new IllegalStateException("APP_JWT_SECRET deve ter pelo menos 32 bytes (256 bits).");
            }
            return bytes;
        }
        return loadOrCreateLocalSecret(props.dataPath().resolve("jwt-secret.key"));
    }

    private static byte[] decodeSecret(String value) {
        try {
            byte[] decoded = Base64.getDecoder().decode(value);
            if (decoded.length >= MIN_SECRET_BYTES) {
                return decoded;
            }
        } catch (IllegalArgumentException ignored) {
            // não é Base64: usa o texto puro
        }
        return value.getBytes(StandardCharsets.UTF_8);
    }

    private static byte[] loadOrCreateLocalSecret(Path file) {
        try {
            if (Files.exists(file)) {
                byte[] bytes = Base64.getDecoder().decode(Files.readString(file).strip());
                if (bytes.length >= MIN_SECRET_BYTES) {
                    return bytes;
                }
            }
            byte[] secret = new byte[48];
            new SecureRandom().nextBytes(secret);
            Files.createDirectories(file.getParent());
            Files.writeString(file, Base64.getEncoder().encodeToString(secret));
            restrictPermissions(file);
            log.warn("APP_JWT_SECRET não definido: segredo aleatório gerado em {} (use APP_JWT_SECRET em produção)", file);
            return secret;
        } catch (IOException e) {
            throw new UncheckedIOException("Não foi possível ler/gravar o segredo JWT local", e);
        }
    }

    private static void restrictPermissions(Path file) {
        try {
            file.toFile().setReadable(false, false);
            file.toFile().setReadable(true, true);
            file.toFile().setWritable(false, false);
            file.toFile().setWritable(true, true);
        } catch (SecurityException ignored) {
            // melhor esforço (Windows ignora parte das permissões POSIX)
        }
    }
}
