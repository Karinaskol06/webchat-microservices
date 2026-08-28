package com.project.webchat.chat.config;

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
    public OpenAPI chatServiceOpenAPI(
            @Value("${openapi.gateway-server-url:http://localhost:8089}") String gatewayServerUrl) {
        return new OpenAPI()
                .info(new Info()
                        .title("WebChat — chat-service")
                        .description("Rooms, messages, attachments, and presence (`/api/chat/**`, `/api/presence/**`). WebSocket/STOMP is not included.")
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
