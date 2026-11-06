package br.com.ecotechzero.lixozero.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.http.CacheControl;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.time.Duration;

/**
 * Cache do front-end embutido (perfil {@code spa}). Os arquivos de {@code /assets} têm o hash do conteúdo no
 * nome (gerados pelo Vite), então podem ficar em cache "para sempre"; os pesos do modelo de IA local
 * ({@code /models}, ~14 MB) mudam raramente. O {@code index.html} continua sem cache, para uma nova versão
 * aparecer na hora. Sem o SPA embutido, os handlers simplesmente não encontram arquivos (404).
 */
@Configuration
public class StaticCacheConfig implements WebMvcConfigurer {

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registro) {
        registro.addResourceHandler("/assets/**")
                .addResourceLocations("classpath:/static/assets/")
                .setCacheControl(CacheControl.maxAge(Duration.ofDays(365)).cachePublic().immutable());
        registro.addResourceHandler("/models/**")
                .addResourceLocations("classpath:/static/models/")
                .setCacheControl(CacheControl.maxAge(Duration.ofDays(7)).cachePublic());
    }
}
