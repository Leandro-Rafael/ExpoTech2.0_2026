package br.com.ecotechzero.lixozero.security;

import br.com.ecotechzero.lixozero.config.PropriedadesApp;
import br.com.ecotechzero.lixozero.user.User;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jws;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
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
public class ServicoJwt {

    private static final String EMISSOR = "lixozero-api";
    private static final int MIN_BYTES_SEGREDO = 32;
    private static final int TAMANHO_MAXIMO_TOKEN = 2048;

    private final SecretKey chave;
    private final PropriedadesApp propriedades;
    private final Clock relogio;

    public ServicoJwt(PropriedadesApp propriedades, Clock relogio) {
        this.propriedades = propriedades;
        this.relogio = relogio;
        this.chave = Keys.hmacShaKeyFor(resolverSegredo(propriedades));
    }

    /** Dados mínimos extraídos de um token válido. */
    public record TokenClaims(UUID userId, int tokenVersion) {
    }

    public String emitirTokenAcesso(User usuario) {
        Instant agora = relogio.instant();
        return Jwts.builder()
                .issuer(EMISSOR)
                .subject(usuario.getId().toString())
                .claim("ver", usuario.getTokenVersion())
                .claim("role", usuario.getRole().name())
                .id(UUID.randomUUID().toString())
                .issuedAt(Date.from(agora))
                .expiration(Date.from(agora.plus(propriedades.jwt().accessTtl())))
                .signWith(chave, Jwts.SIG.HS256)
                .compact();
    }

    /**
     * Valida assinatura, algoritmo (somente HS256: "none" e troca de algoritmo são rejeitados), emissor,
     * expiração e "não antes de" (nbf). Tokens inválidos ou grandes demais simplesmente não autenticam.
     */
    public Optional<TokenClaims> interpretar(String token) {
        if (token == null || token.length() > TAMANHO_MAXIMO_TOKEN) {
            return Optional.empty();
        }
        try {
            Jws<Claims> jws = Jwts.parser()
                    .verifyWith(chave)
                    .requireIssuer(EMISSOR)
                    .clockSkewSeconds(30)
                    .build()
                    .parseSignedClaims(token);
            if (!Jwts.SIG.HS256.getId().equals(jws.getHeader().getAlgorithm())) {
                return Optional.empty();
            }
            Claims declaracoes = jws.getPayload();
            Integer versao = declaracoes.get("ver", Integer.class);
            if (declaracoes.getSubject() == null || versao == null || declaracoes.getExpiration() == null) {
                return Optional.empty();
            }
            return Optional.of(new TokenClaims(UUID.fromString(declaracoes.getSubject()), versao));
        } catch (JwtException | IllegalArgumentException e) {
            return Optional.empty();
        }
    }

    private static byte[] resolverSegredo(PropriedadesApp propriedades) {
        String configurado = propriedades.jwt().secret();
        if (configurado != null && !configurado.isBlank()) {
            byte[] bytes = decodificarSegredo(configurado.strip());
            if (bytes.length < MIN_BYTES_SEGREDO) {
                throw new IllegalStateException("APP_JWT_SECRET deve ter pelo menos 32 bytes (256 bits).");
            }
            return bytes;
        }
        return SegredosLocais.carregarOuCriar(propriedades.dataPath().resolve("jwt-secret.key"), "APP_JWT_SECRET");
    }

    private static byte[] decodificarSegredo(String valor) {
        try {
            byte[] decodificado = Base64.getDecoder().decode(valor);
            if (decodificado.length >= MIN_BYTES_SEGREDO) {
                return decodificado;
            }
        } catch (IllegalArgumentException ignored) {
            // não é Base64: usa o texto puro
        }
        return valor.getBytes(StandardCharsets.UTF_8);
    }
}
