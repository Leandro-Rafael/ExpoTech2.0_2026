package br.com.ecotechzero.lixozero;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.boot.security.autoconfigure.UserDetailsServiceAutoConfiguration;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Ponto de entrada da API Lixo Zero 2050 (EcoTech Zero).
 * Arquitetura em camadas, organizada por funcionalidade: controller -> service -> repository.
 */
@SpringBootApplication(exclude = UserDetailsServiceAutoConfiguration.class) // não usamos usuário em memória
@ConfigurationPropertiesScan
@EnableScheduling
public class LixoZeroApplication {

    public static void main(String[] argumentos) {
        SpringApplication.run(LixoZeroApplication.class, argumentos);
    }
}
