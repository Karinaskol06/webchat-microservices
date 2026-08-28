package com.project.webchat.notification.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import io.swagger.v3.oas.models.servers.Server;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.List;

@Configuration
public class OpenApiConfig {

    public static final String BEARER_JWT = "bearer-jwt";

    @Bean
    public OpenAPI notificationServiceOpenAPI(
            @Value("${openapi.gateway-server-url:http://localhost:8089}") String gatewayServerUrl) {
        return new OpenAPI()
                .info(new Info()
                        .title("WebChat — notification-service")
                        .description("Web Push subscriptions and VAPID public key (`/api/notifications/**`).")
                        .version("1.0"))
                .servers(List.of(new Server().url(gatewayServerUrl).description("API gateway")))
                .components(new Components()
                        .addSecuritySchemes(BEARER_JWT, new SecurityScheme()
                                .name(BEARER_JWT)
                                .type(SecurityScheme.Type.HTTP)
                                .scheme("bearer")
                                .bearerFormat("JWT")))
                .addSecurityItem(new SecurityRequirement().addList(BEARER_JWT));
    }
}
