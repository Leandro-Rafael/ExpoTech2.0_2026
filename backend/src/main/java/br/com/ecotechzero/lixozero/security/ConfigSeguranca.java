package br.com.ecotechzero.lixozero.security;

import br.com.ecotechzero.lixozero.common.CodigoErro;
import br.com.ecotechzero.lixozero.config.PropriedadesApp;
import br.com.ecotechzero.lixozero.user.RepositorioUsuarios;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.argon2.Argon2PasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.csrf.CsrfException;
import org.springframework.security.web.csrf.CsrfFilter;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter.ReferrerPolicy;
import org.springframework.security.web.header.writers.StaticHeadersWriter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Clock;
import java.time.Duration;
import java.util.List;

/**
 * Configuração central de segurança (Spring Security 7).
 * <ul>
 *   <li><b>Sem sessão no servidor</b> (stateless): a identidade vem do JWT no cookie HttpOnly {@code ez_access}.</li>
 *   <li><b>CSRF</b> (padrão "double submit cookie"): o cookie legível {@code XSRF-TOKEN} precisa ser ecoado
 *       no header {@code X-XSRF-TOKEN} em toda requisição que altera dados. Um site malicioso não consegue
 *       ler o cookie, então não consegue forjar o header. O endpoint IoT é isento (autentica por chave do dispositivo).</li>
 *   <li><b>Autorização por perfil</b>: /api/admin/** só ADMIN; /api/collector/** COLLECTOR ou ADMIN.
 *       A verificação de dono do recurso (anti-IDOR) é feita nos serviços.</li>
 *   <li><b>Cabeçalhos</b>: CSP restritiva, HSTS (em HTTPS), anti-clickjacking, nosniff, Referrer e Permissions-Policy.</li>
 *   <li><b>Senhas</b>: Argon2id (vencedor da Password Hashing Competition), parâmetros recomendados pela OWASP.</li>
 * </ul>
 */
@Configuration
@EnableWebSecurity
public class ConfigSeguranca {

    static final String CONTENT_SECURITY_POLICY = String.join("; ",
            "default-src 'self'",
            "script-src 'self' 'wasm-unsafe-eval'",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: blob: https://*.basemaps.cartocdn.com https://tile.openstreetmap.org https://*.tile.openstreetmap.org",
            "connect-src 'self'",
            "font-src 'self'",
            "worker-src 'self' blob:",
            "frame-ancestors 'none'",
            "base-uri 'self'",
            "form-action 'self'");

