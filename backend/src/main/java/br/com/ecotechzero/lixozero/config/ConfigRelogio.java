package br.com.ecotechzero.lixozero.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Clock;

/** Relógio injetável: facilita testes de regras que dependem de data/hora. */
@Configuration(proxyBeanMethods = false)
public class ConfigRelogio {

    @Bean
    public Clock clock() {
        return Clock.systemUTC();
    }
}
