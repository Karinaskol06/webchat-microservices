package com.project.webchat.gateway.config;

import com.project.webchat.gateway.security.JwtService;
import com.project.webchat.shared.security.GatewayAuthHeaders;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cloud.gateway.filter.GatewayFilter;
import org.springframework.cloud.gateway.filter.factory.AbstractGatewayFilterFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

@Component
public class JwtValidationFilter extends AbstractGatewayFilterFactory<JwtValidationFilter.Config> {

    private final JwtService jwtService;
    private final String gatewayAuthToken;

    public JwtValidationFilter(
            JwtService jwtService,
            @Value("${gateway.internal-auth-token:local-gateway-token}") String gatewayAuthToken) {
        super(Config.class);
        this.jwtService = jwtService;
        this.gatewayAuthToken = gatewayAuthToken;
    }

    @Override
    public GatewayFilter apply(Config config) {
        return (exchange, chain) -> {
            if (HttpMethod.OPTIONS.equals(exchange.getRequest().getMethod())) {
                return chain.filter(exchange);
            }

            String path = exchange.getRequest().getPath().toString();

            if (isPublicEndpoint(path)) {
                return chain.filter(exchange);
            }

            String authHeader = exchange.getRequest().getHeaders().getFirst(HttpHeaders.AUTHORIZATION);
            if (authHeader == null || !authHeader.startsWith("Bearer ")) {
                return unauthorized(exchange, "Missing or invalid Authorization header");
            }

            try {
                String token = authHeader.substring(7).trim();
                if (token.isEmpty() || !jwtService.validateToken(token)) {
                    return unauthorized(exchange, "Invalid or expired token");
                }

                String username = jwtService.extractUsername(token);
                Long userId = jwtService.extractUserId(token);
                if (userId == null) {
                    return unauthorized(exchange, "Token missing userId claim");
                }

                ServerHttpRequest modifiedRequest = exchange.getRequest().mutate()
                        .headers(headers -> {
                            headers.remove(GatewayAuthHeaders.USER_ID);
                            headers.remove(GatewayAuthHeaders.USERNAME);
                            headers.remove(GatewayAuthHeaders.GATEWAY_AUTH);
                            headers.set(HttpHeaders.AUTHORIZATION, authHeader);
                            headers.set(GatewayAuthHeaders.USER_ID, userId.toString());
                            if (username != null && !username.isBlank()) {
                                headers.set(GatewayAuthHeaders.USERNAME, username);
                            }
                            headers.set(GatewayAuthHeaders.GATEWAY_AUTH, gatewayAuthToken);
                        })
                        .build();

                return chain.filter(exchange.mutate().request(modifiedRequest).build());
            } catch (Exception e) {
                return unauthorized(exchange, "Token validation error: " + e.getMessage());
            }
        };
    }

    private boolean isPublicEndpoint(String path) {
        if (path.matches("^/api/users/\\d+/(avatar|background)$")) {
            return true;
        }
        return path.startsWith("/api/auth/")
                || path.startsWith("/api/notifications/vapid-public-key")
                || path.startsWith("/actuator/")
                || path.startsWith("/eureka/");
    }

    private Mono<Void> unauthorized(ServerWebExchange exchange, String message) {
        exchange.getResponse().setStatusCode(HttpStatus.UNAUTHORIZED);
        exchange.getResponse().getHeaders().add("X-Error-Message", message);
        return exchange.getResponse().setComplete();
    }

    public static class Config {
    }
}
