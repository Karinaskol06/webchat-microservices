package com.project.webchat.gateway.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Minimal gateway OpenAPI bean so springdoc can serve swagger-config and Swagger UI.
 * Aggregated service specs are loaded from {@code springdoc.swagger-ui.urls} in application.yml.
 */
@Configuration
public class GatewayOpenApiConfig {

    @Bean
    public OpenAPI gatewayOpenAPI() {
        return new OpenAPI()
                .info(new Info()
                        .title("WebChat API Gateway")
                        .description("Aggregated public API docs for auth, user, chat, and notification services.")
                        .version("1.0"));
    }
}
