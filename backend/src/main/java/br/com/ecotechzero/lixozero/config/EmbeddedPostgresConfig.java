package br.com.ecotechzero.lixozero.config;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Condition;
import org.springframework.context.annotation.ConditionContext;
import org.springframework.context.annotation.Conditional;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.type.AnnotatedTypeMetadata;

import javax.sql.DataSource;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

/**
 * Quando DB_URL não é informado, sobe um PostgreSQL REAL embarcado (binários oficiais via zonky),
 * com os dados persistidos em {app.data-dir}/pg. Assim a demonstração roda com um único comando
 * e os dados sobrevivem a reinícios. Em produção (Supabase etc.) basta definir DB_URL.
 */
@Configuration(proxyBeanMethods = false)
@Conditional(EmbeddedPostgresConfig.NoExternalDatabase.class)
public class EmbeddedPostgresConfig {

    private static final Logger log = LoggerFactory.getLogger(EmbeddedPostgresConfig.class);

    @Bean(destroyMethod = "close")
    public EmbeddedPostgres embeddedPostgres(AppProperties props) throws IOException {
        Path dir = props.dataPath().resolve("pg");
        Files.createDirectories(dir.getParent());
        log.info("DB_URL não definido: iniciando PostgreSQL embarcado em {} (porta {})", dir, props.embeddedDb().port());
        return EmbeddedPostgres.builder()
                .setDataDirectory(dir)
                .setCleanDataDirectory(props.embeddedDb().clean())
                .setPort(props.embeddedDb().port())
                .setServerConfig("max_connections", "40")
                .setServerConfig("shared_buffers", "64MB")
                .start();
    }

    @Bean(destroyMethod = "close")
    public DataSource dataSource(EmbeddedPostgres postgres) {
        HikariConfig config = new HikariConfig();
        config.setJdbcUrl(postgres.getJdbcUrl("postgres", "postgres") + "&reWriteBatchedInserts=true");
        config.setMaximumPoolSize(10);
        config.setMinimumIdle(2);
        config.setPoolName("embedded-pg");
        return new HikariDataSource(config);
    }

    /** Ativa esta configuração somente se DB_URL estiver vazio. */
    static class NoExternalDatabase implements Condition {
        @Override
        public boolean matches(ConditionContext context, AnnotatedTypeMetadata metadata) {
            String url = context.getEnvironment().getProperty("DB_URL");
            return url == null || url.isBlank();
        }
    }
}