    // Antes desta cadeia já rodaram nossos filtros com @Order: RequestId, SignedProxy, limite de corpo e limite por IP.
    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http, ServicoJwt servicoJwt, RepositorioUsuarios usuarios,
                                                   EscritorRespostaProblema problemas, PropriedadesApp propriedades, Clock relogio) throws Exception {
        CookieCsrfTokenRepository repositorioCsrf = CookieCsrfTokenRepository.withHttpOnlyFalse();
        repositorioCsrf.setCookieCustomizer(cookie -> cookie.sameSite("Lax").path("/"));

        http
                // 1. CSRF: o front devolve o cookie XSRF-TOKEN no header. O IoT fica de fora porque usa a chave do dispositivo.
                .csrf(csrf -> csrf.spa()
                        .csrfTokenRepository(repositorioCsrf)
                        .ignoringRequestMatchers("/api/iot/readings"))
                // 2. Nada de sessão no servidor: quem diz quem é o usuário é o JWT no cookie.
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .httpBasic(AbstractHttpConfigurer::disable)
                .formLogin(AbstractHttpConfigurer::disable)
                .logout(AbstractHttpConfigurer::disable)
                .requestCache(AbstractHttpConfigurer::disable)
                .exceptionHandling(e -> e
                        .authenticationEntryPoint((req, res, ex) ->
                                problemas.escrever(res, CodigoErro.UNAUTHORIZED, 401, "Faça login para continuar.", null))
                        .accessDeniedHandler((req, res, ex) -> problemas.escrever(res, CodigoErro.FORBIDDEN, 403,
                                ex instanceof CsrfException
                                        ? "Token CSRF ausente ou inválido. Recarregue a página e tente novamente."
                                        : "Você não tem permissão para acessar este recurso.", null)))
                // 3. Cabeçalhos de segurança para o navegador (CSP, proibição de iframe, HSTS).
                .headers(h -> h
                        .contentSecurityPolicy(csp -> csp.policyDirectives(CONTENT_SECURITY_POLICY))
                        .frameOptions(f -> f.deny())
                        .referrerPolicy(r -> r.policy(ReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN))
                        .httpStrictTransportSecurity(hsts -> hsts.includeSubDomains(true).maxAgeInSeconds(Duration.ofDays(365).toSeconds()))
                        .permissionsPolicyHeader(p -> p.policy("camera=(self), geolocation=(self), microphone=(), payment=(), usb=()"))
                        .addHeaderWriter(new StaticHeadersWriter("Cross-Origin-Opener-Policy", "same-origin"))
                        // fotos e respostas da API não podem ser embutidas por outros sites
                        .addHeaderWriter(new StaticHeadersWriter("Cross-Origin-Resource-Policy", "same-origin")))
                // 4. Permissão por rota. Vale a primeira regra que bater, então a ordem importa.
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.GET, "/api/auth/me").authenticated()
                        .requestMatchers("/api/auth/**", "/api/public/**").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/iot/readings").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/categories", "/api/collection-points").permitAll()
                        .requestMatchers("/api/admin/**").hasRole("ADMIN")
                        .requestMatchers("/api/collector/**").hasAnyRole("COLLECTOR", "ADMIN")
                        .requestMatchers("/api/**").authenticated()
                        .requestMatchers("/actuator/health", "/actuator/health/**").permitAll()
                        .requestMatchers("/actuator/**").denyAll()
                        .anyRequest().permitAll())
                // 5. Coloca na fila o filtro que lê o JWT e identifica o usuário logado.
                .addFilterBefore(new FiltroAutenticacaoJwt(servicoJwt, usuarios, problemas, relogio), UsernamePasswordAuthenticationFilter.class)
                .addFilterAfter(new CsrfCookieFilter(), CsrfFilter.class);

        List<String> origens = propriedades.corsOriginList();
        if (origens.isEmpty()) {
            // Mesma origem (proxy do Vite ou SPA servido pelo próprio back-end): CORS desligado.
            http.cors(AbstractHttpConfigurer::disable);
        } else {
            CorsConfiguration configCors = new CorsConfiguration();
            configCors.setAllowedOrigins(origens);
            configCors.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE"));
            configCors.setAllowedHeaders(List.of("Content-Type", "X-XSRF-TOKEN", "Idempotency-Key"));
            configCors.setAllowCredentials(true);
            configCors.setMaxAge(Duration.ofHours(1));
            UrlBasedCorsConfigurationSource fonte = new UrlBasedCorsConfigurationSource();
            fonte.registerCorsConfiguration("/api/**", configCors);
            http.cors(c -> c.configurationSource(fonte));
        }
        return http.build();
    }

    /** Argon2id: salt 16 bytes, hash 32 bytes, paralelismo 1, memória 19 MiB, 2 iterações (OWASP). */
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new Argon2PasswordEncoder(16, 32, 1, 19_456, 2);
    }

    /** Garante que o cookie XSRF-TOKEN seja emitido (o token do Spring é carregado de forma preguiçosa). */
    static final class CsrfCookieFilter extends OncePerRequestFilter {
        @Override
        protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain cadeia)
                throws ServletException, IOException {
            CsrfToken token = (CsrfToken) request.getAttribute(CsrfToken.class.getName());
            if (token != null) {
                token.getToken();
            }
            cadeia.doFilter(request, response);
        }
    }
}
