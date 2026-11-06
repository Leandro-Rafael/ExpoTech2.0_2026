package br.com.ecotechzero.lixozero.ai;

import br.com.ecotechzero.lixozero.config.AppProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import tools.jackson.databind.json.JsonMapper;

/** Escolhe a implementação de {@link WasteClassifier} conforme a configuração (polimorfismo). */
@Configuration(proxyBeanMethods = false)
public class AiConfig {

    private static final Logger log = LoggerFactory.getLogger(AiConfig.class);

    @Bean
    public WasteClassifier wasteClassifier(AppProperties propriedades, JsonMapper mapeadorJson) {
        if (propriedades.ai().enabled()) {
            log.info("IA de classificação habilitada (modelo {})", propriedades.ai().model());
            return new ClaudeVisionClassifier(propriedades.ai(), mapeadorJson);
        }
        log.info("ANTHROPIC_API_KEY ausente: IA do servidor indisponível (o front-end usará o modelo local)");
        return new UnavailableClassifier();
    }
}
