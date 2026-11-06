package br.com.ecotechzero.lixozero.config;

import org.springframework.boot.jackson.autoconfigure.JsonMapperBuilderCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import tools.jackson.databind.DeserializationFeature;
import tools.jackson.databind.cfg.CoercionAction;
import tools.jackson.databind.cfg.CoercionInputShape;
import tools.jackson.databind.type.LogicalType;

/**
 * JSON estrito: rejeita campos desconhecidos, números enviados como texto, decimais em campos
 * inteiros e null em tipos primitivos. Evita entradas ambíguas (ex.: "NaN" como string).
 */
@Configuration(proxyBeanMethods = false)
public class JacksonConfig {

    @Bean
    public JsonMapperBuilderCustomizer strictJsonCustomizer() {
        return construtor -> construtor
                .enable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
                .enable(DeserializationFeature.FAIL_ON_NULL_FOR_PRIMITIVES)
                .disable(DeserializationFeature.ACCEPT_FLOAT_AS_INT)
                .withCoercionConfig(LogicalType.Float, cfg -> cfg.setCoercion(CoercionInputShape.String, CoercionAction.Fail))
                .withCoercionConfig(LogicalType.Integer, cfg -> cfg.setCoercion(CoercionInputShape.String, CoercionAction.Fail))
                .withCoercionConfig(LogicalType.Boolean, cfg -> cfg.setCoercion(CoercionInputShape.String, CoercionAction.Fail));
    }
}
